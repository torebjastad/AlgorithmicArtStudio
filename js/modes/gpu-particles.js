/**
 * WebGL2 GPU Transform Feedback Particle & Streamline Engine
 * Simulates 100,000 to 1,000,000+ particles at 60-144 FPS
 * 100% computed on GPU via GLSL Vertex Shaders, Instanced Streamlines & Framebuffer Trails.
 */

class GPUParticlesMode {
  constructor(app) {
    this.app = app;
    this.name = '⚡ GPU Cosmic Particles (1M+)';

    this.params = {
      particleCount: 250000,
      noiseType: 'curl',     // 'curl', 'perlin', 'simplex', 'vortex'
      noiseScale: 0.003,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      timeSpeed: 0.0025,
      particleSpeed: 2.2,
      strokeWidth: 1.5,
      fadeRate: 0.04,
      glowAlpha: 0.7,
      enableMouse: false,
      mouseForce: 'attract', // 'attract', 'repel', 'swirl'
      mouseRadius: 200,
      mouseStrength: 3.0
    };

    this.maxParticles = 1000000;
    this.readIndex = 0;
    this.writeIndex = 1;
    this.fboIndex = 0;
    this.initialized = false;

    this.initGL();
  }

  initGL() {
    const gl = this.app.webgl.gl;
    if (!gl || !this.app.webgl.isWebGL2) {
      console.warn('WebGL2 required for GPU Transform Feedback Particles');
      return;
    }

    this.initShaders();
    this.initBuffers();
    this.initFramebuffers();
    this.initialized = true;
  }

  initShaders() {
    const gl = this.app.webgl.gl;

    // 1. Transform Feedback Simulation Vertex Shader
    const simVsSource = `#version 300 es
      precision highp float;

      layout(location = 0) in vec2 a_pos;
      layout(location = 1) in vec2 a_prev;
      layout(location = 2) in vec2 a_vel;
      layout(location = 3) in vec2 a_life; // x: currentLife, y: maxLife
      layout(location = 4) in vec2 a_seed;

      out vec2 v_pos;
      out vec2 v_prev;
      out vec2 v_vel;
      out vec2 v_life;
      out vec2 v_seed;

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

      vec3 hash3(vec2 p) {
        vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                      dot(p, vec2(269.5, 183.3)),
                      dot(p, vec2(419.2, 371.9)));
        return fract(sin(q) * 43758.5453);
      }

      float noise2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(
          mix(dot(-1.0 + 2.0 * hash3(i + vec2(0.0, 0.0)).xy, f - vec2(0.0, 0.0)),
              dot(-1.0 + 2.0 * hash3(i + vec2(1.0, 0.0)).xy, f - vec2(1.0, 0.0)), u.x),
          mix(dot(-1.0 + 2.0 * hash3(i + vec2(0.0, 1.0)).xy, f - vec2(0.0, 1.0)),
              dot(-1.0 + 2.0 * hash3(i + vec2(1.0, 1.0)).xy, f - vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);

        for (int i = 0; i < 5; i++) {
          if (float(i) >= u_octaves) break;
          val += amp * noise2D(p * freq);
          p = rot * p * u_lacunarity;
          amp *= u_persistence;
        }
        return val;
      }

      vec2 getCurl(vec2 p, float t) {
        float eps = 0.01;
        float n1 = fbm(p + vec2(0.0, eps) + t * 0.1);
        float n2 = fbm(p - vec2(0.0, eps) + t * 0.1);
        float n3 = fbm(p + vec2(eps, 0.0) + t * 0.1);
        float n4 = fbm(p - vec2(eps, 0.0) + t * 0.1);

        float dPsiDy = (n1 - n2) / (2.0 * eps);
        float dPsiDx = (n3 - n4) / (2.0 * eps);

        return vec2(dPsiDy, -dPsiDx);
      }

      void main() {
        vec2 pos = a_pos;
        vec2 prev = a_pos;
        vec2 vel = a_vel;
        vec2 life = a_life;
        vec2 seed = a_seed;

        life.x += 1.0;

        // Respawn if expired or outside canvas bounds
        if (life.x >= life.y || pos.x < -40.0 || pos.x > u_resolution.x + 40.0 || pos.y < -40.0 || pos.y > u_resolution.y + 40.0) {
          pos = vec2(hash3(seed + vec2(u_time, 1.0)).x * u_resolution.x,
                     hash3(seed + vec2(u_time, 2.0)).y * u_resolution.y);
          prev = pos;
          vel = vec2(0.0);
          life.x = 0.0;
          life.y = 70.0 + hash3(seed + vec2(u_time, 3.0)).z * 180.0;
          seed += vec2(0.17, 0.31);
        }

        vec2 np = pos * u_noiseScale;
        vec2 targetVel = vec2(0.0);

        if (u_noiseType == 0) {
          // Divergence-Free Curl Noise
          targetVel = getCurl(np, u_time) * u_particleSpeed * 2.8;
        } else if (u_noiseType == 1) {
          // Perlin Angle
          float angle = fbm(np + vec2(0.05, 0.05) * u_time) * 6.2831853 * 2.0;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed;
        } else if (u_noiseType == 3) {
          // Vortex
          vec2 center = u_resolution * 0.5;
          float dist = length(pos - center);
          float angle = fbm(np + vec2(0.05, 0.05) * u_time) * 6.2831853 + dist * 0.004;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed;
        } else {
          // Simplex
          float angle = fbm(np * 1.5 + vec2(0.04, 0.04) * u_time) * 6.2831853 * 2.0;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed;
        }

        // Mouse interactive forces
        if (u_enableMouse) {
          vec2 diff = u_mouse - pos;
          float dist = length(diff);
          if (dist < u_mouseRadius && dist > 1.0) {
            float factor = (1.0 - dist / u_mouseRadius) * u_mouseStrength;
            if (u_mouseForce == 0) {
              targetVel += normalize(diff) * factor * 5.0;
            } else if (u_mouseForce == 1) {
              targetVel -= normalize(diff) * factor * 7.0;
            } else if (u_mouseForce == 2) {
              targetVel += vec2(-diff.y, diff.x) / dist * factor * 7.0;
            }
          }
        }

        vel = mix(vel, targetVel, 0.15);
        pos += vel;

        v_pos = pos;
        v_prev = prev;
        v_vel = vel;
        v_life = life;
        v_seed = seed;
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

    const varyings = ['v_pos', 'v_prev', 'v_vel', 'v_life', 'v_seed'];
    gl.transformFeedbackVaryings(this.simProgram, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(this.simProgram);

    // 2. Instanced Streamline Streak Render Shader (gl.LINES per particle)
    const lineVsSource = `#version 300 es
      precision highp float;

      // Base line segment vertex [0 or 1]
      layout(location = 0) in float a_t;

      // Instanced particle attributes
      layout(location = 1) in vec2 i_pos;
      layout(location = 2) in vec2 i_prev;
      layout(location = 3) in vec2 i_vel;
      layout(location = 4) in vec2 i_life;

      out float v_alpha;
      out float v_colorT;

      uniform vec2 u_resolution;

      void main() {
        vec2 p = mix(i_prev, i_pos, a_t);
        vec2 clipSpace = (p / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);

        float lifeRatio = clamp(i_life.x / i_life.y, 0.0, 1.0);
        float lifeAlpha = sin(lifeRatio * 3.14159265);
        v_alpha = lifeAlpha * (0.3 + 0.7 * a_t);
        v_colorT = fract(lifeRatio + length(i_vel) * 0.1);
      }
    `;

    const lineFsSource = `#version 300 es
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

    const lineVs = this.app.webgl.compileShader(lineVsSource, gl.VERTEX_SHADER);
    const lineFs = this.app.webgl.compileShader(lineFsSource, gl.FRAGMENT_SHADER);
    this.lineProgram = gl.createProgram();
    gl.attachShader(this.lineProgram, lineVs);
    gl.attachShader(this.lineProgram, lineFs);
    gl.linkProgram(this.lineProgram);

    // 3. Motion Trail Blit & Fade Shader
    const trailVsSource = `#version 300 es
      layout(location = 0) in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const trailFsSource = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;
      uniform sampler2D u_prevTrail;
      uniform float u_fadeRate;
      uniform vec3 u_bgColor;

      void main() {
        vec4 prev = texture(u_prevTrail, v_uv);
        // Progressive decay towards background color
        vec3 col = mix(prev.rgb, u_bgColor, clamp(u_fadeRate, 0.0, 1.0));
        fragColor = vec4(col, 1.0);
      }
    `;

    const trailVs = this.app.webgl.compileShader(trailVsSource, gl.VERTEX_SHADER);
    const trailFs = this.app.webgl.compileShader(trailFsSource, gl.FRAGMENT_SHADER);
    this.trailProgram = gl.createProgram();
    gl.attachShader(this.trailProgram, trailVs);
    gl.attachShader(this.trailProgram, trailFs);
    gl.linkProgram(this.trailProgram);
  }

  initBuffers() {
    const gl = this.app.webgl.gl;
    const n = this.maxParticles;
    const w = this.app.width || window.innerWidth;
    const h = this.app.height || window.innerHeight;

    // Quad Buffer for Trail Blit & Fade
    this.quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);

    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Unit Line Vertex Buffer [0.0, 1.0]
    this.lineVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, 1.0]), gl.STATIC_DRAW);

    // Initial Data
    const posData = new Float32Array(n * 2);
    const prevData = new Float32Array(n * 2);
    const velData = new Float32Array(n * 2);
    const lifeData = new Float32Array(n * 2);
    const seedData = new Float32Array(n * 2);

    for (let i = 0; i < n; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      posData[i * 2] = rx;
      posData[i * 2 + 1] = ry;
      prevData[i * 2] = rx;
      prevData[i * 2 + 1] = ry;
      velData[i * 2] = 0;
      velData[i * 2 + 1] = 0;
      const maxLife = 60 + Math.random() * 160;
      lifeData[i * 2] = Math.random() * maxLife;
      lifeData[i * 2 + 1] = maxLife;
      seedData[i * 2] = Math.random();
      seedData[i * 2 + 1] = Math.random();
    }

    this.simVaos = [gl.createVertexArray(), gl.createVertexArray()];
    this.renderVaos = [gl.createVertexArray(), gl.createVertexArray()];
    this.transformFeedbacks = [gl.createTransformFeedback(), gl.createTransformFeedback()];

    this.posBuffers = [gl.createBuffer(), gl.createBuffer()];
    this.prevBuffers = [gl.createBuffer(), gl.createBuffer()];
    this.velBuffers = [gl.createBuffer(), gl.createBuffer()];
    this.lifeBuffers = [gl.createBuffer(), gl.createBuffer()];
    this.seedBuffers = [gl.createBuffer(), gl.createBuffer()];

    for (let i = 0; i < 2; i++) {
      // Allocate VBOs
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, posData, gl.DYNAMIC_COPY);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.prevBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, prevData, gl.DYNAMIC_COPY);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, velData, gl.DYNAMIC_COPY);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, lifeData, gl.DYNAMIC_COPY);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, seedData, gl.DYNAMIC_COPY);

      // Simulation VAO
      gl.bindVertexArray(this.simVaos[i]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffers[i]);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.prevBuffers[i]);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuffers[i]);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffers[i]);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffers[i]);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 0, 0);

      // Transform Feedback target
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedbacks[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.posBuffers[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.prevBuffers[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, this.velBuffers[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, this.lifeBuffers[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 4, this.seedBuffers[i]);

      // Render VAO (Instanced Streamline Lines)
      gl.bindVertexArray(this.renderVaos[i]);

      // Base line vertex
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 0);

      // Instance attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffers[i]);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(1, 1);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.prevBuffers[i]);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(2, 1);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuffers[i]);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(3, 1);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffers[i]);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(4, 1);
    }

    gl.bindVertexArray(null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  }

  initFramebuffers() {
    const gl = this.app.webgl.gl;
    const w = Math.max(1, this.app.webgl.canvas.width);
    const h = Math.max(1, this.app.webgl.canvas.height);

    this.trailTextures = [gl.createTexture(), gl.createTexture()];
    this.trailFbos = [gl.createFramebuffer(), gl.createFramebuffer()];

    const palette = this.app.palette;
    const bgRgb = palette.hexToRGB(palette.customBg);

    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.trailTextures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.trailTextures[i], 0);

      gl.clearColor(bgRgb[0] / 255, bgRgb[1] / 255, bgRgb[2] / 255, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fboIndex = 0;
  }

  resetAllParticles() {
    this.initBuffers();
    this.initFramebuffers();
  }

  update(dt, time) {
    // GPU Transform feedback physics run inside render()
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
    gl.viewport(0, 0, w, h);

    // ==========================================
    // STEP 1: GPU Transform Feedback Simulation
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

    // Run GPU physics pass
    gl.bindVertexArray(this.simVaos[this.readIndex]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedbacks[this.writeIndex]);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.endTransformFeedback();

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    gl.disable(gl.RASTERIZER_DISCARD);

    // ==========================================
    // STEP 2: Render Streamlines to Trail FBO
    // ==========================================
    const readFboIdx = this.fboIndex;
    const writeFboIdx = 1 - this.fboIndex;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[writeFboIdx]);
    gl.viewport(0, 0, w, h);

    // 2a. Fade previous trail texture
    gl.disable(gl.BLEND);
    gl.useProgram(this.trailProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTextures[readFboIdx]);
    gl.uniform1i(gl.getUniformLocation(this.trailProgram, 'u_prevTrail'), 0);
    gl.uniform1f(gl.getUniformLocation(this.trailProgram, 'u_fadeRate'), p.fadeRate);

    const bgRgb = palette.hexToRGB(palette.customBg);
    gl.uniform3f(gl.getUniformLocation(this.trailProgram, 'u_bgColor'), bgRgb[0] / 255, bgRgb[1] / 255, bgRgb[2] / 255);

    // Fullscreen quad fade
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    // 2b. Additive Streamlines
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(this.lineProgram);
    gl.uniform2f(gl.getUniformLocation(this.lineProgram, 'u_resolution'), this.app.width, this.app.height);
    gl.uniform1f(gl.getUniformLocation(this.lineProgram, 'u_glowAlpha'), p.glowAlpha);
    gl.uniform3f(gl.getUniformLocation(this.lineProgram, 'u_palA'), cosParams.a[0], cosParams.a[1], cosParams.a[2]);
    gl.uniform3f(gl.getUniformLocation(this.lineProgram, 'u_palB'), cosParams.b[0], cosParams.b[1], cosParams.b[2]);
    gl.uniform3f(gl.getUniformLocation(this.lineProgram, 'u_palC'), cosParams.c[0], cosParams.c[1], cosParams.c[2]);
    gl.uniform3f(gl.getUniformLocation(this.lineProgram, 'u_palD'), cosParams.d[0], cosParams.d[1], cosParams.d[2]);

    gl.bindVertexArray(this.renderVaos[this.writeIndex]);
    gl.drawArraysInstanced(gl.LINES, 0, 2, count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);

    // ==========================================
    // STEP 3: Blit Trail Texture to Screen
    // ==========================================
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);

    gl.useProgram(this.trailProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTextures[writeFboIdx]);
    gl.uniform1i(gl.getUniformLocation(this.trailProgram, 'u_prevTrail'), 0);
    gl.uniform1f(gl.getUniformLocation(this.trailProgram, 'u_fadeRate'), 0.0); // No fade when presenting to screen
    gl.uniform3f(gl.getUniformLocation(this.trailProgram, 'u_bgColor'), bgRgb[0] / 255, bgRgb[1] / 255, bgRgb[2] / 255);

    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    // Swap indices
    const temp = this.readIndex;
    this.readIndex = this.writeIndex;
    this.writeIndex = temp;

    this.fboIndex = writeFboIdx;
  }

  async renderToCanvas(targetCanvas, width, height) {
    const targetCtx = targetCanvas.getContext('2d');
    targetCtx.drawImage(this.app.webgl.canvas, 0, 0, width, height);
  }
}

window.GPUParticlesMode = GPUParticlesMode;
