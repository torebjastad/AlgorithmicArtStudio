/**
 * Perlin Noise Implementation (Improved Perlin Noise 2D, 3D, 4D)
 * Includes Fractional Brownian Motion (fBm), Turbulence, and Ridged Multifractal
 */

class PerlinNoise {
  constructor(seed = Math.random()) {
    this.reseed(seed);
  }

  reseed(seed) {
    this.seed = seed;
    // PRNG for deterministic permutation generation
    let s = Math.sin(seed) * 10000;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const temp = p[i];
      p[i] = p[j];
      p[j] = temp;
    }

    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  // Quintic fade curve: 6t^5 - 15t^4 + 10t^3
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

  grad2D(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  grad3D(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * 2D Improved Perlin Noise
   * Returns value in range [-1, 1]
   */
  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const A = this.perm[X] + Y;
    const B = this.perm[X + 1] + Y;

    const g00 = this.grad2D(this.perm[A], xf, yf);
    const g10 = this.grad2D(this.perm[B], xf - 1, yf);
    const g01 = this.grad2D(this.perm[A + 1], xf, yf - 1);
    const g11 = this.grad2D(this.perm[B + 1], xf - 1, yf - 1);

    const x1 = this.lerp(g00, g10, u);
    const x2 = this.lerp(g01, g11, u);

    return this.lerp(x1, x2, v);
  }

  /**
   * 3D Improved Perlin Noise
   * Returns value in range [-1, 1]
   */
  noise3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    return this.lerp(
      this.lerp(
        this.lerp(this.grad3D(this.perm[AA], xf, yf, zf), this.grad3D(this.perm[BA], xf - 1, yf, zf), u),
        this.lerp(this.grad3D(this.perm[AB], xf, yf - 1, zf), this.grad3D(this.perm[BB], xf - 1, yf - 1, zf), u),
        v
      ),
      this.lerp(
        this.lerp(this.grad3D(this.perm[AA + 1], xf, yf, zf - 1), this.grad3D(this.perm[BA + 1], xf - 1, yf, zf - 1), u),
        this.lerp(this.grad3D(this.perm[AB + 1], xf, yf - 1, zf - 1), this.grad3D(this.perm[BB + 1], xf - 1, yf - 1, zf - 1), u),
        v
      ),
      w
    );
  }

  /**
   * Fractional Brownian Motion (fBm) 2D
   */
  fbm2D(x, y, octaves = 4, lacunarity = 2.0, persistence = 0.5) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Fractional Brownian Motion (fBm) 3D
   */
  fbm3D(x, y, z, octaves = 4, lacunarity = 2.0, persistence = 0.5) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Turbulence: absolute value summation creating billowy cloud/smoke effects
   */
  turbulence2D(x, y, octaves = 4, lacunarity = 2.0, persistence = 0.5) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += Math.abs(this.noise2D(x * frequency, y * frequency)) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Ridged Multifractal: inverted absolute noise for sharp mountain peaks and lightning
   */
  ridged2D(x, y, octaves = 4, lacunarity = 2.0, persistence = 0.5) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const n = 1.0 - Math.abs(this.noise2D(x * frequency, y * frequency));
      total += n * n * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Inigo Quilez Domain Warping 2D
   * f(p) = fbm(p + fbm(p + fbm(p)))
   */
  domainWarp2D(x, y, octaves = 4, warpIntensity = 1.0, zTime = 0) {
    const qx = this.fbm3D(x, y, zTime, octaves);
    const qy = this.fbm3D(x + 5.2, y + 1.3, zTime + 0.5, octaves);

    const rx = this.fbm3D(x + warpIntensity * qx + 1.7, y + warpIntensity * qy + 9.2, zTime + 1.2, octaves);
    const ry = this.fbm3D(x + warpIntensity * qx + 8.3, y + warpIntensity * qy + 2.8, zTime + 1.7, octaves);

    return this.fbm3D(x + warpIntensity * rx, y + warpIntensity * ry, zTime, octaves);
  }
}

// Global binding
window.PerlinNoise = PerlinNoise;
