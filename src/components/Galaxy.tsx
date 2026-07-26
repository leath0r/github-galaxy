import { useEffect, useMemo, useRef } from 'react'
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

// soft round sprite so particles look like dust, not hard squares
function makeDot() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

type SystemType = 'normal' | 'binary' | 'blackhole' | 'dwarf' | 'nebula' | 'chaotic'

interface System {
  key: string
  center: [number, number, number]
  color: string
  coreSize: number
  type: SystemType
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

  const SPACING = 82
  const systems: System[] = []
  const placed: Placed[] = []

  groups.forEach(([lang, list], gi) => {
    const gr = SPACING * Math.sqrt(gi + 0.5)
    const gang = gi * 2.399963
    const center: [number, number, number] = [
      Math.cos(gang) * gr,
      (hash(lang + 'cy') - 0.5) * 40, // more vertical spread -> real 3D
      Math.sin(gang) * gr,
    ]
    const color = langColor(lang === 'Other' ? null : lang)

    // pick a system archetype for variety
    const archivedRatio = list.filter((r) => r.archived).length / list.length
    const ht = hash(lang + 'type')
    let type: SystemType
    if (archivedRatio > 0.4) type = 'blackhole'
    else if (ht < 0.16) type = 'binary'
    else if (ht < 0.32) type = 'nebula'
    else if (ht < 0.46) type = 'dwarf'
    else if (ht < 0.6) type = 'chaotic'
    else type = 'normal'

    const chaotic = type === 'chaotic'
    // elliptical variety per system
    const sysEcc = 0.6 + hash(lang + 'ecc') * 0.4
    const baseTiltX = (hash(lang + 'tx') - 0.5) * 0.9
    const baseTiltZ = (hash(lang + 'tz') - 0.5) * 0.9

    const sorted = [...list].sort((a, b) => b.stargazers_count - a.stargazers_count)
    sorted.forEach((repo, i) => {
      const r = 5 + i * (chaotic ? 2.9 : 2.5) + (chaotic ? (hash(repo.full_name + 'r') - 0.5) * 6 : 0)
      const a0 = hash(repo.full_name) * Math.PI * 2
      const speed = (0.05 / Math.sqrt(r)) * (chaotic ? 1 + hash(repo.full_name + 'sp') : 1)
      let size = 0.5 + Math.log10(repo.stargazers_count + 10) * 0.55
      if (repo.fork) size *= 0.7
      const ecc = chaotic ? 0.5 + hash(repo.full_name + 'e') * 0.5 : sysEcc + hash(repo.full_name + 'e') * 0.12
      const trending = !repo.archived && Date.now() - new Date(repo.pushed_at).getTime() < 7 * 864e5
      const comet = !repo.archived && Date.now() - new Date(repo.created_at).getTime() < 21 * 864e5
      // chaotic clusters -> each planet has its own tilted, ringless orbit
      const tiltX = chaotic ? (hash(repo.full_name + 'ctx') - 0.5) * 2.4 : baseTiltX
      const tiltZ = chaotic ? (hash(repo.full_name + 'ctz') - 0.5) * 2.4 : baseTiltZ
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
          comet,
          showRing: !chaotic,
        },
      })
    })

    systems.push({
      key: lang,
      center,
      color,
      coreSize: (1.4 + Math.log10(list.length + 1) * 1.1) * (type === 'dwarf' ? 0.55 : 1),
      type,
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
      <lineBasicMaterial color="#ffffff" transparent opacity={0.09} depthWrite={false} />
    </line>
  )
}

function SystemStar({ system }: { system: System }) {
  const a = useRef<THREE.Mesh>(null!)
  const b = useRef<THREE.Mesh>(null!)
  const disk = useRef<THREE.Mesh>(null!)
  const cs = system.coreSize

  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (system.type === 'binary') {
      const ang = t * 0.6
      const d = cs * 1.6
      a.current.position.set(Math.cos(ang) * d, 0, Math.sin(ang) * d)
      b.current.position.set(-Math.cos(ang) * d, 0, -Math.sin(ang) * d)
    } else if (a.current) {
      a.current.scale.setScalar(1 + Math.sin(t * 0.8 + system.center[0]) * 0.06)
    }
    if (disk.current) disk.current.rotation.z += 0.01
  })

  const label = (
    <Html center distanceFactor={95} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          transform: 'translateY(-30px)',
          whiteSpace: 'nowrap',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }}
      >
        {system.key}
      </div>
    </Html>
  )

  if (system.type === 'blackhole') {
    return (
      <group position={system.center}>
        <mesh>
          <sphereGeometry args={[cs * 0.9, 32, 32]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        {/* accretion disk */}
        <mesh ref={disk} rotation={[Math.PI / 2.1, 0, 0]}>
          <ringGeometry args={[cs * 1.2, cs * 3.2, 64]} />
          <meshBasicMaterial color="#ff7a18" transparent opacity={0.7} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[cs * 1.05, 32, 32]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.25} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {label}
      </group>
    )
  }

  if (system.type === 'binary') {
    return (
      <group position={system.center}>
        <mesh ref={a}>
          <sphereGeometry args={[cs * 0.7, 24, 24]} />
          <meshBasicMaterial color="#fff2d6" />
        </mesh>
        <mesh ref={b}>
          <sphereGeometry args={[cs * 0.6, 24, 24]} />
          <meshBasicMaterial color="#bcd4ff" />
        </mesh>
        <pointLight color="#fff1e0" intensity={2.2} distance={90} decay={1.5} />
        {label}
      </group>
    )
  }

  // normal / dwarf / nebula / chaotic all share a central star
  const starColor = system.type === 'dwarf' ? '#ffb27a' : '#fff8f0'
  return (
    <group position={system.center}>
      <mesh ref={a}>
        <sphereGeometry args={[cs, 32, 32]} />
        <meshBasicMaterial color={starColor} />
      </mesh>
      <mesh>
        <sphereGeometry args={[cs * 2.4, 24, 24]} />
        <meshBasicMaterial color={system.color} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {system.type === 'nebula' && (
        <mesh>
          <sphereGeometry args={[cs * 9, 24, 24]} />
          <meshBasicMaterial color={system.color} transparent opacity={0.06} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      <pointLight color="#fff1e0" intensity={system.type === 'dwarf' ? 1.1 : 2.2} distance={80} decay={1.5} />
      {label}
    </group>
  )
}

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
      <lineBasicMaterial color="#6d5bd0" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  )
}

// Ambient drifting data particles (mid/far depth).
function DataParticles() {
  const ref = useRef<THREE.Points>(null!)
  const geom = useMemo(() => {
    const n = 800
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 40 + Math.random() * 300
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = (Math.random() - 0.5) * 120
      arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3))
  }, [])
  const dot = useMemo(makeDot, [])
  useFrame((_, d) => {
    ref.current.rotation.y += d * 0.01
  })
  return (
    <points ref={ref}>
      <primitive object={geom} attach="geometry" />
      <pointsMaterial map={dot} color="#9db4ff" size={1.1} transparent opacity={0.45} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  )
}

// Foreground dust that follows the camera -> parallax + real depth cue.
function NearDust() {
  const ref = useRef<THREE.Points>(null!)
  const { camera } = useThree()
  const dot = useMemo(makeDot, [])
  const geom = useMemo(() => {
    const n = 160
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 80
      arr[i * 3 + 1] = (Math.random() - 0.5) * 80
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3))
  }, [])
  useFrame((_, d) => {
    ref.current.position.copy(camera.position)
    ref.current.rotation.y += d * 0.03
    ref.current.rotation.x += d * 0.015
  })
  return (
    <points ref={ref}>
      <primitive object={geom} attach="geometry" />
      <pointsMaterial map={dot} color="#cbd6ff" size={1.3} transparent opacity={0.28} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
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

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

// Intro fly-in on load + cinematic fly-to on select.
function CameraRig({ posMap }: { posMap: React.MutableRefObject<Map<number, THREE.Vector3>> }) {
  const selected = useGalaxy((s) => s.selected)
  const controls = useRef<any>(null)
  const { camera } = useThree()

  const far = useMemo(() => new THREE.Vector3(0, 220, 640), [])
  const home = useMemo(() => new THREE.Vector3(0, 55, 165), [])
  const origin = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const introDone = useRef(false)
  const introT = useRef(0)

  const prevId = useRef<number | null>(null)
  const flyT = useRef(1)
  const start = useRef(new THREE.Vector3())
  const startTarget = useRef(new THREE.Vector3())
  const tPos = useRef(new THREE.Vector3())
  const tLook = useRef(new THREE.Vector3())

  useEffect(() => {
    camera.position.copy(far)
  }, [camera, far])

  useFrame((_, delta) => {
    // intro fly-in
    if (!introDone.current) {
      if (selected) {
        introDone.current = true
      } else {
        introT.current = Math.min(1, introT.current + delta / 3.2)
        const e = easeOutCubic(introT.current)
        camera.position.lerpVectors(far, home, e)
        if (controls.current) {
          controls.current.target.lerp(origin, 0.06)
          controls.current.update()
        }
        if (introT.current >= 1) introDone.current = true
        return
      }
    }

    const id = selected?.id ?? null
    if (id !== prevId.current) {
      prevId.current = id
      if (id != null) {
        flyT.current = 0
        start.current.copy(camera.position)
        startTarget.current.copy(controls.current ? controls.current.target : origin)
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
      const e = easeInOut(flyT.current)
      camera.position.lerpVectors(start.current, tPos.current, e)
      if (controls.current) {
        controls.current.target.lerpVectors(startTarget.current, tLook.current, e)
        controls.current.update()
      }
    } else {
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
      maxDistance={520}
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
      camera={{ position: [0, 55, 165], fov: 55 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#04030a']} />
      <fog attach="fog" args={['#04030a', 90, 380]} />
      <ambientLight intensity={0.32} />

      <Stars radius={360} depth={140} count={9000} factor={5} saturation={0} fade speed={0.4} />
      <DataParticles />
      <NearDust />
      <Bridges systems={systems} />

      {systems.map((s) => (
        <SystemStar key={s.key} system={s} />
      ))}
      {placed.map((p) => (p.orbit.showRing ? <Ring key={'ring' + p.repo.id} orbit={p.orbit} /> : null))}
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
