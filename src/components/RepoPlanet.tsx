import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Repo } from '../lib/github'
import { langColor } from '../lib/github'
import { useGalaxy } from '../lib/store'

interface Props {
  repo: Repo
  position: [number, number, number]
  radius: number
  trending: boolean
}

export default function RepoPlanet({ repo, position, radius, trending }: Props) {
  const mesh = useRef<THREE.Mesh>(null!)
  const halo = useRef<THREE.Mesh>(null!)
  const [local, setLocal] = useState(false)
  const hover = useGalaxy((s) => s.hover)
  const select = useGalaxy((s) => s.select)
  const selectedId = useGalaxy((s) => s.selected?.id)
  const hoveredId = useGalaxy((s) => s.hovered)

  const active = local || hoveredId === repo.id || selectedId === repo.id
  const color = langColor(repo.language)

  useFrame((state, delta) => {
    if (!mesh.current) return
    mesh.current.rotation.y += delta * 0.15
    const target = active ? 1.45 : 1
    const s = THREE.MathUtils.lerp(mesh.current.scale.x, target, 0.15)
    mesh.current.scale.setScalar(s)
    if (halo.current) {
      const pulse = trending ? 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08 : 1
      const hs = (active ? 1.9 : 1.5) * pulse
      halo.current.scale.setScalar(THREE.MathUtils.lerp(halo.current.scale.x, hs, 0.15))
      const mat = halo.current.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, active ? 0.35 : 0.14, 0.15)
    }
  })

  return (
    <group position={position}>
      {/* glow halo */}
      <mesh ref={halo} scale={1.5}>
        <sphereGeometry args={[radius, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.14}
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
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 2.2 : 1.2}
          roughness={0.35}
          metalness={0.5}
        />
      </mesh>

      {active && (
        <Html center distanceFactor={22} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              transform: 'translateY(-42px)',
              whiteSpace: 'nowrap',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(10,12,30,0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {repo.full_name}
            <span style={{ opacity: 0.7, marginLeft: 8 }}>★ {fmt(repo.stargazers_count)}</span>
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
