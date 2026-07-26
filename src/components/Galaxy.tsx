import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Repo } from '../lib/github'
import { useGalaxy } from '../lib/store'
import { langColor } from '../lib/github'
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
}
interface LayoutResult {
  systems: System[]
  placed: Placed[]
}

// Group repos by language into solar-system-like clusters spread through space.
function layout(repos: Repo[]): LayoutResult {
  const byLang = new Map<string, Repo[]>()
  for (const r of repos) {
    const k = r.language || 'Other'
    if (!byLang.has(k)) byLang.set(k, [])
    byLang.get(k)!.push(r)
  }
  // biggest systems (by total stars) first -> placed nearer the middle
  const groups = [...byLang.entries()].sort(
    (a, b) =>
      b[1].reduce((s, r) => s + r.stargazers_count, 0) -
      a[1].reduce((s, r) => s + r.stargazers_count, 0),
  )

  const SPACING = 78
  const systems: System[] = []
  const placed: Placed[] = []

  groups.forEach(([lang, list], gi) => {
    // golden-spiral placement of system centers on a gently thick disk
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
      const r = 4 + i * 2.4 // each repo on its own ring
      const a0 = hash(repo.full_name) * Math.PI * 2
      const speed = (0.05 / Math.sqrt(r)) * (hash(repo.full_name + 's') > 0.5 ? 1 : 1) // slow
      const size = 0.45 + Math.log10(repo.stargazers_count + 10) * 0.4
      const trending = Date.now() - new Date(repo.pushed_at).getTime() < 7 * 864e5
      placed.push({
        repo,
        orbit: {
          center,
          r,
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

// A single thin white orbit ring (tilted), like a solar-system orbit.
function Ring({
  center,
  r,
  tiltX,
  tiltZ,
}: {
  center: [number, number, number]
  r: number
  tiltX: number
  tiltZ: number
}) {
  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const seg = 96
    const e = new THREE.Euler(tiltX, 0, tiltZ)
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const v = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)
      v.applyEuler(e)
      v.add(new THREE.Vector3(...center))
      pts.push(v)
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [center, r, tiltX, tiltZ])

  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} />
    </line>
  )
}

// Glowing star at a system center + a label for navigation.
function SystemStar({ system }: { system: System }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((s) => {
    const p = 1 + Math.sin(s.clock.elapsedTime * 0.8 + system.center[0]) * 0.06
    ref.current.scale.setScalar(p)
  })
  return (
    <group position={system.center}>
      <mesh ref={ref}>
        <sphereGeometry args={[system.coreSize, 32, 32]} />
        <meshBasicMaterial color="#fff8f0" />
      </mesh>
      <mesh>
        <sphereGeometry args={[system.coreSize * 2.4, 24, 24]} />
        <meshBasicMaterial
          color={system.color}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#fff1e0" intensity={2.2} distance={70} decay={1.5} />
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

function Nebula() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 1024
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#04030a'
    ctx.fillRect(0, 0, 1024, 1024)
    const blobs: [number, number, number, string][] = [
      [320, 380, 460, 'rgba(88,28,135,0.5)'],
      [720, 300, 380, 'rgba(30,64,175,0.42)'],
      [600, 720, 500, 'rgba(126,34,206,0.38)'],
      [200, 760, 340, 'rgba(14,116,144,0.32)'],
      [820, 820, 300, 'rgba(162,28,175,0.28)'],
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
      <sphereGeometry args={[400, 32, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} />
    </mesh>
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

// Fly camera to a selected planet (live position). Free pan/zoom otherwise.
function CameraRig({ posMap }: { posMap: React.MutableRefObject<Map<number, THREE.Vector3>> }) {
  const selected = useGalaxy((s) => s.selected)
  const controls = useRef<any>(null)
  const { camera } = useThree()
  const tPos = useRef(new THREE.Vector3())
  const tLook = useRef(new THREE.Vector3())

  useFrame(() => {
    if (selected) {
      const p = posMap.current.get(selected.id)
      if (p) {
        // approach from the camera's current side so the fly-in feels natural
        const dir = camera.position.clone().sub(p)
        if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
        dir.normalize()
        tPos.current.copy(p).addScaledVector(dir, 8).add(new THREE.Vector3(0, 3, 0))
        tLook.current.copy(p)
        camera.position.lerp(tPos.current, 0.05)
        if (controls.current) {
          controls.current.target.lerp(tLook.current, 0.08)
          controls.current.update()
        }
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
      maxDistance={420}
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
      <fog attach="fog" args={['#04030a', 130, 420]} />
      <ambientLight intensity={0.35} />

      <Nebula />
      <Stars radius={320} depth={120} count={9000} factor={5} saturation={0} fade speed={0.4} />

      {systems.map((s) => (
        <SystemStar key={s.key} system={s} />
      ))}
      {placed.map((p) => (
        <Ring
          key={'ring' + p.repo.id}
          center={p.orbit.center}
          r={p.orbit.r}
          tiltX={p.orbit.tiltX}
          tiltZ={p.orbit.tiltZ}
        />
      ))}
      {placed.map((p) => (
        <RepoPlanet key={p.repo.id} repo={p.repo} orbit={p.orbit} posMap={posMap} />
      ))}

      <Connections placed={placed} posMap={posMap} />
      <CameraRig posMap={posMap} />

      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={0.22} luminanceSmoothing={0.6} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.95} />
      </EffectComposer>
    </Canvas>
  )
}
