import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Float, Sphere, Icosahedron, Torus, Html } from '@react-three/drei'
import { useRef, useMemo, Suspense } from 'react'
import * as THREE from 'three'
import { LICENSES } from '../../data/licenses'
import type { LicenseId } from '../../types'

// 单颗执照星球
function Planet({
  position,
  color,
  icon,
  name,
  index,
  onClick,
}: {
  position: [number, number, number]
  color: string
  icon: string
  name: string
  index: number
  onClick: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y += 0.004
      group.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.15
    }
    if (ring.current) {
      ring.current.rotation.z += 0.006
      ring.current.rotation.x = Math.PI / 2.4
    }
  })

  return (
    <group position={position}>
      <group ref={group} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'default')}>
        {/* 星球本体 */}
        <Icosahedron args={[0.9, 2]}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            roughness={0.3}
            metalness={0.7}
            flatShading
          />
        </Icosahedron>
        {/* 大气层光晕 */}
        <Sphere args={[1.05, 32, 32]}>
          <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.BackSide} />
        </Sphere>
        {/* 行星环 */}
        <mesh ref={ring}>
          <Torus args={[1.4, 0.04, 8, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} />
        </mesh>
        {/* 图标 + 名称 */}
        <Html center distanceFactor={8} position={[0, 1.6, 0]}>
          <div style={{ textAlign: 'center', pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{ fontSize: '2rem', filter: `drop-shadow(0 0 8px ${color})` }}>{icon}</div>
          </div>
        </Html>
        <Html center distanceFactor={8} position={[0, -1.5, 0]}>
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '0.6rem',
              letterSpacing: '0.15em',
              color,
              textShadow: `0 0 8px ${color}`,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {name}
          </div>
        </Html>
      </group>
    </group>
  )
}

// 中心恒星
function CentralStar() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.3
      const s = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05
      ref.current.scale.setScalar(s)
    }
  })
  return (
    <mesh ref={ref}>
      <Sphere args={[0.6, 32, 32]}>
        <meshBasicMaterial color="#ffd700" />
      </Sphere>
      <pointLight color="#ffd700" intensity={3} distance={12} />
      <Sphere args={[0.75, 32, 32]}>
        <meshBasicMaterial color="#ff2e88" transparent opacity={0.3} side={THREE.BackSide} />
      </Sphere>
    </mesh>
  )
}

// 轨道圈
function OrbitRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[Math.PI / 2.2, 0, 0]}>
      <ringGeometry args={[radius, radius + 0.02, 96]} />
      <meshBasicMaterial color="#00f5ff" transparent opacity={0.2} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Scene({ onSelect }: { onSelect: (id: LicenseId) => void }) {
  const positions = useMemo<[number, number, number][]>(
    () =>
      LICENSES.map((_, i) => {
        const angle = (i / LICENSES.length) * Math.PI * 2
        return [Math.cos(angle) * 3.6, 0, Math.sin(angle) * 3.6]
      }),
    [],
  )

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 4, 0]} intensity={2} color="#9d4edd" />
      <Stars radius={50} depth={30} count={2000} factor={4} saturation={0} fade speed={1} />

      <CentralStar />
      <OrbitRing radius={3.6} />

      {LICENSES.map((lic, i) => (
        <Planet
          key={lic.id}
          position={positions[i]}
          color={lic.planetColor}
          icon={lic.icon}
          name={lic.code}
          index={i}
          onClick={() => onSelect(lic.id)}
        />
      ))}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={4}
        maxDistance={12}
        autoRotate
        autoRotateSpeed={0.3}
        target={[0, 0, 0]}
      />
    </>
  )
}

export function SpaceHallScene({ onSelect }: { onSelect: (id: LicenseId) => void }) {
  return (
    <Canvas
      camera={{ position: [0, 2.5, 8], fov: 55 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <Scene onSelect={onSelect} />
      </Suspense>
    </Canvas>
  )
}
