/**
 * Curated Artistic Presets for Perlin Noise Studio
 * 20+ master handcrafted presets spanning all generative modes
 */

const ART_PRESETS = [
  {
    id: 'cyberpunk_flow',
    name: '⚡ Cyberpunk Currents',
    mode: 'flow',
    palette: 'cyberpunk',
    params: {
      particleCount: 12000,
      noiseType: 'curl',
      noiseScale: 0.0035,
      octaves: 3,
      persistence: 0.5,
      particleSpeed: 3.2,
      strokeWidth: 1.8,
      taperWidth: true,
      fadeRate: 0.04,
      blendMode: 'lighter',
      timeSpeed: 0.003
    }
  },
  {
    id: 'cosmic_nebula',
    name: '🌌 Deep Nebula',
    mode: 'domain_warp',
    palette: 'nebula',
    params: {
      scale: 2.8,
      warpIntensity: 2.6,
      octaves: 5,
      persistence: 0.54,
      lacunarity: 2.1,
      timeSpeed: 0.12,
      specularShading: true,
      lightIntensity: 1.4,
      contrast: 1.3
    }
  },
  {
    id: 'bioluminescent_ocean',
    name: '🌊 Abyssal Glow',
    mode: 'flow',
    palette: 'bioluminescent',
    params: {
      particleCount: 16000,
      noiseType: 'curl',
      noiseScale: 0.0028,
      octaves: 4,
      persistence: 0.55,
      particleSpeed: 2.2,
      strokeWidth: 2.0,
      taperWidth: true,
      fadeRate: 0.035,
      blendMode: 'lighter',
      timeSpeed: 0.002
    }
  },
  {
    id: 'sumie_ink',
    name: '🖋️ Japanese Sumi-e',
    mode: 'flow',
    palette: 'sumie',
    params: {
      particleCount: 7000,
      noiseType: 'simplex',
      noiseScale: 0.0022,
      octaves: 4,
      persistence: 0.45,
      particleSpeed: 2.8,
      strokeWidth: 2.5,
      taperWidth: true,
      fadeRate: 0.06,
      blendMode: 'source-over',
      timeSpeed: 0.0015
    }
  },
  {
    id: 'obsidian_gold',
    name: '✨ Obsidian & Gold',
    mode: 'domain_warp',
    palette: 'obsidianGold',
    params: {
      scale: 3.2,
      warpIntensity: 3.0,
      octaves: 5,
      persistence: 0.5,
      lacunarity: 2.2,
      timeSpeed: 0.18,
      specularShading: true,
      lightIntensity: 1.6,
      contrast: 1.4
    }
  },
  {
    id: 'topo_emerald',
    name: '🗺️ Alpine Topography',
    mode: 'topographic',
    palette: 'emeraldForest',
    params: {
      scale: 0.0035,
      octaves: 4,
      persistence: 0.52,
      lacunarity: 2.0,
      contourLevels: 28,
      strokeWidth: 1.6,
      majorIndexInterval: 5,
      majorStrokeMultiplier: 2.5,
      fillBands: true,
      glowEffect: false,
      timeSpeed: 0.002
    }
  },
  {
    id: 'synthwave_grid',
    name: '🌆 Retro 1984 Horizon',
    mode: 'terrain3d',
    palette: 'synthwave',
    params: {
      gridCols: 75,
      gridRows: 55,
      noiseScale: 0.04,
      octaves: 4,
      persistence: 0.5,
      heightMultiplier: 240,
      flySpeed: 2.0,
      renderStyle: 'wireframe',
      strokeWidth: 1.5,
      ridgedPeaks: true
    }
  },
  {
    id: 'silk_ribbons',
    name: '🎀 Ethereal Silk',
    mode: 'ribbons',
    palette: 'vaporwave',
    params: {
      ribbonCount: 20,
      segments: 120,
      scale: 0.0025,
      octaves: 3,
      persistence: 0.5,
      strokeWidth: 2.2,
      ribbonWidth: 60,
      amplitude: 180,
      timeSpeed: 0.008,
      blendMode: 'screen',
      wireframe: false
    }
  },
  {
    id: 'solar_inferno',
    name: '🔥 Solar Prominence',
    mode: 'domain_warp',
    palette: 'solarFlare',
    params: {
      scale: 2.4,
      warpIntensity: 2.8,
      octaves: 4,
      persistence: 0.55,
      timeSpeed: 0.22,
      specularShading: true,
      lightIntensity: 1.5,
      contrast: 1.35
    }
  },
  {
    id: 'aurora_borealis',
    name: '🌌 Arctic Aurora',
    mode: 'flow',
    palette: 'aurora',
    params: {
      particleCount: 14000,
      noiseType: 'curl',
      noiseScale: 0.002,
      octaves: 3,
      particleSpeed: 2.4,
      strokeWidth: 2.0,
      fadeRate: 0.03,
      blendMode: 'lighter',
      timeSpeed: 0.0025
    }
  },
  {
    id: 'quantum_foam',
    name: '⚛️ Quantum Foam',
    mode: 'flow',
    palette: 'quantumFoam',
    params: {
      particleCount: 25000,
      noiseType: 'vortex',
      noiseScale: 0.005,
      octaves: 5,
      particleSpeed: 3.5,
      strokeWidth: 1.0,
      fadeRate: 0.05,
      blendMode: 'lighter',
      timeSpeed: 0.004
    }
  },
  {
    id: 'toxic_glitch',
    name: '🧪 Acid Matrix',
    mode: 'domain_warp',
    palette: 'acidToxic',
    params: {
      scale: 3.8,
      warpIntensity: 3.5,
      octaves: 6,
      persistence: 0.6,
      timeSpeed: 0.25,
      specularShading: true,
      lightIntensity: 1.8,
      contrast: 1.5
    }
  }
];

window.ART_PRESETS = ART_PRESETS;
