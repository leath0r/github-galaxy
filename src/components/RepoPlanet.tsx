import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Repo } from '../lib/github'
import { langColor } from '../lib/github'
import { useGalaxy } from '../lib/store'

export interface Orbit {
  center: [number, number, number] // galaxy (star) center
  r: number // orbital radius
  a0: number // starting angle
  speed: number // angular velocity (slow, inner faster)
  phase: number
  size: number // planet radius
  tiltX: number // orbital plane tilt
  tiltZ: number
  trending: boolean
}

interface Props {
  repo: Repo
  orbit: Orbit
  posMap: React.MutableRefObject<Map<number, THREE.Vector3>>
}

export default function RepoPlanet({ repo, orbit, posMap }: Props) {
  const group = useRef<THREE.Group>(null!)
  const mesh = useRef<THREE.Mesh>(null!)
  const halo = useRef<THREE.Mesh>(null!)
  const [local, setLocal] = useState(false)
  const hover = useGalaxy((s) => s.hover)
  const select = useGalaxy((s) => s.select)
  const selectedId = useGalaxy((s) => s.selected?.id)
  const hoveredId = useGalaxy((s) => s.hovered)

  const active = local || hoveredId === repo.id || selectedId === repo.id
  const color = useMemo(() => new THREE.Color(langColor(repo.language)), [repo.language])
  const euler = useMemo(() => new THREE.Euler(orbit.tiltX, 0, orbit.tiltZ), [orbit.tiltX, orbit.tiltZ])
  const center = useMemo(() => new THREE.Vector3(...orbit.center), [orbit.center])
  const vec = useMemo(() => new THREE.Vector3(), [])
  const store = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const angle = orbit.a0 + t * orbit.speed
    // position on the orbital ring, then tilt the plane, then offset to the star
    vec.set(Math.cos(angle) * orbit.r, 0, Math.sin(angle) * orbit.r)
    vec.applyEuler(euler)
    vec.add(center)
    vec.y += Math.sin(t * 0.5 + orbit.phase) * 0.12
    group.current.position.copy(vec)
    posMap.current.set(repo.id, store.copy(vec).clone())

    mesh.current.rotation.y += delta * 0.2
    const target = active ? 1.5 : 1
    mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, target, 0.15))

    const pulse = orbit.trending ? 1 + Math.sin(t * 3) * 0.1 : 1
    const hs = (active ? 2.1 : 1.55) * pulse
    halo.current.scale.setScalar(THREE.MathUtils.lerp(halo.current.scale.x, hs, 0.15))
    const hm = halo.current.material as THREE.MeshBasicMaterial
    hm.opacity = THREE.MathUtils.lerp(hm.opacity, active ? 0.4 : 0.16, 0.15)
  })

  return (
    <group ref={group}>
      <mesh ref={halo} scale={1.55}>
        <sphereGeometry args={[orbit.size, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

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
          emissive={color}
          emissiveIntensity={active ? 2.6 : 1.4}
          roughness={0.3}
          metalness={0.6}
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
