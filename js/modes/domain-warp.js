/**
 * GLSL Hardware Accelerated Domain Warping Mode
 * Inigo Quilez multi-tiered fBm coordinate warping with normal-based specular lighting,
 * dynamic cosine palette shading, and mouse ripples at 60+ FPS.
 */

class DomainWarpMode {
  constructor(app) {
    this.app = app;
    this.name = 'Domain Warping';

    this.params = {
      scale: 2.5,
      warpIntensity: 2.2,
      octaves: 4,
      persistence: 0.52,
      lacunarity: 2.1,
      timeSpeed: 0.15,
      specularShading: true,
      lightIntensity: 1.2,
      contrast: 1.2,
      brightness: 0.0,
      mouseInfluence: 0.8
    };

    this.programName = 'domain_warp';
    this.initShaders();
  }

  initShaders() {
    if (!this.app.webgl || !this.app.webgl.supported) return;

    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      in vec2 v_uv;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_mouseInfluence;
      uniform float u_scale;
      uniform float u_warpIntensity;
      uniform int u_octaves;
      uniform float u_persistence;
      uniform float u_lacunarity;
      uniform bool u_specular;
      uniform float u_lightIntensity;
      uniform float u_contrast;
      uniform float u_brightness;

      // Inigo Quilez Cosine Palette parameters
      uniform vec3 u_palA;
      uniform vec3 u_palB;
      uniform vec3 u_palC;
      uniform vec3 u_palD;

      // Fast GLSL Pseudo-random Hash
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }

      // 2D Simplex/Perlin-like Gradient Noise
      float noise2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        // Quintic fade
        vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

        return mix(
          mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
              dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
          mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
              dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Fractional Brownian Motion (fBm)
      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));

        for (int i = 0; i < 6; i++) {
          if (i >= u_octaves) break;
          val += amp * noise2D(p * freq);
          p = rot * p * u_lacunarity;
          amp *= u_persistence;
        }
        return val;
      }

      // Domain Warping Pattern: f(p) = fbm(p + fbm(p + fbm(p)))
      float pattern(vec2 p, out vec2 q, out vec2 r, float t) {
        q.x = fbm(p + vec2(0.0, 0.0) + 0.1 * t);
        q.y = fbm(p + vec2(5.2, 1.3) + 0.12 * t);

        r.x = fbm(p + u_warpIntensity * q + vec2(1.7, 9.2) + 0.15 * t);
        r.y = fbm(p + u_warpIntensity * q + vec2(8.3, 2.8) + 0.18 * t);

        return fbm(p + u_warpIntensity * r);
      }

      vec3 cosinePalette(float t) {
        return u_palA + u_palB * cos(6.2831853 * (u_palC * t + u_palD));
      }

      void main() {
        vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        st *= u_scale;

        // Mouse displacement ripple
        vec2 m = (u_mouse - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y) * u_scale;
        float mDist = length(st - m);
        if (mDist < 1.5 && u_mouseInfluence > 0.01) {
          st += normalize(st - m + 0.001) * (1.0 - smoothstep(0.0, 1.5, mDist)) * 0.3 * u_mouseInfluence;
        }

        vec2 q, r;
        float f = pattern(st, q, r, u_time);

        // Normalize f to [0, 1]
        float normF = clamp(f * 0.5 + 0.5, 0.0, 1.0);

        // Dynamic multi-harmonic color mapping
        float colorParam = normF + length(q) * 0.4 - length(r) * 0.2;
        vec3 col = cosinePalette(fract(colorParam));

        // Specular faux-3D normal lighting
        if (u_specular) {
          vec2 eps = vec2(0.005, 0.0);
          vec2 qDummy, rDummy;
          float f_dx = pattern(st + eps.xy, qDummy, rDummy, u_time) - pattern(st - eps.xy, qDummy, rDummy, u_time);
          float f_dy = pattern(st + eps.yx, qDummy, rDummy, u_time) - pattern(st - eps.yx, qDummy, rDummy, u_time);
          vec3 normal = normalize(vec3(-f_dx, -f_dy, eps.x * 4.0));

          vec3 lightDir = normalize(vec3(0.577, 0.577, 0.577));
          float diff = max(dot(normal, lightDir), 0.0);
          float spec = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 16.0);

          col = col * (0.4 + 0.6 * diff * u_lightIntensity) + vec3(1.0) * spec * 0.4 * u_lightIntensity;
        }

        // Contrast & Brightness adjustments
        col = (col - 0.5) * u_contrast + 0.5 + u_brightness;
        col = clamp(col, 0.0, 1.0);

        fragColor = vec4(col, 1.0);
      }
    `;

    this.app.webgl.createProgram(this.programName, vsSource, fsSource);
  }

  update(dt, time) {
    // Mode animation parameters are synced via time in render
  }

  render(renderer) {
    const glRenderer = this.app.webgl;
    if (!glRenderer || !glRenderer.supported) return;

    const p = this.params;
    const palette = this.app.palette;
    const cosParams = palette.current.cosine || {
      a: [0.5, 0.5, 0.5],
      b: [0.5, 0.5, 0.5],
      c: [1.0, 1.0, 1.0],
      d: [0.0, 0.33, 0.67]
    };

    const mouse = this.app.mouse;

    glRenderer.renderFullscreenQuad(this.programName, {
      u_resolution: [glRenderer.canvas.width, glRenderer.canvas.height],
      u_time: this.app.time * p.timeSpeed,
      u_mouse: [mouse.x * glRenderer.dpr, (this.app.height - mouse.y) * glRenderer.dpr],
      u_mouseInfluence: mouse.isDown ? p.mouseInfluence * 2.0 : (mouse.isHovering ? p.mouseInfluence : 0.0),
      u_scale: p.scale,
      u_warpIntensity: p.warpIntensity,
      u_octaves: p.octaves,
      u_persistence: p.persistence,
      u_lacunarity: p.lacunarity,
      u_specular: p.specularShading,
      u_lightIntensity: p.lightIntensity,
      u_contrast: p.contrast,
      u_brightness: p.brightness,
      u_palA: cosParams.a,
      u_palB: cosParams.b,
      u_palC: cosParams.c,
      u_palD: cosParams.d
    });
  }

  async renderToCanvas(targetCanvas, width, height) {
    // Render high-res using offscreen WebGL context
    const offGL = targetCanvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!offGL) return;

    const offRenderer = new WebGLRenderer(targetCanvas);
    offRenderer.createProgram(this.programName, this.app.webgl.programs.get(this.programName).vs, this.app.webgl.programs.get(this.programName).fs);
    offRenderer.resize(width, height, 1.0);

    const p = this.params;
    const palette = this.app.palette;
    const cosParams = palette.current.cosine;

    offRenderer.renderFullscreenQuad(this.programName, {
      u_resolution: [width, height],
      u_time: this.app.time * p.timeSpeed,
      u_mouse: [0, 0],
      u_mouseInfluence: 0.0,
      u_scale: p.scale,
      u_warpIntensity: p.warpIntensity,
      u_octaves: p.octaves + 1, // extra octave for high-res crispness
      u_persistence: p.persistence,
      u_lacunarity: p.lacunarity,
      u_specular: p.specularShading,
      u_lightIntensity: p.lightIntensity,
      u_contrast: p.contrast,
      u_brightness: p.brightness,
      u_palA: cosParams.a,
      u_palB: cosParams.b,
      u_palC: cosParams.c,
      u_palD: cosParams.d
    });
  }
}

window.DomainWarpMode = DomainWarpMode;
