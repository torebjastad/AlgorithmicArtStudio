/**
 * WebGL2 GPU Transform Feedback Particle Studio
 * Simulates 100,000 to 1,000,000+ particles at 60-144 FPS
 * 100% computed on GPU via Gustavson Simplex Flow Fields & Instanced Streamlines.
 */

class GPUParticlesMode {
  constructor(app) {
    this.app = app;
    this.name = '⚡ GPU Cosmic Particles (1M+)';

    this.params = {
      particleCount: 250000,
      noiseType: 'curl',     // 'curl', 'perlin', 'simplex', 'vortex'
      noiseScale: 0.0028,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      timeSpeed: 0.003,
      particleSpeed: 3.5,    // Fast, responsive flow speed
      streakLength: 4.0,     // Length of velocity streamline tail
      glowAlpha: 0.75,
      enableMouse: false,
      mouseForce: 'attract', // 'attract', 'repel', 'swirl'
      mouseRadius: 220,
      mouseStrength: 4.0
    };

    this.maxParticles = 1000000;
    this.readIndex = 0;
    this.writeIndex = 1;
    this.initialized = false;

    this.initGL();
  }

  initGL() {
    const gl = this.app.webgl.gl;
    if (!gl || !this.app.webgl.isWebGL2) {
      console.warn('WebGL2 is required for GPU Transform Feedback Particles');
      return;
    }

    this.initShaders();
    this.initBuffers();
    this.initialized = true;
  }

  initShaders() {
    const gl = this.app.webgl.gl;

    // 1. Transform Feedback Simulation Vertex Shader
    const simVsSource = `#version 300 es
      precision highp float;

      layout(location = 0) in vec4 a_pos_life; // xy: pos, z: age, w: maxLife
      layout(location = 1) in vec4 a_vel_seed; // xy: vel, zw: seed

      out vec4 v_pos_life;
      out vec4 v_vel_seed;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_noiseScale;
      uniform float u_octaves;
      uniform float u_persistence;
      uniform float u_lacunarity;
      uniform float u_particleSpeed;
      uniform int u_noiseType; // 0: curl, 1: perlin, 2: simplex, 3: vortex
      uniform vec2 u_mouse;
      uniform bool u_enableMouse;
      uniform int u_mouseForce; // 0: attract, 1: repel, 2: swirl
      uniform float u_mouseRadius;
      uniform float u_mouseStrength;

      // Fast Hash Functions
      float hash12(vec2 p) {
        vec3 p3  = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      // Gustavson Fast Simplex Noise 2D
      vec3 permute(vec3 x) {
        return mod(((x * 34.0) + 1.0) * x, 289.0);
      }

      vec4 permute(vec4 x) {
        return mod(((x * 34.0) + 1.0) * x, 289.0);
      }

      vec3 taylorInvSqrt(vec3 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }

      vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }

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
        vec2 pos = a_pos_life.xy;
        float age = a_pos_life.z + 1.0;
        float maxLife = a_pos_life.w;
        vec2 vel = a_vel_seed.xy;
        vec2 seed = a_vel_seed.zw;

        // Respawn when particle expires or leaves the screen
        if (age >= maxLife || pos.x < -40.0 || pos.x > u_resolution.x + 40.0 || pos.y < -40.0 || pos.y > u_resolution.y + 40.0) {
          vec2 rnd = hash22(seed + vec2(u_time * 0.01, 1.73));
          pos = vec2(rnd.x * u_resolution.x, rnd.y * u_resolution.y);
          vel = vec2(0.0);
          age = 0.0;
          maxLife = 100.0 + hash12(seed + vec2(u_time * 0.01, 3.91)) * 200.0;
          seed += vec2(0.137, 0.291);
        }

        float t = u_time * 0.04;
        vec2 np = pos * u_noiseScale;
        vec2 targetVel = vec2(0.0);

        if (u_noiseType == 0) {
          // Divergence-Free Flow Swirls (Curl of potential Psi)
          float eps = 0.005;
          float n1 = fbm(np + vec2(0.0, eps) + vec2(t * 0.02, 0.0));
          float n2 = fbm(np - vec2(0.0, eps) + vec2(t * 0.02, 0.0));
          float n3 = fbm(np + vec2(eps, 0.0) + vec2(0.0, t * 0.02));
          float n4 = fbm(np - vec2(eps, 0.0) + vec2(0.0, t * 0.02));
          vec2 c = vec2((n1 - n2) / (2.0 * eps), -(n3 - n4) / (2.0 * eps));
          float len = length(c);
          targetVel = (len > 0.0001 ? (c / len) : vec2(1.0, 0.0)) * u_particleSpeed * 2.8;
        } else if (u_noiseType == 1) {
          // Harmonic Perlin Angles
          float angle = fbm(np + vec2(t * 0.015, t * 0.015)) * 6.2831853 * 2.0;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed * 2.8;
        } else if (u_noiseType == 3) {
          // Vortex Spiral Flow
          vec2 center = u_resolution * 0.5;
          float dist = length(pos - center);
          float angle = fbm(np + vec2(t * 0.01, t * 0.01)) * 6.2831853 * 1.5 + dist * 0.004;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed * 2.8;
        } else {
          // Simplex Harmonic Flow
          float angle = snoise(np * 1.2 + vec2(t * 0.02, t * 0.02)) * 6.2831853 * 2.0;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed * 2.8;
        }

        // Interactive Mouse Influence
        if (u_enableMouse) {
          vec2 diff = u_mouse - pos;
          float dist = length(diff);
          if (dist < u_mouseRadius && dist > 1.0) {
            float factor = (1.0 - dist / u_mouseRadius) * u_mouseStrength;
            if (u_mouseForce == 0) targetVel += normalize(diff) * factor * 5.0;
            else if (u_mouseForce == 1) targetVel -= normalize(diff) * factor * 7.0;
            else if (u_mouseForce == 2) targetVel += vec2(-diff.y, diff.x) / dist * factor * 7.0;
          }
        }

        // Smooth fluid inertia
        vel = mix(vel, targetVel, 0.22);
        pos += vel;

        v_pos_life = vec4(pos, age, maxLife);
        v_vel_seed = vec4(vel, seed);
      }
    `;

    const simFsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      void main() {
        fragColor = vec4(0.0);
      }
    `;

    const simVs = this.app.webgl.compileShader(simVsSource, gl.VERTEX_SHADER);
    const simFs = this.app.webgl.compileShader(simFsSource, gl.FRAGMENT_SHADER);
    
    this.simProgram = gl.createProgram();
    gl.attachShader(this.simProgram, simVs);
    gl.attachShader(this.simProgram, simFs);

    const varyings = ['v_pos_life', 'v_vel_seed'];
    gl.transformFeedbackVaryings(this.simProgram, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(this.simProgram);

    // 2. High-Performance Instanced Streamline Render Shader (gl.LINES)
    const renderVsSource = `#version 300 es
      precision highp float;

      layout(location = 0) in float a_t;        // 0.0 (tail) to 1.0 (head)
      layout(location = 1) in vec4 i_pos_life;  // xy: pos, z: age, w: maxLife
      layout(location = 2) in vec4 i_vel_seed;  // xy: vel, zw: seed

      out float v_alpha;
      out float v_colorT;

      uniform vec2 u_resolution;
      uniform float u_streakLength;

      void main() {
        vec2 pos = i_pos_life.xy;
        vec2 vel = i_vel_seed.xy;

        // Tail stretches backward along velocity vector
        vec2 tail = pos - vel * u_streakLength;
        vec2 head = pos + vel * 0.2;
        vec2 p = mix(tail, head, a_t);

        vec2 clipSpace = (p / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

        float lifeRatio = clamp(i_pos_life.z / i_pos_life.w, 0.0, 1.0);
        float lifeCurve = sin(lifeRatio * 3.14159265);
        
        // Taper alpha from tail to head
        v_alpha = lifeCurve * (0.15 + 0.85 * a_t);
        v_colorT = fract(lifeRatio + length(vel) * 0.04);
      }
    `;

    const renderFsSource = `#version 300 es
      precision highp float;

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
        vec3 col = cosinePalette(v_colorT);
        fragColor = vec4(col, v_alpha * u_glowAlpha);
      }
    `;

    const renderVs = this.app.webgl.compileShader(renderVsSource, gl.VERTEX_SHADER);
    const renderFs = this.app.webgl.compileShader(renderFsSource, gl.FRAGMENT_SHADER);
    
    this.renderProgram = gl.createProgram();
    gl.attachShader(this.renderProgram, renderVs);
    gl.attachShader(this.renderProgram, renderFs);
    gl.linkProgram(this.renderProgram);
  }

  initBuffers() {
    const gl = this.app.webgl.gl;
    const n = this.maxParticles;
    const w = this.app.width || window.innerWidth;
    const h = this.app.height || window.innerHeight;

    // Unit Line Vertex Buffer [0.0, 1.0]
    this.lineVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, 1.0]), gl.STATIC_DRAW);

    // Particle Data
    const posLifeData = new Float32Array(n * 4);
    const velSeedData = new Float32Array(n * 4);

    for (let i = 0; i < n; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      const maxLife = 80 + Math.random() * 180;
      const age = Math.random() * maxLife;

      posLifeData[i * 4] = rx;
      posLifeData[i * 4 + 1] = ry;
      posLifeData[i * 4 + 2] = age;
      posLifeData[i * 4 + 3] = maxLife;

      velSeedData[i * 4] = 0;
      velSeedData[i * 4 + 1] = 0;
      velSeedData[i * 4 + 2] = Math.random();
      velSeedData[i * 4 + 3] = Math.random();
    }

    this.posLifeBuffers = [gl.createBuffer(), gl.createBuffer()];
    this.velSeedBuffers = [gl.createBuffer(), gl.createBuffer()];
    this.simVaos = [gl.createVertexArray(), gl.createVertexArray()];
    this.renderVaos = [gl.createVertexArray(), gl.createVertexArray()];
    this.tfs = [gl.createTransformFeedback(), gl.createTransformFeedback()];

    for (let i = 0; i < 2; i++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posLifeBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, posLifeData, gl.DYNAMIC_COPY);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.velSeedBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, velSeedData, gl.DYNAMIC_COPY);

      // Simulation VAO (non-instanced, divisor 0)
      gl.bindVertexArray(this.simVaos[i]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posLifeBuffers[i]);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.velSeedBuffers[i]);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(1, 0);

      gl.disableVertexAttribArray(2);

      // Transform Feedback target
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tfs[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.posLifeBuffers[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.velSeedBuffers[i]);

      // Render VAO (Instanced Streamlines)
      gl.bindVertexArray(this.renderVaos[i]);

      // Base line [0, 1] (per-vertex, divisor 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 0);

      // Instance pos_life (per-instance, divisor 1)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posLifeBuffers[i]);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(1, 1);

      // Instance vel_seed (per-instance, divisor 1)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.velSeedBuffers[i]);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(2, 1);
    }

    gl.bindVertexArray(null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  }

  resetAllParticles() {
    this.initBuffers();
  }

  update(dt, time) {
    // Handled on GPU
  }

  render(renderer) {
    const gl = this.app.webgl.gl;
    if (!gl || !this.app.webgl.isWebGL2 || !this.initialized) return;

    const p = this.params;
    const palette = this.app.palette;
    const count = Math.min(p.particleCount, this.maxParticles);
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

    // ==========================================
    // STEP 1: GPU Simulation Pass
    // ==========================================
    gl.useProgram(this.simProgram);
    gl.enable(gl.RASTERIZER_DISCARD);

    gl.uniform2f(gl.getUniformLocation(this.simProgram, 'u_resolution'), this.app.width, this.app.height);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_time'), this.app.time * p.timeSpeed);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_noiseScale'), p.noiseScale);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_octaves'), p.octaves);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_persistence'), p.persistence);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_lacunarity'), p.lacunarity);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_particleSpeed'), p.particleSpeed);
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_noiseType'), noiseTypeMap[p.noiseType] || 0);

    const mouseInf = p.enableMouse && (mouse.isHovering || mouse.isDown);
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_enableMouse'), mouseInf ? 1 : 0);
    gl.uniform2f(gl.getUniformLocation(this.simProgram, 'u_mouse'), mouse.x, mouse.y);
    gl.uniform1i(gl.getUniformLocation(this.simProgram, 'u_mouseForce'), mouseForceMap[p.mouseForce] || 0);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_mouseRadius'), p.mouseRadius);
    gl.uniform1f(gl.getUniformLocation(this.simProgram, 'u_mouseStrength'), p.mouseStrength);

    // Read from readIndex, write to writeIndex
    gl.bindVertexArray(this.simVaos[this.readIndex]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tfs[this.writeIndex]);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.endTransformFeedback();

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    gl.disable(gl.RASTERIZER_DISCARD);

    // ==========================================
    // STEP 2: Clear Canvas with Background Color
    // ==========================================
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const bgRgb = palette.hexToRGB(palette.customBg);
    gl.clearColor(bgRgb[0] / 255, bgRgb[1] / 255, bgRgb[2] / 255, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // ==========================================
    // STEP 3: Draw Luminous Velocity Streamlines
    // ==========================================
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive luminous glow

    gl.useProgram(this.renderProgram);
    gl.uniform2f(gl.getUniformLocation(this.renderProgram, 'u_resolution'), this.app.width, this.app.height);
    gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'u_streakLength'), p.streakLength);
    gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'u_glowAlpha'), p.glowAlpha);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palA'), cosParams.a[0], cosParams.a[1], cosParams.a[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palB'), cosParams.b[0], cosParams.b[1], cosParams.b[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palC'), cosParams.c[0], cosParams.c[1], cosParams.c[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palD'), cosParams.d[0], cosParams.d[1], cosParams.d[2]);

    gl.bindVertexArray(this.renderVaos[this.writeIndex]);
    gl.drawArraysInstanced(gl.LINES, 0, 2, count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);

    // Swap ping-pong indices
    const temp = this.readIndex;
    this.readIndex = this.writeIndex;
    this.writeIndex = temp;
  }

  async renderToCanvas(targetCanvas, width, height) {
    const targetCtx = targetCanvas.getContext('2d');
    targetCtx.drawImage(this.app.webgl.canvas, 0, 0, width, height);
  }
}

window.GPUParticlesMode = GPUParticlesMode;
