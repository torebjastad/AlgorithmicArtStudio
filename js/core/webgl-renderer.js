/**
 * WebGL2 Hardware Accelerated Shader & Mesh Renderer
 * Robust uniform type dispatching, program caching, VAO/VBO quad buffers, viewport management
 */

class WebGLRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    
    const contextAttributes = {
      alpha: false,
      depth: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    };

    this.gl = this.canvas.getContext('webgl2', contextAttributes) || 
              this.canvas.getContext('webgl', contextAttributes) ||
              this.canvas.getContext('experimental-webgl', contextAttributes);

    if (!this.gl) {
      console.warn('WebGL not supported on this device/browser');
      this.supported = false;
      return;
    }

    this.supported = true;
    this.isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && this.gl instanceof WebGL2RenderingContext;
    this.programs = new Map();
    this.currentProgram = null;

    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.initQuadBuffer();
    this.resize(this.width, this.height, this.dpr);
  }

  initQuadBuffer() {
    const gl = this.gl;
    // Fullscreen quad [-1, -1] to [1, 1]
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);

    this.quadVAO = (this.isWebGL2 && gl.createVertexArray) ? gl.createVertexArray() : null;
    if (this.quadVAO) gl.bindVertexArray(this.quadVAO);

    this.quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    if (this.quadVAO) {
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }
  }

  resize(width, height, dpr = (window.devicePixelRatio || 1)) {
    if (!this.supported) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;

    const displayWidth = Math.max(1, Math.floor(width * this.dpr));
    const displayHeight = Math.max(1, Math.floor(height * this.dpr));

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    this.gl.viewport(0, 0, displayWidth, displayHeight);
  }

  compileShader(source, type) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation error (${type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'}): ${info}`);
    }
    return shader;
  }

  createProgram(name, vertexSource, fragmentSource) {
    const gl = this.gl;
    if (this.programs.has(name)) {
      return this.programs.get(name);
    }

    try {
      const vs = this.compileShader(vertexSource, gl.VERTEX_SHADER);
      const fs = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
      }

      // Query active uniforms and their types
      const uniforms = {};
      const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(program, i);
        const loc = gl.getUniformLocation(program, info.name);
        uniforms[info.name] = {
          location: loc,
          type: info.type,
          size: info.size
        };
      }

      const programObj = {
        program,
        uniforms,
        vs,
        fs
      };

      this.programs.set(name, programObj);
      return programObj;
    } catch (e) {
      console.error(`Failed to create shader program "${name}":`, e);
      return null;
    }
  }

  useProgram(name) {
    if (!this.supported) return null;
    const prog = this.programs.get(name);
    if (prog && this.currentProgram !== prog) {
      this.gl.useProgram(prog.program);
      this.currentProgram = prog;
    }
    return prog;
  }

  renderFullscreenQuad(programName, uniforms = {}) {
    if (!this.supported) return;
    const prog = this.useProgram(programName);
    if (!prog) return;

    const gl = this.gl;

    // Apply uniforms with exact GL type matching
    for (const [key, value] of Object.entries(uniforms)) {
      const uInfo = prog.uniforms[key];
      if (!uInfo || !uInfo.location) continue;

      const loc = uInfo.location;
      const type = uInfo.type;

      if (type === gl.INT || type === gl.BOOL || type === gl.SAMPLER_2D) {
        gl.uniform1i(loc, typeof value === 'boolean' ? (value ? 1 : 0) : Math.round(value));
      } else if (type === gl.FLOAT) {
        gl.uniform1f(loc, value);
      } else if (type === gl.FLOAT_VEC2) {
        gl.uniform2f(loc, value[0], value[1]);
      } else if (type === gl.FLOAT_VEC3) {
        gl.uniform3f(loc, value[0], value[1], value[2]);
      } else if (type === gl.FLOAT_VEC4) {
        gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
      } else if (type === gl.INT_VEC2) {
        gl.uniform2i(loc, value[0], value[1]);
      } else if (type === gl.INT_VEC3) {
        gl.uniform3i(loc, value[0], value[1], value[2]);
      } else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        switch (value.length) {
          case 2: gl.uniform2fv(loc, value); break;
          case 3: gl.uniform3fv(loc, value); break;
          case 4: gl.uniform4fv(loc, value); break;
          case 9: gl.uniformMatrix3fv(loc, false, value); break;
          case 16: gl.uniformMatrix4fv(loc, false, value); break;
        }
      } else if (typeof value === 'number') {
        gl.uniform1f(loc, value);
      }
    }

    if (this.quadVAO) {
      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
      const posLoc = gl.getAttribLocation(prog.program, 'a_position');
      if (posLoc >= 0) {
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
}

window.WebGLRenderer = WebGLRenderer;
