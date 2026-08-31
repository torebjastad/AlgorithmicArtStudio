/**
 * WebGL2 GPU Transform Feedback Particle Engine
 * Simulates 100,000 to 1,000,000+ particles at 60-144 FPS
 * 100% computed on GPU via GLSL Vertex Shaders & Transform Feedback.
 */

class GPUParticlesMode {
  constructor(app) {
    this.app = app;
    this.name = '⚡ GPU Cosmic Particles (1M+)';

    this.params = {
      particleCount: 300000,
      noiseType: 'curl',     // 'curl', 'perlin', 'simplex', 'vortex'
      noiseScale: 0.003,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      timeSpeed: 0.003,
      particleSpeed: 2.5,
      pointSize: 2.5,
      glowAlpha: 0.85,
      enableMouse: false,
      mouseForce: 'attract', // 'attract', 'repel', 'swirl'
      mouseRadius: 200,
      mouseStrength: 3.0
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
        vec2 pos = a_pos_life.xy;
        float age = a_pos_life.z + 1.0;
        float maxLife = a_pos_life.w;
        vec2 vel = a_vel_seed.xy;
        vec2 seed = a_vel_seed.zw;

        // Respawn if expired or out of bounds
        if (age >= maxLife || pos.x < -30.0 || pos.x > u_resolution.x + 30.0 || pos.y < -30.0 || pos.y > u_resolution.y + 30.0) {
          pos = vec2(hash3(seed + vec2(u_time, 1.13)).x * u_resolution.x,
                     hash3(seed + vec2(u_time, 2.71)).y * u_resolution.y);
          vel = vec2(0.0);
          age = 0.0;
          maxLife = 60.0 + hash3(seed + vec2(u_time, 3.47)).z * 160.0;
          seed += vec2(0.191, 0.373);
        }

        vec2 np = pos * u_noiseScale;
        vec2 targetVel = vec2(0.0);

        if (u_noiseType == 0) {
          // Divergence-Free Curl Noise
          targetVel = getCurl(np, u_time) * u_particleSpeed * 2.6;
        } else if (u_noiseType == 1) {
          // Perlin Angle
          float angle = fbm(np + vec2(0.05, 0.05) * u_time) * 6.2831853 * 2.0;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed;
        } else if (u_noiseType == 3) {
          // Vortex Spiral
          vec2 center = u_resolution * 0.5;
          float dist = length(pos - center);
          float angle = fbm(np + vec2(0.05, 0.05) * u_time) * 6.2831853 + dist * 0.005;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed;
        } else {
          // Simplex
          float angle = fbm(np * 1.5 + vec2(0.04, 0.04) * u_time) * 6.2831853 * 2.0;
          targetVel = vec2(cos(angle), sin(angle)) * u_particleSpeed;
        }

        // Interactive Mouse Forces
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

        vel = mix(vel, targetVel, 0.18);
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

    // 2. High-Performance Point Glow Render Shader
    const renderVsSource = `#version 300 es
      precision highp float;

      layout(location = 0) in vec4 a_pos_life;
      layout(location = 1) in vec4 a_vel_seed;

      out float v_alpha;
      out float v_colorT;

      uniform vec2 u_resolution;
      uniform float u_pointSize;

      void main() {
        vec2 p = a_pos_life.xy;
        vec2 clipSpace = (p / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

        float lifeRatio = clamp(a_pos_life.z / a_pos_life.w, 0.0, 1.0);
        v_alpha = sin(lifeRatio * 3.14159265);
        v_colorT = fract(lifeRatio + length(a_vel_seed.xy) * 0.08);
        gl_PointSize = max(1.0, u_pointSize * (0.8 + 0.5 * v_alpha));
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
        vec2 coord = gl_PointCoord - vec2(0.5);
        float distSq = dot(coord, coord);
        if (distSq > 0.25) discard;
        float pointGlow = exp(-distSq * 9.0);

        vec3 col = cosinePalette(v_colorT);
        fragColor = vec4(col * (pointGlow * v_alpha * u_glowAlpha), 1.0);
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

    const posLifeData = new Float32Array(n * 4);
    const velSeedData = new Float32Array(n * 4);

    for (let i = 0; i < n; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      const maxLife = 60 + Math.random() * 180;
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
    this.vaos = [gl.createVertexArray(), gl.createVertexArray()];
    this.tfs = [gl.createTransformFeedback(), gl.createTransformFeedback()];

    for (let i = 0; i < 2; i++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posLifeBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, posLifeData, gl.DYNAMIC_COPY);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.velSeedBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, velSeedData, gl.DYNAMIC_COPY);

      gl.bindVertexArray(this.vaos[i]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posLifeBuffers[i]);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.velSeedBuffers[i]);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);

      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tfs[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.posLifeBuffers[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.velSeedBuffers[i]);
    }

    gl.bindVertexArray(null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  }

  resetAllParticles() {
    this.initBuffers();
  }

  update(dt, time) {
    // Handled in GPU pass
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

    // Run GPU physics
    gl.bindVertexArray(this.vaos[this.readIndex]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tfs[this.writeIndex]);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.endTransformFeedback();

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    gl.disable(gl.RASTERIZER_DISCARD);

    // ==========================================
    // STEP 2: Render Particle Points to Screen
    // ==========================================
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // Premultiplied additive light

    const bgRgb = palette.hexToRGB(palette.customBg);
    gl.clearColor(bgRgb[0] / 255, bgRgb[1] / 255, bgRgb[2] / 255, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.renderProgram);
    gl.uniform2f(gl.getUniformLocation(this.renderProgram, 'u_resolution'), this.app.width, this.app.height);
    gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'u_pointSize'), p.pointSize * (this.app.webgl.dpr || 1));
    gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'u_glowAlpha'), p.glowAlpha);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palA'), cosParams.a[0], cosParams.a[1], cosParams.a[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palB'), cosParams.b[0], cosParams.b[1], cosParams.b[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palC'), cosParams.c[0], cosParams.c[1], cosParams.c[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_palD'), cosParams.d[0], cosParams.d[1], cosParams.d[2]);

    gl.bindVertexArray(this.vaos[this.writeIndex]);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);

    // Swap ping-pong buffers
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
