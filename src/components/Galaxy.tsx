import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Repo } from '../lib/github'
import { useGalaxy } from '../lib/store'
import RepoPlanet, { type Orbit } from './RepoPlanet'

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
  orbit: Orbit
}

// Lay repos out along logarithmic spiral arms — a real galaxy shape.
function layout(repos: Repo[]): Placed[] {
  const ranked = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count)
  const total = ranked.length
  const ARMS = 4
  const WIND = 3.4 // how tightly arms wind
  const RMIN = 4
  const RMAX = 46

  return ranked.map((repo, rank) => {
    const h1 = hash(repo.full_name + 'a')
    const h2 = hash(repo.full_name + 'b')
    const h3 = hash(repo.full_name + 'c')
    const h4 = hash(repo.full_name + 'd')

    // denser toward core: sqrt distribution, most-starred repos near center
    const norm = rank / Math.max(1, total - 1)
    const r = RMIN + (RMAX - RMIN) * Math.sqrt(norm) + (h1 - 0.5) * 4

    const arm = rank % ARMS
    const armAngle = (arm / ARMS) * Math.PI * 2
    // logarithmic-ish winding + per-repo angular scatter (tighter near core)
    const scatter = (h2 - 0.5) * (0.5 + (1 - norm) * 0.6)
    const a0 = armAngle + Math.log(r + 1) * (WIND / 4) + scatter

    // disk thickness: thick bulge in the core, thin at the rim
    const thickness = 2.6 * Math.exp(-r / 22)
    const y = (h3 - 0.5) * thickness * 2 + (h4 - 0.5) * 1.2

    const size = 0.45 + Math.log10(repo.stargazers_count + 10) * 0.4
    // differential rotation: inner orbits faster (Keplerian-ish)
    const speed = (0.14 / Math.sqrt(r)) * 1.0
    const trending = Date.now() - new Date(repo.pushed_at).getTime() < 7 * 864e5

    return {
      repo,
      orbit: { r, a0, y, speed, phase: h1 * Math.PI * 2, size, trending },
    }
  })
}

// Glowing galactic core.
function Core() {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((s) => {
    const p = 1 + Math.sin(s.clock.elapsedTime * 0.8) * 0.06
    ref.current.scale.setScalar(p)
  })
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[3.2, 32, 32]} />
        <meshBasicMaterial color="#fef3ff" transparent opacity={0.9} />
      </mesh>
      <mesh>
        <sphereGeometry args={[6, 32, 32]} />
        <meshBasicMaterial
          color="#c4b5fd"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[11, 32, 32]} />
        <meshBasicMaterial
          color="#7c3aed"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#e9d5ff" intensity={4} distance={140} decay={1.4} />
    </group>
  )
}

// Backdrop nebula — radial gradient painted on a big inverted sphere.
function Nebula() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 1024
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#04030a'
    ctx.fillRect(0, 0, 1024, 1024)
    const blobs: [number, number, number, string][] = [
      [320, 380, 460, 'rgba(88,28,135,0.55)'],
      [720, 300, 380, 'rgba(30,64,175,0.45)'],
      [600, 720, 500, 'rgba(126,34,206,0.4)'],
      [200, 760, 340, 'rgba(14,116,144,0.35)'],
      [820, 820, 300, 'rgba(162,28,175,0.3)'],
    ]
    for (const [x, y, rad, col] of blobs) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, col)
      g.addColorStop(1, 'rgba(4,3,10,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 1024, 1024)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[200, 32, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  )
}

// Live connection lines from the focused planet to related repos.
function Connections({
  placed,
  posMap,
}: {
  placed: Placed[]
  posMap: React.MutableRefObject<Map<number, THREE.Vector3>>
}) {
  const hoveredId = useGalaxy((s) => s.hovered)
  const selectedId = useGalaxy((s) => s.selected?.id)
  const focusId = hoveredId ?? selectedId
  const geom = useRef(new THREE.BufferGeometry())
  const lineRef = useRef<THREE.LineSegments>(null!)

  const relatedIds = useMemo(() => {
    if (!focusId) return [] as number[]
    const focus = placed.find((p) => p.repo.id === focusId)
    if (!focus) return []
    const ftopics = new Set(focus.repo.topics)
    return placed
      .filter((p) => {
        if (p.repo.id === focusId) return false
        const sameLang = p.repo.language && p.repo.language === focus.repo.language
        const sharedTopic = p.repo.topics.some((t) => ftopics.has(t))
        return sameLang || sharedTopic
      })
      .slice(0, 16)
      .map((p) => p.repo.id)
  }, [focusId, placed])

  useFrame(() => {
    if (!focusId || relatedIds.length === 0) {
      lineRef.current.visible = false
      return
    }
    const fp = posMap.current.get(focusId)
    if (!fp) return
    const pts: number[] = []
    for (const id of relatedIds) {
      const p = posMap.current.get(id)
      if (!p) continue
      pts.push(fp.x, fp.y, fp.z, p.x, p.y, p.z)
    }
    geom.current.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    geom.current.attributes.position.needsUpdate = true
    geom.current.setDrawRange(0, pts.length / 3)
    lineRef.current.visible = true
  })

  return (
    <lineSegments ref={lineRef}>
      <primitive object={geom.current} attach="geometry" />
      <lineBasicMaterial
        color="#a5b4fc"
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  )
}

// Cinematic camera: fly to selected planet (live position) + idle parallax.
function CameraRig({ posMap }: { posMap: React.MutableRefObject<Map<number, THREE.Vector3>> }) {
  const selected = useGalaxy((s) => s.selected)
  const controls = useRef<any>(null)
  const { camera } = useThree()
  const tPos = useRef(new THREE.Vector3())
  const tLook = useRef(new THREE.Vector3())

  useFrame((state) => {
    if (selected) {
      const p = posMap.current.get(selected.id)
      if (p) {
        const dir = p.clone().normalize()
        tPos.current.copy(p).addScaledVector(dir, 7).add(new THREE.Vector3(0, 2, 0))
        tLook.current.copy(p)
        camera.position.lerp(tPos.current, 0.05)
        if (controls.current) {
          controls.current.target.lerp(tLook.current, 0.08)
          controls.current.update()
        }
      }
    } else if (controls.current) {
      const px = state.pointer.x * 2
      const py = state.pointer.y * 2
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
      minDistance={5}
      maxDistance={110}
    />
  )
}

export default function Galaxy() {
  const repos = useGalaxy((s) => s.repos)
  const select = useGalaxy((s) => s.select)
  const placed = useMemo(() => layout(repos), [repos])
  const posMap = useRef<Map<number, THREE.Vector3>>(new Map())

  return (
    <Canvas
      camera={{ position: [0, 24, 72], fov: 55 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#04030a']} />
      <fog attach="fog" args={['#04030a', 70, 150]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[50, 40, -30]} intensity={1.0} color="#60a5fa" />

      <Nebula />
      <Stars radius={160} depth={70} count={7000} factor={4.5} saturation={0} fade speed={0.5} />
      <Core />

      {placed.map((p) => (
        <RepoPlanet key={p.repo.id} repo={p.repo} orbit={p.orbit} posMap={posMap} />
      ))}

      <Connections placed={placed} posMap={posMap} />
      <CameraRig posMap={posMap} />

      <EffectComposer>
        <Bloom intensity={1.15} luminanceThreshold={0.12} luminanceSmoothing={0.5} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.95} />
      </EffectComposer>
    </Canvas>
  )
}
