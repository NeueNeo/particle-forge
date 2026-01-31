import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, SMAA, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { Leva, useControls } from 'leva'
import { Suspense } from 'react'
import * as THREE from 'three'
import { ParticleSystem } from './components/ParticleSystem'
import './App.css'

// Clear Leva's persisted state on load
if (typeof window !== 'undefined') {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('leva')) localStorage.removeItem(key)
  })
}

function Effects() {
  const { enabled, bloomIntensity, bloomThreshold, chromaticOffset } = useControls('Post Processing', {
    enabled: { value: false, label: 'Enable' },
    bloomIntensity: { value: 0, min: 0, max: 5, step: 0.1 },
    bloomThreshold: { value: 0.5, min: 0, max: 1, step: 0.05 },
    chromaticOffset: { value: 0, min: 0, max: 0.01, step: 0.001 },
  }, { collapsed: false })

  if (!enabled) return null

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <SMAA />
      <Bloom
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.9}
        intensity={bloomIntensity}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(chromaticOffset, chromaticOffset)}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

function App() {
  const { bgColor, showStats } = useControls('Scene', {
    bgColor: '#030308',
    showStats: false,
  }, { collapsed: false })

  return (
    <div className="app">
      <Leva collapsed={true} oneLineLabels />
      <Canvas
        camera={{ position: [0, 0, 30], fov: 60, near: 0.1, far: 2000 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          logarithmicDepthBuffer: true,
        }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1
        }}
      >
        <color attach="background" args={[bgColor]} />
        
        <Suspense fallback={null}>
          <ParticleSystem />
        </Suspense>
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
        />
        
        <Effects />
        {showStats && <Stats />}
      </Canvas>
      
{/* Title hidden */}
    </div>
  )
}

export default App
