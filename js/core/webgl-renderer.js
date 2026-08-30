/**
 * WebGL2 Hardware Accelerated Shader & Mesh Renderer
 * Supports custom GLSL fragment shaders, quad rendering, and 3D wireframe/shaded terrain
 */

class WebGLRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.gl = this.canvas.getContext('webgl2', {
      alpha: false,
      depth: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    }) || this.canvas.getContext('webgl', {
      alpha: false,
      depth: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });

    if (!this.gl) {
      console.warn('WebGL not supported, falling back to 2D Canvas');
      this.supported = false;
      return;
    }

    this.supported = true;
    this.programs = new Map();
    this.currentProgram = null;

    this.initQuadBuffer();
    this.dpr = window.devicePixelRatio || 1;
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

    this.quadVAO = gl.createVertexArray ? gl.createVertexArray() : null;
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

    const displayWidth = Math.floor(width * this.dpr);
    const displayHeight = Math.floor(height * this.dpr);

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.gl.viewport(0, 0, displayWidth, displayHeight);
    }
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

      // Query active uniforms and attributes
      const uniforms = {};
      const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(program, i);
        uniforms[info.name] = gl.getUniformLocation(program, info.name);
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

    // Apply uniforms
    for (const [key, value] of Object.entries(uniforms)) {
      const loc = prog.uniforms[key];
      if (!loc) continue;

      if (typeof value === 'number') {
        gl.uniform1f(loc, value);
      } else if (typeof value === 'boolean') {
        gl.uniform1i(loc, value ? 1 : 0);
      } else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        switch (value.length) {
          case 2: gl.uniform2fv(loc, value); break;
          case 3: gl.uniform3fv(loc, value); break;
          case 4: gl.uniform4fv(loc, value); break;
          case 9: gl.uniformMatrix3fv(loc, false, value); break;
          case 16: gl.uniformMatrix4fv(loc, false, value); break;
        }
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
