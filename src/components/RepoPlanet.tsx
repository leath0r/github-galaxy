import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Repo, StyleKey } from '../lib/github'
import { STYLE, langColor } from '../lib/github'
import { useGalaxy } from '../lib/store'

export interface Orbit {
  center: [number, number, number]
  r: number
  ecc: number // ellipse ratio for z axis (1 = circle)
  a0: number
  speed: number
  phase: number
  size: number
  tiltX: number
  tiltZ: number
  trending: boolean
}

interface Props {
  repo: Repo
  orbit: Orbit
  styleKey: StyleKey
  posMap: React.MutableRefObject<Map<number, THREE.Vector3>>
}

export default function RepoPlanet({ repo, orbit, styleKey, posMap }: Props) {
  const group = useRef<THREE.Group>(null!)
  const mesh = useRef<THREE.Mesh>(null!)
  const halo = useRef<THREE.Mesh>(null!)
  const energy = useRef<THREE.Mesh>(null!)
  const gold = useRef<THREE.Mesh>(null!)
  const [local, setLocal] = useState(false)
  const hover = useGalaxy((s) => s.hover)
  const select = useGalaxy((s) => s.select)
  const selectedId = useGalaxy((s) => s.selected?.id)
  const hoveredId = useGalaxy((s) => s.hovered)

  const active = local || hoveredId === repo.id || selectedId === repo.id

  const style = STYLE[styleKey]
  const archived = !!repo.archived
  // resolve colours (default archetype falls back to language colour)
  const baseColor = styleKey === 'default' ? langColor(repo.language) : style.color
  const emissive = styleKey === 'default' ? langColor(repo.language) : style.emissive
  const color = useMemo(
    () => (archived ? new THREE.Color('#5b6072') : new THREE.Color(baseColor)),
    [archived, baseColor],
  )
  const emColor = useMemo(() => new THREE.Color(archived ? '#3a3f4d' : emissive), [archived, emissive])
  const emInt = archived ? 0.15 : style.emissiveIntensity

  const euler = useMemo(() => new THREE.Euler(orbit.tiltX, 0, orbit.tiltZ), [orbit.tiltX, orbit.tiltZ])
  const center = useMemo(() => new THREE.Vector3(...orbit.center), [orbit.center])
  const vec = useMemo(() => new THREE.Vector3(), [])
  const store = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const angle = orbit.a0 + t * orbit.speed
    vec.set(Math.cos(angle) * orbit.r, 0, Math.sin(angle) * orbit.r * orbit.ecc)
    vec.applyEuler(euler)
    vec.add(center)
    vec.y += Math.sin(t * 0.5 + orbit.phase) * 0.12
    group.current.position.copy(vec)
    posMap.current.set(repo.id, store.copy(vec).clone())

    mesh.current.rotation.y += delta * 0.2
    const target = active ? 1.5 : 1
    mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, target, 0.15))

    const hs = active ? 2.1 : 1.55
    halo.current.scale.setScalar(THREE.MathUtils.lerp(halo.current.scale.x, hs, 0.15))
    const hm = halo.current.material as THREE.MeshBasicMaterial
    hm.opacity = THREE.MathUtils.lerp(hm.opacity, archived ? 0.05 : active ? 0.4 : 0.16, 0.15)

    if (energy.current) {
      const pulse = 1 + Math.sin(t * 4 + orbit.phase) * 0.18
      energy.current.scale.setScalar(1.7 * pulse)
      ;(energy.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 4) * 0.08
    }
    if (gold.current) {
      const pulse = 1 + Math.sin(t * 2.2 + orbit.phase) * 0.12
      gold.current.scale.setScalar(1.9 * pulse)
    }
  })

  return (
    <group ref={group}>
      {/* glow halo */}
      <mesh ref={halo} scale={1.55}>
        <sphereGeometry args={[orbit.size, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* red energy shell for security */}
      {style.energy && !archived && (
        <mesh ref={energy} scale={1.7}>
          <sphereGeometry args={[orbit.size, 20, 20]} />
          <meshBasicMaterial color="#ff3b3b" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      {/* golden trending aura */}
      {orbit.trending && !archived && (
        <mesh ref={gold} scale={1.9}>
          <sphereGeometry args={[orbit.size, 20, 20]} />
          <meshBasicMaterial color="#ffd45e" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      {/* Saturn-like ring */}
      {style.ring && (
        <mesh rotation={[Math.PI / 2.3, 0, 0]}>
          <ringGeometry args={[orbit.size * 1.5, orbit.size * 2.3, 48]} />
          <meshBasicMaterial
            color={style.ringColor ?? '#ffffff'}
            transparent
            opacity={archived ? 0.1 : 0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh
        ref={mesh}
        onPointerOver={(e) => {
          e.stopPropagation()
          setLocal(true)
          hover(repo.id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setLocal(false)
          hover(null)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          select(repo)
        }}
      >
        <sphereGeometry args={[orbit.size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emColor}
          emissiveIntensity={active ? emInt + 1 : emInt}
          roughness={style.roughness}
          metalness={style.metalness}
        />
      </mesh>

      {active && (
        <Html center distanceFactor={20} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              transform: 'translateY(-40px)',
              whiteSpace: 'nowrap',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(8,10,24,0.55)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {repo.full_name}
            <span style={{ opacity: 0.65, marginLeft: 8 }}>★ {fmt(repo.stargazers_count)}</span>
          </div>
        </Html>
      )}
    </group>
  )
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k'
  return String(n)
}
