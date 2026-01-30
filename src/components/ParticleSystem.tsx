import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls, folder, button } from 'leva'
import * as THREE from 'three'
import { createNoise3D, createNoise4D } from 'simplex-noise'

const noise3D = createNoise3D()
const noise4D = createNoise4D()

// Vertex shader with multiple animation modes
const vertexShader = `
  uniform float uTime;
  uniform float uSize;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform float uNoiseStrength;
  uniform float uSpiral;
  uniform float uPulse;
  uniform int uMode;
  uniform vec3 uAttractor;
  uniform float uAttractorStrength;
  
  // Starfield uniforms
  uniform float uFieldDepth;
  uniform float uFieldRotation;
  uniform float uSizeRandom;
  uniform float uTwinkleStrength;
  uniform float uTwinkleSpeed;
  
  attribute float aSize;
  attribute vec3 aVelocity;
  attribute float aLife;
  attribute float aSeed;
  attribute vec3 aColor;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vLife;
  
  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  vec3 curl(vec3 p, float t) {
    float eps = 0.01;
    vec3 dx = vec3(eps, 0.0, 0.0);
    vec3 dy = vec3(0.0, eps, 0.0);
    vec3 dz = vec3(0.0, 0.0, eps);
    
    float n1 = snoise(p + dy) - snoise(p - dy);
    float n2 = snoise(p + dz) - snoise(p - dz);
    float n3 = snoise(p + dx) - snoise(p - dx);
    float n4 = snoise(p + dz) - snoise(p - dz);
    float n5 = snoise(p + dx) - snoise(p - dx);
    float n6 = snoise(p + dy) - snoise(p - dy);
    
    return normalize(vec3(n1 - n2, n3 - n4, n5 - n6));
  }
  
  void main() {
    vec3 pos = position;
    float t = uTime * uSpeed;
    float seed = aSeed;
    
    // Mode 0: Galaxy spiral
    if (uMode == 0) {
      float radius = length(pos.xz);
      float angle = atan(pos.z, pos.x);
      float spiralAngle = angle + t * (1.0 / (radius + 0.5)) * uSpiral;
      
      pos.x = cos(spiralAngle) * radius;
      pos.z = sin(spiralAngle) * radius;
      pos.y += sin(t * 2.0 + radius) * 0.3 * uPulse;
      
      // Add noise displacement
      vec3 noisePos = pos * uNoiseScale + t * 0.1;
      pos += curl(noisePos, t) * uNoiseStrength;
    }
    
    // Mode 1: Flow field
    else if (uMode == 1) {
      vec3 noisePos = position * uNoiseScale;
      vec3 flowDir = curl(noisePos + t * 0.2, t);
      pos += flowDir * uNoiseStrength * sin(t + seed * 6.28);
      
      // Orbital motion
      float orbitSpeed = t * uSpeed * (0.5 + seed * 0.5);
      float orbitRadius = length(pos.xz);
      pos.x += sin(orbitSpeed + seed * 6.28) * 0.5;
      pos.z += cos(orbitSpeed + seed * 6.28) * 0.5;
    }
    
    // Mode 2: Explosion/Implosion
    else if (uMode == 2) {
      vec3 dir = normalize(position);
      float phase = mod(t + seed, 4.0);
      float expand = sin(phase * 3.14159 * 0.5);
      
      pos = dir * (length(position) + expand * uNoiseStrength * 10.0);
      
      // Add turbulence
      vec3 noisePos = pos * uNoiseScale * 0.5;
      pos += curl(noisePos, t) * uNoiseStrength * 0.5;
    }
    
    // Mode 3: Swarm / Attractor
    else if (uMode == 3) {
      vec3 toAttractor = uAttractor - pos;
      float dist = length(toAttractor);
      vec3 attractDir = normalize(toAttractor);
      
      // Orbit around attractor
      float orbitAngle = t * uSpeed + seed * 6.28;
      vec3 orbitOffset = vec3(
        cos(orbitAngle) * sin(seed * 6.28),
        sin(orbitAngle * 0.7) * 0.5,
        sin(orbitAngle) * cos(seed * 6.28)
      ) * (2.0 + seed * 3.0);
      
      pos = mix(pos, uAttractor + orbitOffset, uAttractorStrength * 0.02);
      
      // Add noise
      vec3 noisePos = pos * uNoiseScale;
      pos += curl(noisePos, t) * uNoiseStrength * 0.5;
    }
    
    // Mode 4: DNA Helix
    else if (uMode == 4) {
      // Use seed to determine particle role
      // 0.0-0.45 = strand A, 0.45-0.9 = strand B, 0.9-1.0 = rungs
      float role = seed;
      
      // Helix parameters
      float helixRadius = 8.0;  // Larger radius for visibility
      float twistRate = 0.4 * uSpiral;  // Rotations per unit Y
      float scrollSpeed = t * uSpeed * 0.5;
      
      // Use original Y position spread across helix height
      float baseY = position.y;  // Already distributed -20 to 20
      float y = baseY;
      
      // Breathing effect
      float breathe = 1.0 + sin(t * 2.0) * 0.1 * uPulse;
      float radius = helixRadius * breathe;
      
      if (role < 0.45) {
        // STRAND A - first helix strand
        float angle = y * twistRate + scrollSpeed;
        
        pos.x = cos(angle) * radius;
        pos.z = sin(angle) * radius;
        pos.y = y;
        
        // Thickness variation
        float thick = 0.5 * (0.5 + seed * 0.5);
        pos.x += cos(angle + 1.57) * thick;
        pos.z += sin(angle + 1.57) * thick;
        
        vAlpha = aLife * (0.7 + sin(y * 0.5 - t * 3.0) * 0.3);
      }
      else if (role < 0.9) {
        // STRAND B - second helix strand (offset by PI)
        float angle = y * twistRate + scrollSpeed + 3.14159;
        
        pos.x = cos(angle) * radius;
        pos.z = sin(angle) * radius;
        pos.y = y;
        
        // Thickness variation
        float thick = 0.5 * (0.5 + seed * 0.5);
        pos.x += cos(angle + 1.57) * thick;
        pos.z += sin(angle + 1.57) * thick;
        
        vAlpha = aLife * (0.7 + sin(y * 0.5 - t * 3.0 + 1.57) * 0.3);
      }
      else {
        // RUNGS - connecting bars between strands
        // Place rungs at regular Y intervals
        float rungSpacing = 3.0;
        float rungIndex = floor((seed - 0.9) * 100.0);  // 0-9 rungs
        float rungY = mod(rungIndex * rungSpacing - 15.0, 30.0) - 15.0;
        
        float rungAngle = rungY * twistRate + scrollSpeed;
        
        // Position along the rung (0 to 1)
        float rungPos = fract(seed * 73.0);
        
        // Interpolate between strand A and strand B positions
        float angleA = rungAngle;
        float angleB = rungAngle + 3.14159;
        
        pos.x = mix(cos(angleA), cos(angleB), rungPos) * radius;
        pos.z = mix(sin(angleA), sin(angleB), rungPos) * radius;
        pos.y = rungY;
        
        // Rungs brighter
        vAlpha = aLife * 0.9;
      }
      
      // Slow rotation of entire helix
      float rot = t * 0.2;
      float rx = pos.x * cos(rot) - pos.z * sin(rot);
      float rz = pos.x * sin(rot) + pos.z * cos(rot);
      pos.x = rx;
      pos.z = rz;
    }
    
    // Mode 5: Star Field - 3D volume starfield
    else if (uMode == 5) {
      // Stars already distributed in 3D volume, use position directly
      pos = position * uFieldDepth;
      
      // Hash for per-star randomness (consistent per star)
      float hash1 = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
      float hash2 = fract(sin(dot(position.yz, vec2(39.346, 11.135))) * 43758.5453);
      float hash3 = fract(sin(dot(position.xz, vec2(73.156, 52.235))) * 43758.5453);
      
      // Slow rotation of entire starfield
      float rotX = t * uFieldRotation * 0.1;
      float rotY = t * uFieldRotation * 0.15;
      
      // Rotate around Y axis
      float rx = pos.x * cos(rotY) - pos.z * sin(rotY);
      float rz = pos.x * sin(rotY) + pos.z * cos(rotY);
      pos.x = rx;
      pos.z = rz;
      
      // Rotate around X axis
      float ry = pos.y * cos(rotX) - pos.z * sin(rotX);
      rz = pos.y * sin(rotX) + pos.z * cos(rotX);
      pos.y = ry;
      pos.z = rz;
      
      // Size variation controlled by uSizeRandom
      // 0 = all same size, 1 = full random distribution (small to large)
      float baseSize = 1.0;
      float randomSize = 0.2 + pow(hash1, 2.5) * 1.8;  // Distribution favoring smaller
      float sizeFactor = mix(baseSize, randomSize, uSizeRandom);
      
      // Brightness variation
      float brightness = 0.6 + hash2 * 0.4;
      
      // Twinkling - controlled by strength and speed
      // Each star has unique phase and slightly different frequency
      float twinklePhase = hash3 * 6.28318;
      float twinkleFreq = uTwinkleSpeed * (0.8 + hash1 * 0.4);
      float twinkleWave = sin(t * twinkleFreq + twinklePhase);
      // Strength: 0 = no twinkle (always 1), 1 = full twinkle (0.3 to 1.0)
      float twinkle = 1.0 - uTwinkleStrength * 0.7 * (0.5 - 0.5 * twinkleWave);
      
      // Distance fade - stars further from camera slightly dimmer
      float dist = length(pos);
      float distFade = 1.0 - smoothstep(uFieldDepth * 0.5, uFieldDepth, dist);
      distFade = max(distFade, 0.2);
      
      // Combine all factors
      vAlpha = brightness * twinkle * distFade * aLife;
      
      // Override point size for size variation
      gl_PointSize = aSize * uSize * sizeFactor * (300.0 / length((modelViewMatrix * vec4(pos, 1.0)).xyz));
    }
    
    // Apply pulse (skip for helix and starfield - they handle their own)
    if (uMode != 4 && uMode != 5) {
      float pulse = 1.0 + sin(t * 3.0 + length(position)) * uPulse * 0.1;
      pos *= pulse;
      vAlpha = aLife;
    }
    
    // Calculate size with distance attenuation (skip for starfield - handles its own)
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    if (uMode != 5) {
      float sizeAtten = 300.0 / -mvPosition.z;
      gl_PointSize = aSize * uSize * sizeAtten;
    }
    
    gl_Position = projectionMatrix * mvPosition;
    
    // Pass to fragment
    vColor = aColor;
    vLife = aLife;
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform int uShape;
  uniform float uGlow;
  uniform vec3 uBaseColor;
  uniform float uColorMix;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vLife;
  
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    
    // Discard outside circle
    if (dist > 0.5) discard;
    
    float alpha = 1.0;
    
    // Shape 0: Soft circle
    if (uShape == 0) {
      alpha = 1.0 - smoothstep(0.0, 0.5, dist);
      alpha = pow(alpha, 1.5);
    }
    // Shape 1: Ring
    else if (uShape == 1) {
      float ring = smoothstep(0.3, 0.35, dist) * (1.0 - smoothstep(0.45, 0.5, dist));
      float core = 1.0 - smoothstep(0.0, 0.15, dist);
      alpha = ring + core * 0.5;
    }
    // Shape 2: Star
    else if (uShape == 2) {
      float angle = atan(uv.y, uv.x);
      float star = 0.3 + 0.2 * sin(angle * 5.0 + uTime * 2.0);
      alpha = 1.0 - smoothstep(star * 0.8, star, dist);
    }
    // Shape 3: Square
    else if (uShape == 3) {
      vec2 absUv = abs(uv);
      float box = max(absUv.x, absUv.y);
      alpha = 1.0 - smoothstep(0.3, 0.4, box);
    }
    
    // Add glow
    float glow = exp(-dist * 4.0) * uGlow;
    alpha += glow;
    
    // Mix colors
    vec3 finalColor = mix(uBaseColor, vColor, uColorMix);
    
    // Add core brightness
    finalColor += vec3(1.0 - smoothstep(0.0, 0.2, dist)) * 0.5;
    
    gl_FragColor = vec4(finalColor, alpha * vAlpha);
  }
`

type Mode = 'galaxy' | 'flowfield' | 'explosion' | 'swarm' | 'helix' | 'starfield'

const modeMap: Record<Mode, number> = {
  galaxy: 0,
  flowfield: 1,
  explosion: 2,
  swarm: 3,
  helix: 4,
  starfield: 5,
}

const colorPresets = {
  cyber: { base: '#00ffff', colors: ['#00ffff', '#ff00ff', '#00ff00'] },
  fire: { base: '#ff4400', colors: ['#ff0000', '#ff8800', '#ffff00'] },
  ice: { base: '#4488ff', colors: ['#0044ff', '#00ffff', '#ffffff'] },
  toxic: { base: '#00ff44', colors: ['#00ff00', '#88ff00', '#ffff00'] },
  void: { base: '#8800ff', colors: ['#4400ff', '#ff00ff', '#ff0088'] },
  stars: { base: '#ffffff', colors: ['#ffffff', '#aaccff', '#ffe4b5', '#ffcc99', '#ff8866'] },
}

export function ParticleSystem() {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  
  const {
    count,
    mode,
    colorPreset,
    size,
    speed,
    noiseScale,
    noiseStrength,
    spiral,
    pulse,
    shape,
    additiveBlend,
    glow,
    colorMix,
    spread,
    fieldDepth,
    fieldRotation,
    sizeRandom,
    twinkleStrength,
    twinkleSpeed,
  } = useControls('Particles', {
    count: { value: 50000, min: 1000, max: 200000, step: 1000 },
    mode: { value: 'galaxy' as Mode, options: ['galaxy', 'flowfield', 'explosion', 'swarm', 'helix', 'starfield'] },
    colorPreset: { value: 'cyber', options: Object.keys(colorPresets) },
    spread: { value: 15, min: 5, max: 50, step: 1 },
    
    [' Appearance']: folder({
      size: { value: 0.1, min: 0.1, max: 5, step: 0.1 },
      shape: { value: 0, min: 0, max: 3, step: 1, label: 'shape (0-3)' },
      additiveBlend: { value: false, label: 'Additive Glow' },
      glow: { value: 0, min: 0, max: 2, step: 0.1 },
      colorMix: { value: 0.7, min: 0, max: 1, step: 0.05 },
    }, { collapsed: false }),
    
    ['Animation']: folder({
      speed: { value: 0.5, min: 0, max: 3, step: 0.1 },
      noiseScale: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
      noiseStrength: { value: 2.0, min: 0, max: 10, step: 0.1 },
      spiral: { value: 2.0, min: 0, max: 10, step: 0.1 },
      pulse: { value: 0.5, min: 0, max: 2, step: 0.1 },
    }, { collapsed: false }),
    
    ['Starfield']: folder({
      fieldDepth: { value: 50.0, min: 10, max: 150, step: 5, label: 'Field Size' },
      fieldRotation: { value: 0.3, min: 0, max: 2, step: 0.05, label: 'Rotation' },
      sizeRandom: { value: 0.5, min: 0, max: 1, step: 0.05, label: 'Size Variation' },
      twinkleStrength: { value: 0.5, min: 0, max: 1, step: 0.05, label: 'Twinkle Strength' },
      twinkleSpeed: { value: 1.0, min: 0.1, max: 5, step: 0.1, label: 'Twinkle Speed' },
    }, { collapsed: false }),
  })
  
  const { attractorX, attractorY, attractorZ, attractorStrength } = useControls('Attractor', {
    attractorX: { value: 0, min: -20, max: 20, step: 0.5 },
    attractorY: { value: 0, min: -20, max: 20, step: 0.5 },
    attractorZ: { value: 0, min: -20, max: 20, step: 0.5 },
    attractorStrength: { value: 0.5, min: 0, max: 1, step: 0.05 },
  }, { collapsed: false })
  
  // Generate particle attributes
  const { positions, sizes, velocities, lives, seeds, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const velocities = new Float32Array(count * 3)
    const lives = new Float32Array(count)
    const seeds = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    
    const preset = colorPresets[colorPreset as keyof typeof colorPresets]
    const colorObjects = preset.colors.map(c => new THREE.Color(c))
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      
      // Distribute based on mode
      if (mode === 'galaxy') {
        // Disc distribution with thickness variation
        const radius = Math.pow(Math.random(), 0.5) * spread
        const angle = Math.random() * Math.PI * 2
        const heightVariation = (Math.random() - 0.5) * 2 * (1 - radius / spread)
        
        positions[i3] = Math.cos(angle) * radius
        positions[i3 + 1] = heightVariation * 2
        positions[i3 + 2] = Math.sin(angle) * radius
      } else if (mode === 'helix') {
        // Uniform vertical distribution for helix infinite scroll
        // Y spans -20 to 20 for smooth wrapping
        positions[i3] = (Math.random() - 0.5) * 8  // Initial X spread (shader overrides)
        positions[i3 + 1] = (Math.random() - 0.5) * 40  // Full height range
        positions[i3 + 2] = (Math.random() - 0.5) * 8  // Initial Z spread (shader overrides)
      } else if (mode === 'starfield') {
        // 3D volume distribution (cube spread) - like drei Stars
        // randFloatSpread equivalent: random in range [-1, 1]
        positions[i3] = (Math.random() - 0.5) * 2
        positions[i3 + 1] = (Math.random() - 0.5) * 2
        positions[i3 + 2] = (Math.random() - 0.5) * 2
      } else {
        // Sphere distribution for others
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const radius = Math.pow(Math.random(), 0.3) * spread
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = radius * Math.cos(phi)
      }
      
      // Random velocity
      velocities[i3] = (Math.random() - 0.5) * 2
      velocities[i3 + 1] = (Math.random() - 0.5) * 2
      velocities[i3 + 2] = (Math.random() - 0.5) * 2
      
      // Size variation
      sizes[i] = 0.5 + Math.random() * 1.5
      
      // Life and seed
      lives[i] = 0.5 + Math.random() * 0.5
      seeds[i] = Math.random()
      
      // Color from preset
      const colorIndex = Math.floor(Math.random() * colorObjects.length)
      const color = colorObjects[colorIndex]
      colors[i3] = color.r
      colors[i3 + 1] = color.g
      colors[i3 + 2] = color.b
    }
    
    return { positions, sizes, velocities, lives, seeds, colors }
  }, [count, mode, colorPreset, spread])
  
  // Update uniforms
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uAttractor.value.set(attractorX, attractorY, attractorZ)
    }
  })
  
  // Update material uniforms when controls change
  useEffect(() => {
    if (materialRef.current) {
      const preset = colorPresets[colorPreset as keyof typeof colorPresets]
      materialRef.current.uniforms.uBaseColor.value.set(preset.base)
      materialRef.current.uniforms.uSize.value = size
      materialRef.current.uniforms.uSpeed.value = speed
      materialRef.current.uniforms.uNoiseScale.value = noiseScale
      materialRef.current.uniforms.uNoiseStrength.value = noiseStrength
      materialRef.current.uniforms.uSpiral.value = spiral
      materialRef.current.uniforms.uPulse.value = pulse
      materialRef.current.uniforms.uMode.value = modeMap[mode]
      materialRef.current.uniforms.uShape.value = shape
      materialRef.current.uniforms.uGlow.value = glow
      materialRef.current.uniforms.uColorMix.value = colorMix
      materialRef.current.uniforms.uAttractorStrength.value = attractorStrength
      materialRef.current.uniforms.uFieldDepth.value = fieldDepth
      materialRef.current.uniforms.uFieldRotation.value = fieldRotation
      materialRef.current.uniforms.uSizeRandom.value = sizeRandom
      materialRef.current.uniforms.uTwinkleStrength.value = twinkleStrength
      materialRef.current.uniforms.uTwinkleSpeed.value = twinkleSpeed
    }
  }, [size, speed, noiseScale, noiseStrength, spiral, pulse, mode, shape, glow, colorMix, colorPreset, attractorStrength, fieldDepth, fieldRotation, sizeRandom, twinkleStrength, twinkleSpeed])
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSize: { value: size },
    uSpeed: { value: speed },
    uNoiseScale: { value: noiseScale },
    uNoiseStrength: { value: noiseStrength },
    uSpiral: { value: spiral },
    uPulse: { value: pulse },
    uMode: { value: modeMap[mode] },
    uShape: { value: shape },
    uGlow: { value: glow },
    uBaseColor: { value: new THREE.Color(colorPresets[colorPreset as keyof typeof colorPresets].base) },
    uColorMix: { value: colorMix },
    uAttractor: { value: new THREE.Vector3(attractorX, attractorY, attractorZ) },
    uAttractorStrength: { value: attractorStrength },
    uFieldDepth: { value: fieldDepth },
    uFieldRotation: { value: fieldRotation },
    uSizeRandom: { value: sizeRandom },
    uTwinkleStrength: { value: twinkleStrength },
    uTwinkleSpeed: { value: twinkleSpeed },
  }), [])
  
  return (
    <points ref={pointsRef} key={`stars-${count}-${mode}`}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aVelocity"
          count={count}
          array={velocities}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aLife"
          count={count}
          array={lives}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          count={count}
          array={seeds}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={additiveBlend ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  )
}
