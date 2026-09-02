/**
 * WebGL2 GPGPU Texture Ping-Pong Particle Engine
 * Simulates 100,000 to 1,000,000+ particles at 60-144 FPS
 * 100% computed on GPU via MRT Float Textures, Motion Blur Fade & Anti-Aliased Ribbon Quads.
 * Seamless historical frame connection with analytic sub-pixel Gaussian anti-aliasing.
 */

class GPUParticlesMode {
  constructor(app) {
    this.app = app;
    this.name = '⚡ GPU Cosmic Particles (1M+)';

    this.params = {
      particleCount: 262144, // 512x512 = 262,144 particles (up to 1024x1024 = 1,048,576)
      noiseType: 'curl',     // 'curl', 'perlin', 'simplex', 'vortex'
      noiseScale: 0.0006,    // Ultra-wide cosmic flow scale
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      timeSpeed: 0.003,
      particleSpeed: 0.19,   // Exact user calibrated velocity
      strokeWidth: 2.0,      // Anti-aliased line thickness
      streakLength: 0.94,    // Streamline tail length
      fadeRate: 0.23,        // Motion blur decay rate
      glowAlpha: 0.85,
      taperMode: 'intensity', // 'both', 'intensity', 'width', 'none'
      spawnMode: 'random',   // 'random', 'edges', 'center'
      enableMouse: false,
      mouseForce: 'attract', // 'attract', 'repel', 'swirl'
      mouseRadius: 220,
      mouseStrength: 4.0
    };

    this.texSize = 1024;
    this.readIdx = 0;
    this.writeIdx = 1;
    this.initialized = false;

    this.initGL();
  }

  initGL() {
    const gl = this.app.webgl.gl;
    if (!gl || !this.app.webgl.isWebGL2) {
      console.warn('WebGL2 is required for GPU Particles');
      return;
    }

    // Enable float texture attachments
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');

    this.initShaders();
    this.initGPGPUBuffers();
    this.initialized = true;
  }

  initShaders() {
    const gl = this.app.webgl.gl;

    // 1. Fullscreen Quad Vertex Shader for GPGPU Sim & Fade
    const quadVsSource = `#version 300 es
      precision highp float;
      layout(location = 0) in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // 2. GPGPU Simulation Fragment Shader (Updates Pos & Historical prevPos via MRT)
    const simFsSource = `#version 300 es
      precision highp float;

      layout(location = 0) out vec4 outPosLife; // xy: current pos, z: age, w: maxLife
      layout(location = 1) out vec4 outPrevSeed; // xy: exact prevPos (history), zw: seed

      in vec2 v_uv;

      uniform sampler2D u_posLifeTex;
      uniform sampler2D u_velSeedTex;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_noiseScale;
      uniform float u_octaves;
      uniform float u_persistence;
      uniform float u_lacunarity;
      uniform float u_particleSpeed;
      uniform int u_noiseType; // 0: curl, 1: perlin, 2: simplex, 3: vortex
      uniform int u_spawnMode; // 0: random, 1: edges, 2: center
      uniform vec2 u_mouse;
      uniform bool u_enableMouse;
      uniform int u_mouseForce; // 0: attract, 1: repel, 2: swirl
      uniform float u_mouseRadius;
      uniform float u_mouseStrength;

      // Fast Hash Functions
      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      vec2 getSpawnPos(vec2 rnd, vec2 res, int mode) {
        if (mode == 1) {
          // Spawn tightly along the outer boundary (-2.5px)
          float margin = 2.5;
          float totalW = res.x + 2.0 * margin;
          float totalH = res.y + 2.0 * margin;
          float perimeter = 2.0 * (totalW + totalH);
          float d = rnd.x * perimeter;
          if (d < totalW) {
            return vec2(-margin + d, -margin);
          } else if (d < totalW + totalH) {
            return vec2(res.x + margin, -margin + (d - totalW));
          } else if (d < 2.0 * totalW + totalH) {
            return vec2(res.x + margin - (d - (totalW + totalH)), res.y + margin);
          } else {
            return vec2(-margin, res.y + margin - (d - (2.0 * totalW + totalH)));
          }
        } else if (mode == 2) {
          // Center Core Burst
          return res * 0.5 + (rnd - 0.5) * min(res.x, res.y) * 0.18;
        }
        // Full Canvas (Random)
        return vec2(rnd.x * res.x, rnd.y * res.y);
      }

      // Gustavson Fast Simplex Noise 2D
      vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
      vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
      vec3 taylorInvSqrt(vec3 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                            -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= taylorInvSqrt(a0 * a0 + h * h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);

        for (int i = 0; i < 4; i++) {
          if (float(i) >= u_octaves) break;
          val += amp * snoise(p * freq);
          p = rot * p * u_lacunarity;
          amp *= u_persistence;
        }
        return val;
      }

      void main() {
        vec4 posLife = texture(u_posLifeTex, v_uv);
        vec4 prevSeed = texture(u_velSeedTex, v_uv);

        vec2 pos = posLife.xy;
        vec2 oldPos = pos;
        float age = posLife.z + 1.0;
        float maxLife = posLife.w;
        vec2 seed = prevSeed.zw;

        // Respawn when particle expires or leaves the screen
        if (age >= maxLife || pos.x < -40.0 || pos.x > u_resolution.x + 40.0 || pos.y < -40.0 || pos.y > u_resolution.y + 40.0) {
          vec2 rnd = hash22(seed + vec2(u_time * 0.01, 1.73));
          pos = getSpawnPos(rnd, u_resolution, u_spawnMode);
          oldPos = pos; // Avoid connecting streak across screen on respawn
          age = 0.0;
          maxLife = 100.0 + hash12(seed + vec2(u_time * 0.01, 3.91)) * 200.0;
          seed += vec2(0.137, 0.291);
        }

        float t = u_time * 0.04;
        vec2 np = pos * u_noiseScale;
        vec2 vel = vec2(0.0);

        if (u_noiseType == 0) {
          // Divergence-Free Flow Swirls (Curl of potential Psi)
          float eps = 0.005;
          float n1 = fbm(np + vec2(0.0, eps) + vec2(t * 0.02, 0.0));
          float n2 = fbm(np - vec2(0.0, eps) + vec2(t * 0.02, 0.0));
          float n3 = fbm(np + vec2(eps, 0.0) + vec2(0.0, t * 0.02));
          float n4 = fbm(np - vec2(eps, 0.0) + vec2(0.0, t * 0.02));
          vec2 c = vec2((n1 - n2) / (2.0 * eps), -(n3 - n4) / (2.0 * eps));
          float len = length(c);
          vel = (len > 0.0001 ? (c / len) : vec2(1.0, 0.0)) * u_particleSpeed * 2.8;
        } else if (u_noiseType == 1) {
          // Harmonic Perlin Angles
          float angle = fbm(np + vec2(t * 0.015, t * 0.015)) * 6.2831853 * 2.0;
          vel = vec2(cos(angle), sin(angle)) * u_particleSpeed * 2.8;
        } else if (u_noiseType == 3) {
          // Vortex Spiral Flow
          vec2 center = u_resolution * 0.5;
          float dist = length(pos - center);
          float angle = fbm(np + vec2(t * 0.01, t * 0.01)) * 6.2831853 * 1.5 + dist * 0.004;
          vel = vec2(cos(angle), sin(angle)) * u_particleSpeed * 2.8;
        } else {
          // Simplex Harmonic Flow
          float angle = snoise(np * 1.2 + vec2(t * 0.02, t * 0.02)) * 6.2831853 * 2.0;
          vel = vec2(cos(angle), sin(angle)) * u_particleSpeed * 2.8;
        }

        // Interactive Mouse Influence
        if (u_enableMouse) {
          vec2 diff = u_mouse - pos;
          float dist = length(diff);
          if (dist < u_mouseRadius && dist > 1.0) {
            float factor = (1.0 - dist / u_mouseRadius) * u_mouseStrength;
            if (u_mouseForce == 0) vel += normalize(diff) * factor * 5.0;
            else if (u_mouseForce == 1) vel -= normalize(diff) * factor * 7.0;
            else if (u_mouseForce == 2) vel += vec2(-diff.y, diff.x) / dist * factor * 7.0;
          }
        }

        // Advance position
        pos += vel;

        outPosLife = vec4(pos, age, maxLife);
        outPrevSeed = vec4(oldPos, seed);
      }
    `;

    const quadVs = this.app.webgl.compileShader(quadVsSource, gl.VERTEX_SHADER);
    const simFs = this.app.webgl.compileShader(simFsSource, gl.FRAGMENT_SHADER);
    this.simProgram = gl.createProgram();
    gl.attachShader(this.simProgram, quadVs);
    gl.attachShader(this.simProgram, simFs);
    gl.linkProgram(this.simProgram);

    // 3. High-Resolution Anti-Aliased Ribbon Quad Vertex Shader (gl.TRIANGLE_STRIP)
    const renderVsSource = `#version 300 es
      precision highp float;

      layout(location = 0) in vec2 a_quadPos;     // x: t (0..1), y: side (-1..+1)
      layout(location = 1) in vec2 a_particleUv;  // Per-instance UV coordinate

      out float v_side;
      out float v_alpha;
      out float v_colorT;

      uniform sampler2D u_posLifeTex;
      uniform sampler2D u_velSeedTex;

      uniform vec2 u_resolution;
      uniform float u_strokeWidth;
      uniform int u_taperMode; // 0: both, 1: intensity only, 2: width only, 3: none / uniform

      void main() {
        vec4 posLife = texture(u_posLifeTex, a_particleUv);
        vec4 prevSeed = texture(u_velSeedTex, a_particleUv);

        vec2 pos = posLife.xy;
        vec2 prevPos = prevSeed.xy; // Exact historical position from previous frame

        vec2 dir = pos - prevPos;
        float len = length(dir);
        vec2 norm = (len > 0.0001) ? vec2(-dir.y, dir.x) / len : vec2(0.0, 1.0);

        float lifeRatio = clamp(posLife.z / posLife.w, 0.0, 1.0);

        // Start at 100% full intensity from frame 0 at the canvas edge and decay smoothly to 0.0 at the end
        float lifeCurve = smoothstep(1.0, 0.45, lifeRatio);

        float alphaMultiplier = 1.0;
        float widthMultiplier = 1.0;

        if (u_taperMode == 0) {
          // Both: Intensity Fade + Width Needle Taper
          alphaMultiplier = lifeCurve;
          widthMultiplier = mix(0.30, 1.0, lifeCurve);
        } else if (u_taperMode == 1) {
          // Intensity Fade Only (Constant Stroke Width)
          alphaMultiplier = lifeCurve;
          widthMultiplier = 1.0;
        } else if (u_taperMode == 2) {
          // Width Fade Only (Full Opacity, Solid Needle to Point)
          alphaMultiplier = 1.0;
          widthMultiplier = mix(0.0, 1.0, lifeCurve);
        } else {
          // None: Uniform Constant Ribbon
          alphaMultiplier = 1.0;
          widthMultiplier = 1.0;
        }

        float halfWidth = max(0.4, u_strokeWidth * 0.5) * widthMultiplier;
        vec2 basePos = mix(prevPos, pos, a_quadPos.x);
        vec2 screenPos = basePos + norm * (a_quadPos.y * halfWidth);

        vec2 clipSpace = (screenPos / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

        v_side = a_quadPos.y;
        v_alpha = alphaMultiplier;
        v_colorT = fract(lifeRatio);
      }
    `;

    const renderFsSource = `#version 300 es
      precision highp float;

      in float v_side;
      in float v_alpha;
      in float v_colorT;
      out vec4 fragColor;

      uniform vec3 u_palA;
      uniform vec3 u_palB;
      uniform vec3 u_palC;
      uniform vec3 u_palD;
      uniform float u_glowAlpha;

      vec3 cosinePalette(float t) {
        return u_palA + u_palB * cos(6.2831853 * (u_palC * t + u_palD));
      }

      void main() {
        // Analytic sub-pixel Gaussian edge anti-aliasing
        float edgeDist = abs(v_side);
        float edgeAntialias = exp(-edgeDist * edgeDist * 2.5);

        vec3 col = cosinePalette(v_colorT);
        fragColor = vec4(col, v_alpha * edgeAntialias * u_glowAlpha);
      }
    `;

    const renderVs = this.app.webgl.compileShader(renderVsSource, gl.VERTEX_SHADER);
    const renderFs = this.app.webgl.compileShader(renderFsSource, gl.FRAGMENT_SHADER);
    this.renderProgram = gl.createProgram();
    gl.attachShader(this.renderProgram, renderVs);
    gl.attachShader(this.renderProgram, renderFs);
    gl.linkProgram(this.renderProgram);

    // 4. Background Fade Quad Shader (Motion Trails)
    const fadeFsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform vec4 u_fadeColor;
      void main() {
        fragColor = u_fadeColor;
      }
    `;
    const fadeFs = this.app.webgl.compileShader(fadeFsSource, gl.FRAGMENT_SHADER);
    this.fadeProgram = gl.createProgram();
    gl.attachShader(this.fadeProgram, quadVs);
    gl.attachShader(this.fadeProgram, fadeFs);
    gl.linkProgram(this.fadeProgram);
  }

  initGPGPUBuffers() {
    const gl = this.app.webgl.gl;
    this.texSize = 1024; // Full 1,048,576 particle capacity

    const size = this.texSize;
    const totalParticles = size * size;
    const w = this.app.width || window.innerWidth;
    const h = this.app.height || window.innerHeight;

    // Fullscreen Quad VAO for Simulation & Fade Passes
    this.simQuadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.simQuadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    this.simQuadVao = gl.createVertexArray();
    gl.bindVertexArray(this.simQuadVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Initial Particle Texture Data
    const posLifeData = new Float32Array(totalParticles * 4);
    const prevSeedData = new Float32Array(totalParticles * 4);

    for (let i = 0; i < totalParticles; i++) {
      let rx, ry;
      if (this.params.spawnMode === 'edges') {
        const margin = 2.5;
        const totalW = w + 2 * margin;
        const totalH = h + 2 * margin;
        const perimeter = 2 * (totalW + totalH);
        const d = Math.random() * perimeter;
        if (d < totalW) { rx = -margin + d; ry = -margin; }
        else if (d < totalW + totalH) { rx = w + margin; ry = -margin + (d - totalW); }
        else if (d < 2 * totalW + totalH) { rx = w + margin - (d - (totalW + totalH)); ry = h + margin; }
        else { rx = -margin; ry = h + margin - (d - (2 * totalW + totalH)); }
      } else if (this.params.spawnMode === 'center') {
        rx = w * 0.5 + (Math.random() - 0.5) * Math.min(w, h) * 0.18;
        ry = h * 0.5 + (Math.random() - 0.5) * Math.min(w, h) * 0.18;
      } else {
        rx = Math.random() * w;
        ry = Math.random() * h;
      }

      const maxLife = 80 + Math.random() * 180;
      const age = Math.random() * maxLife;

      posLifeData[i * 4] = rx;
      posLifeData[i * 4 + 1] = ry;
      posLifeData[i * 4 + 2] = age;
      posLifeData[i * 4 + 3] = maxLife;

      // Exact historical prevPos
      prevSeedData[i * 4] = rx;
      prevSeedData[i * 4 + 1] = ry;
      prevSeedData[i * 4 + 2] = Math.random();
      prevSeedData[i * 4 + 3] = Math.random();
    }

    // Ping-Pong GPGPU Textures & FBOs
    this.posLifeTextures = [gl.createTexture(), gl.createTexture()];
    this.velSeedTextures = [gl.createTexture(), gl.createTexture()];
    this.fbos = [gl.createFramebuffer(), gl.createFramebuffer()];

    for (let i = 0; i < 2; i++) {
      // Position + Life Texture (RGBA32F)
      gl.bindTexture(gl.TEXTURE_2D, this.posLifeTextures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, posLifeData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // PrevPos + Seed Texture (RGBA32F)
      gl.bindTexture(gl.TEXTURE_2D, this.velSeedTextures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, prevSeedData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // MRT Framebuffer Attachment
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.posLifeTextures[i], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.velSeedTextures[i], 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Anti-Aliased Ribbon Quad Geometry (TRIANGLE_STRIP: 4 vertices)
    // [t, side]: (0, -1), (0, 1), (1, -1), (1, 1)
    this.ribbonVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ribbonVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0, -1.0,
      0.0,  1.0,
      1.0, -1.0,
      1.0,  1.0
    ]), gl.STATIC_DRAW);

    // Particle UV coordinates in texture
    const uvData = new Float32Array(totalParticles * 2);
    let pIdx = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        uvData[pIdx * 2] = (x + 0.5) / size;
        uvData[pIdx * 2 + 1] = (y + 0.5) / size;
        pIdx++;
      }
    }

    this.particleUvVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleUvVbo);
    gl.bufferData(gl.ARRAY_BUFFER, uvData, gl.STATIC_DRAW);

    // Instanced Ribbon Quad Render VAO
    this.renderVao = gl.createVertexArray();
    gl.bindVertexArray(this.renderVao);

    // a_quadPos [t, side] (per-vertex, divisor 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ribbonVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);

    // a_particleUv (per-instance, divisor 1)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleUvVbo);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.bindVertexArray(null);
  }

  resetAllParticles() {
    this.initGPGPUBuffers();
    const gl = this.app.webgl.gl;
    if (gl) {
      const palette = this.app.palette;
      const bgRgb = palette.hexToRGB(palette.customBg);
      gl.clearColor(bgRgb[0] / 255, bgRgb[1] / 255, bgRgb[2] / 255, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  update(dt, time) {
    // Handled on GPU
  }

  render(renderer) {
    const gl = this.app.webgl.gl;
    if (!gl || !this.app.webgl.isWebGL2 || !this.initialized) return;

    const p = this.params;
    const palette = this.app.palette;
    const count = Math.min(Math.round(p.particleCount), this.texSize * this.texSize);
    const cosParams = palette.current.cosine || {
      a: [0.5, 0.5, 0.5],
      b: [0.5, 0.5, 0.5],
      c: [1.0, 1.0, 1.0],
      d: [0.0, 0.33, 0.67]
    };

    const mouse = this.app.mouse;
    const noiseTypeMap = { curl: 0, perlin: 1, simplex: 2, vortex: 3 };
    const mouseForceMap = { attract: 0, repel: 1, swirl: 2 };

    const w = this.app.webgl.canvas.width;
    const h = this.app.webgl.canvas.height;
    const size = this.texSize;

    // ==========================================
    // STEP 1: GPGPU Simulation Pass (MRT Textures)
    // ==========================================
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[this.writeIdx]);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, size, size);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    gl.useProgram(this.simProgram);

    // Bind Read Textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posLifeTextures[this.readIdx]);
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_posLifeTex'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velSeedTextures[this.readIdx]);
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_velSeedTex'), 1);

    // Set Uniforms
    gl.uniform2f(gl.getUniformLocation(this.simProgram, 'u_resolution'), this.app.width, this.app.height);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_time'), this.app.time * p.timeSpeed);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_noiseScale'), p.noiseScale);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_octaves'), p.octaves);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_persistence'), p.persistence);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_lacunarity'), p.lacunarity);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_particleSpeed'), p.particleSpeed);
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_noiseType'), noiseTypeMap[p.noiseType] || 0);

    const spawnModeMap = { random: 0, edges: 1, center: 2 };
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_spawnMode'), spawnModeMap[p.spawnMode] || 0);

    const mouseInf = p.enableMouse && (mouse.isHovering || mouse.isDown);
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_enableMouse'), mouseInf ? 1 : 0);
    gl.uniform2f(gl.getUniformLocation(this.simProgram, 'u_mouse'), mouse.x, mouse.y);
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_mouseForce'), mouseForceMap[p.mouseForce] || 0);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_mouseRadius'), p.mouseRadius);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_mouseStrength'), p.mouseStrength);

    // Execute Simulation Quad
    gl.bindVertexArray(this.simQuadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    // ==========================================
    // STEP 2: Motion Trail Fade / Canvas Refresh
    // ==========================================
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const bgRgb = palette.hexToRGB(palette.customBg);

    if (p.fadeRate >= 0.35) {
      // Instant clear at high fade rate
      gl.clearColor(bgRgb[0] / 255, bgRgb[1] / 255, bgRgb[2] / 255, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else {
      // Smooth fading motion blur quad
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(this.fadeProgram);
      gl.uniform4f(gl.getUniformLocation(this.fadeProgram, 'u_fadeColor'),
        bgRgb[0] / 255, bgRgb[1] / 255, bgRgb[2] / 255, p.fadeRate);

      gl.bindVertexArray(this.simQuadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
    }

    // ==========================================
    // STEP 3: Draw Anti-Aliased Ribbon Quads
    // ==========================================
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive luminous glow

    gl.useProgram(this.renderProgram);

    // Bind Updated Textures from writeIdx
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posLifeTextures[this.writeIdx]);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_posLifeTex'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velSeedTextures[this.writeIdx]);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_velSeedTex'), 1);

    gl.uniform2f(gl.getUniformLocation(this.renderProgram, 'u_resolution'), this.app.width, this.app.height);
    gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'u_strokeWidth'), p.strokeWidth * (this.app.webgl.dpr || 1));
    gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'u_glowAlpha'), p.glowAlpha);

    const taperModeMap = { both: 0, intensity: 1, width: 2, none: 3 };
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_taperMode'), taperModeMap[p.taperMode] ?? 0);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palA'), cosParams.a[0], cosParams.a[1], cosParams.a[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palB'), cosParams.b[0], cosParams.b[1], cosParams.b[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palC'), cosParams.c[0], cosParams.c[1], cosParams.c[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palD'), cosParams.d[0], cosParams.d[1], cosParams.d[2]);

    gl.bindVertexArray(this.renderVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);

    // Swap ping-pong texture slots
    const temp = this.readIdx;
    this.readIdx = this.writeIdx;
    this.writeIdx = temp;
  }

  async renderToCanvas(targetCanvas, width, height) {
    const targetCtx = targetCanvas.getContext('2d');
    targetCtx.drawImage(this.app.webgl.canvas, 0, 0, width, height);
  }
}

window.GPUParticlesMode = GPUParticlesMode;
