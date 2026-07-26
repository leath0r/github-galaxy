import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Repo } from '../lib/github'
import { useGalaxy } from '../lib/store'
import RepoPlanet from './RepoPlanet'

// deterministic pseudo-random from a string
function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

interface Placed {
  repo: Repo
  position: [number, number, number]
  radius: number
  trending: boolean
}

function layout(repos: Repo[]): Placed[] {
  // group repos by language -> each language becomes a cluster on a big sphere
  const langs = Array.from(new Set(repos.map((r) => r.language || 'Other')))
  const clusterCenter: Record<string, THREE.Vector3> = {}
  const R = 26
  langs.forEach((lang, i) => {
    // golden-spiral distribution of cluster centers
    const y = 1 - (i / Math.max(1, langs.length - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const theta = i * 2.399963
    clusterCenter[lang] = new THREE.Vector3(
      Math.cos(theta) * rad,
      y,
      Math.sin(theta) * rad,
    ).multiplyScalar(R)
  })

  const now = Date.now()
  return repos.map((r) => {
    const lang = r.language || 'Other'
    const c = clusterCenter[lang]
    const hx = hash(r.full_name + 'x') - 0.5
    const hy = hash(r.full_name + 'y') - 0.5
    const hz = hash(r.full_name + 'z') - 0.5
    const spread = 9
    const position: [number, number, number] = [
      c.x + hx * spread,
      c.y + hy * spread,
      c.z + hz * spread,
    ]
    const radius = 0.5 + Math.log10(r.stargazers_count + 10) * 0.42
    const trending = now - new Date(r.pushed_at).getTime() < 7 * 864e5
    return { repo: r, position, radius, trending }
  })
}

// links between the hovered/selected repo and repos sharing language or a topic
function Connections({ placed }: { placed: Placed[] }) {
  const hoveredId = useGalaxy((s) => s.hovered)
  const selectedId = useGalaxy((s) => s.selected?.id)
  const focusId = hoveredId ?? selectedId

  const lines = useMemo(() => {
    if (!focusId) return [] as THREE.Vector3[][]
    const focus = placed.find((p) => p.repo.id === focusId)
    if (!focus) return []
    const ftopics = new Set(focus.repo.topics)
    const related = placed.filter((p) => {
      if (p.repo.id === focusId) return false
      const sameLang = p.repo.language && p.repo.language === focus.repo.language
      const sharedTopic = p.repo.topics.some((t) => ftopics.has(t))
      return sameLang || sharedTopic
    })
    const fp = new THREE.Vector3(...focus.position)
    return related
      .slice(0, 14)
      .map((p) => [fp, new THREE.Vector3(...p.position)])
  }, [focusId, placed])

  if (!lines.length) return null
  return (
    <>
      {lines.map((pts, i) => {
        const geom = new THREE.BufferGeometry().setFromPoints(pts)
        return (
          <line key={i}>
            <primitive object={geom} attach="geometry" />
            <lineBasicMaterial
              color="#8b95ff"
              transparent
              opacity={0.35}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </line>
        )
      })}
    </>
  )
}

// smooth cinematic camera fly-to on select + subtle mouse parallax
function CameraRig({ placed }: { placed: Placed[] }) {
  const selected = useGalaxy((s) => s.selected)
  const controls = useRef<any>(null)
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())
  const flying = useRef(false)

  useFrame((state) => {
    if (selected) {
      const p = placed.find((x) => x.repo.id === selected.id)
      if (p) {
        const planet = new THREE.Vector3(...p.position)
        const dir = planet.clone().normalize()
        targetPos.current.copy(planet).addScaledVector(dir, 6 + p.radius * 2)
        targetLook.current.copy(planet)
        flying.current = true
      }
    }
    if (flying.current) {
      camera.position.lerp(targetPos.current, 0.06)
      if (controls.current) {
        controls.current.target.lerp(targetLook.current, 0.06)
        controls.current.update()
      }
      if (camera.position.distanceTo(targetPos.current) < 0.4) flying.current = false
    } else if (!selected && controls.current) {
      // gentle mouse parallax when idle
      const px = state.pointer.x * 1.5
      const py = state.pointer.y * 1.5
      controls.current.target.lerp(new THREE.Vector3(px, py, 0), 0.02)
      controls.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      minDistance={4}
      maxDistance={90}
      autoRotate={!selected}
      autoRotateSpeed={0.15}
    />
  )
}

export default function Galaxy() {
  const repos = useGalaxy((s) => s.repos)
  const select = useGalaxy((s) => s.select)
  const placed = useMemo(() => layout(repos), [repos])

  return (
    <Canvas
      camera={{ position: [0, 6, 60], fov: 55 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#05060f']} />
      <fog attach="fog" args={['#05060f', 55, 120]} />
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#a78bfa" distance={120} />
      <pointLight position={[40, 30, -20]} intensity={1.2} color="#60a5fa" />

      <Stars radius={140} depth={60} count={6000} factor={4} saturation={0} fade speed={0.6} />

      {placed.map((p) => (
        <RepoPlanet
          key={p.repo.id}
          repo={p.repo}
          position={p.position}
          radius={p.radius}
          trending={p.trending}
        />
      ))}

      <Connections placed={placed} />
      <CameraRig placed={placed} />

      <EffectComposer>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={0.9} />
      </EffectComposer>
    </Canvas>
  )
}
