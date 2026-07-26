import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Repo, StyleKey } from '../lib/github'
import { useGalaxy } from '../lib/store'
import { langColor, categoryOf } from '../lib/github'
import RepoPlanet, { type Orbit } from './RepoPlanet'

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

interface System {
  key: string
  center: [number, number, number]
  tiltX: number
  tiltZ: number
  color: string
  coreSize: number
}
interface Placed {
  repo: Repo
  orbit: Orbit
  styleKey: StyleKey
}
interface LayoutResult {
  systems: System[]
  placed: Placed[]
}

function layout(repos: Repo[]): LayoutResult {
  const byLang = new Map<string, Repo[]>()
  for (const r of repos) {
    const k = r.language || 'Other'
    if (!byLang.has(k)) byLang.set(k, [])
    byLang.get(k)!.push(r)
  }
  const groups = [...byLang.entries()].sort(
    (a, b) =>
      b[1].reduce((s, r) => s + r.stargazers_count, 0) -
      a[1].reduce((s, r) => s + r.stargazers_count, 0),
  )

  const SPACING = 80
  const systems: System[] = []
  const placed: Placed[] = []

  groups.forEach(([lang, list], gi) => {
    const gr = SPACING * Math.sqrt(gi + 0.5)
    const gang = gi * 2.399963
    const center: [number, number, number] = [
      Math.cos(gang) * gr,
      (hash(lang + 'cy') - 0.5) * 26,
      Math.sin(gang) * gr,
    ]
    const tiltX = (hash(lang + 'tx') - 0.5) * 0.9
    const tiltZ = (hash(lang + 'tz') - 0.5) * 0.9
    const color = langColor(lang === 'Other' ? null : lang)

    const sorted = [...list].sort((a, b) => b.stargazers_count - a.stargazers_count)
    sorted.forEach((repo, i) => {
      const r = 5 + i * 2.5
      const a0 = hash(repo.full_name) * Math.PI * 2
      const speed = 0.05 / Math.sqrt(r) // slow, inner faster
      // size means something: giant stars vs satellites; forks smaller
      let size = 0.5 + Math.log10(repo.stargazers_count + 10) * 0.55
      if (repo.fork) size *= 0.7
      const ecc = 0.82 + hash(repo.full_name + 'e') * 0.18
      const trending = !repo.archived && Date.now() - new Date(repo.pushed_at).getTime() < 7 * 864e5
      placed.push({
        repo,
        styleKey: categoryOf(repo),
        orbit: {
          center,
          r,
          ecc,
          a0,
          speed,
          phase: hash(repo.full_name + 'p') * Math.PI * 2,
          size,
          tiltX,
          tiltZ,
          trending,
        },
      })
    })

    systems.push({
      key: lang,
      center,
      tiltX,
      tiltZ,
      color,
      coreSize: 1.4 + Math.log10(list.length + 1) * 1.1,
    })
  })

  return { systems, placed }
}

function Ring({ orbit }: { orbit: Orbit }) {
  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const seg = 96
    const e = new THREE.Euler(orbit.tiltX, 0, orbit.tiltZ)
    const c = new THREE.Vector3(...orbit.center)
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const v = new THREE.Vector3(Math.cos(a) * orbit.r, 0, Math.sin(a) * orbit.r * orbit.ecc)
      v.applyEuler(e).add(c)
      pts.push(v)
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [orbit])
  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color="#ffffff" transparent opacity={0.1} depthWrite={false} />
    </line>
  )
}

function SystemStar({ system }: { system: System }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((s) => {
    ref.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 0.8 + system.center[0]) * 0.06)
  })
  return (
    <group position={system.center}>
      <mesh ref={ref}>
        <sphereGeometry args={[system.coreSize, 32, 32]} />
        <meshBasicMaterial color="#fff8f0" />
      </mesh>
      <mesh>
        <sphereGeometry args={[system.coreSize * 2.4, 24, 24]} />
        <meshBasicMaterial color={system.color} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight color="#fff1e0" intensity={2.2} distance={80} decay={1.5} />
      <Html center distanceFactor={90} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            transform: 'translateY(-30px)',
            whiteSpace: 'nowrap',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          {system.key}
        </div>
      </Html>
    </group>
  )
}

// Faint light bridges linking each system to its nearest neighbour.
function Bridges({ systems }: { systems: System[] }) {
  const geom = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i < systems.length; i++) {
      let best = -1
      let bd = Infinity
      const a = new THREE.Vector3(...systems[i].center)
      for (let j = 0; j < systems.length; j++) {
        if (i === j) continue
        const d = a.distanceTo(new THREE.Vector3(...systems[j].center))
        if (d < bd) {
          bd = d
          best = j
        }
      }
      if (best >= 0) {
        const b = systems[best].center
        pts.push(a.x, a.y, a.z, b[0], b[1], b[2])
      }
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  }, [systems])
  return (
    <lineSegments>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color="#6d5bd0" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  )
}

// Drifting data particles for ambient life.
function DataParticles() {
  const ref = useRef<THREE.Points>(null!)
  const geom = useMemo(() => {
    const n = 700
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 40 + Math.random() * 260
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = (Math.random() - 0.5) * 80
      arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3))
  }, [])
  useFrame((_, d) => {
    ref.current.rotation.y += d * 0.01
  })
  return (
    <points ref={ref}>
      <primitive object={geom} attach="geometry" />
      <pointsMaterial color="#9db4ff" size={0.5} transparent opacity={0.5} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  )
}

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
      .slice(0, 18)
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
      <lineBasicMaterial color="#a5b4fc" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  )
}

// Cinematic camera: ease-in-out fly to selected planet (accelerate then settle).
function CameraRig({ posMap }: { posMap: React.MutableRefObject<Map<number, THREE.Vector3>> }) {
  const selected = useGalaxy((s) => s.selected)
  const controls = useRef<any>(null)
  const { camera } = useThree()
  const prevId = useRef<number | null>(null)
  const flyT = useRef(1)
  const start = useRef(new THREE.Vector3())
  const startTarget = useRef(new THREE.Vector3())
  const tPos = useRef(new THREE.Vector3())
  const tLook = useRef(new THREE.Vector3())

  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

  useFrame((_, delta) => {
    const id = selected?.id ?? null
    if (id !== prevId.current) {
      prevId.current = id
      if (id != null) {
        flyT.current = 0
        start.current.copy(camera.position)
        startTarget.current.copy(controls.current ? controls.current.target : new THREE.Vector3())
      }
    }
    if (id == null) return
    const p = posMap.current.get(id)
    if (!p) return
    const dir = camera.position.clone().sub(p)
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
    dir.normalize()
    tPos.current.copy(p).addScaledVector(dir, 8).add(new THREE.Vector3(0, 3, 0))
    tLook.current.copy(p)

    if (flyT.current < 1) {
      flyT.current = Math.min(1, flyT.current + delta / 1.4)
      const e = ease(flyT.current)
      camera.position.lerpVectors(start.current, tPos.current, e)
      if (controls.current) {
        controls.current.target.lerpVectors(startTarget.current, tLook.current, e)
        controls.current.update()
      }
    } else {
      // keep gently tracking the moving planet after arrival
      camera.position.lerp(tPos.current, 0.04)
      if (controls.current) {
        controls.current.target.lerp(tLook.current, 0.06)
        controls.current.update()
      }
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      screenSpacePanning
      panSpeed={0.9}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.9}
      minDistance={4}
      maxDistance={460}
    />
  )
}

export default function Galaxy() {
  const repos = useGalaxy((s) => s.repos)
  const select = useGalaxy((s) => s.select)
  const { systems, placed } = useMemo(() => layout(repos), [repos])
  const posMap = useRef<Map<number, THREE.Vector3>>(new Map())

  return (
    <Canvas
      camera={{ position: [0, 50, 150], fov: 55 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#04030a']} />
      <fog attach="fog" args={['#04030a', 150, 460]} />
      <ambientLight intensity={0.35} />

      <Stars radius={340} depth={130} count={9000} factor={5} saturation={0} fade speed={0.4} />
      <DataParticles />
      <Bridges systems={systems} />

      {systems.map((s) => (
        <SystemStar key={s.key} system={s} />
      ))}
      {placed.map((p) => (
        <Ring key={'ring' + p.repo.id} orbit={p.orbit} />
      ))}
      {placed.map((p) => (
        <RepoPlanet key={p.repo.id} repo={p.repo} orbit={p.orbit} styleKey={p.styleKey} posMap={posMap} />
      ))}

      <Connections placed={placed} posMap={posMap} />
      <CameraRig posMap={posMap} />

      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.2} luminanceSmoothing={0.6} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.95} />
      </EffectComposer>
    </Canvas>
  )
}
