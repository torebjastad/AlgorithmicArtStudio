/**
 * Curl Noise Generator
 * Divergence-free vector field from potential functions
 * Produces fluid-like swirling without particle sinks or clumping
 */

class CurlNoise {
  constructor(noiseGenerator) {
    this.noise = noiseGenerator || new PerlinNoise();
    this.eps = 0.001; // finite difference epsilon
  }

  setNoise(noiseGenerator) {
    this.noise = noiseGenerator;
  }

  /**
   * 2D Curl Noise: computes velocity vector (vx, vy) at (x, y, z)
   * vx =  d(psi)/dy
   * vy = -d(psi)/dx
   */
  curl2D(x, y, z = 0, octaves = 1, lacunarity = 2.0, persistence = 0.5) {
    const eps = this.eps;

    // Potential function: psi(x, y, z)
    const n1 = this.noise.fbm3D ? 
      this.noise.fbm3D(x, y + eps, z, octaves, lacunarity, persistence) :
      this.noise.noise3D(x, y + eps, z);

    const n2 = this.noise.fbm3D ?
      this.noise.fbm3D(x, y - eps, z, octaves, lacunarity, persistence) :
      this.noise.noise3D(x, y - eps, z);

    const n3 = this.noise.fbm3D ?
      this.noise.fbm3D(x + eps, y, z, octaves, lacunarity, persistence) :
      this.noise.noise3D(x + eps, y, z);

    const n4 = this.noise.fbm3D ?
      this.noise.fbm3D(x - eps, y, z, octaves, lacunarity, persistence) :
      this.noise.noise3D(x - eps, y, z);

    const dPsiDy = (n1 - n2) / (2 * eps);
    const dPsiDx = (n3 - n4) / (2 * eps);

    return {
      x: dPsiDy,
      y: -dPsiDx
    };
  }

  /**
   * 3D Curl Noise: computes 3D velocity vector (vx, vy, vz)
   * curl(Psi) = (dPsi_z/dy - dPsi_y/dz, dPsi_x/dz - dPsi_z/dx, dPsi_y/dx - dPsi_x/dy)
   */
  curl3D(x, y, z, octaves = 1) {
    const eps = this.eps;

    // We use 3 independent noise fields offset by arbitrary primes
    const psi_x = (px, py, pz) => this.noise.fbm3D(px + 12.3, py + 45.6, pz + 78.9, octaves);
    const psi_y = (px, py, pz) => this.noise.fbm3D(px + 98.7, py + 65.4, pz + 32.1, octaves);
    const psi_z = (px, py, pz) => this.noise.fbm3D(px + 54.1, py + 19.3, pz + 87.2, octaves);

    const dPy_dz = (psi_y(x, y, z + eps) - psi_y(x, y, z - eps)) / (2 * eps);
    const dPz_dy = (psi_z(x, y + eps, z) - psi_z(x, y - eps, z)) / (2 * eps);

    const dPz_dx = (psi_z(x + eps, y, z) - psi_z(x - eps, y, z)) / (2 * eps);
    const dPx_dz = (psi_x(x, y, z + eps) - psi_x(x, y, z - eps)) / (2 * eps);

    const dPx_dy = (psi_x(x, y + eps, z) - psi_x(x, y - eps, z)) / (2 * eps);
    const dPy_dx = (psi_y(x + eps, y, z) - psi_y(x - eps, y, z)) / (2 * eps);

    return {
      x: dPz_dy - dPy_dz,
      y: dPx_dz - dPz_dx,
      z: dPy_dx - dPx_dy
    };
  }
}

window.CurlNoise = CurlNoise;
