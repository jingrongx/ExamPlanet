import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Float, Text, Line, Sphere, Box, Cylinder, Torus } from '@react-three/drei'
import { useRef, useMemo, Suspense } from 'react'
import * as THREE from 'three'

/* ============================================================
 * PPL 飞行执照 —— 驾驶舱 + 飞机穿越云层
 * ============================================================ */
function Airplane({ bank }: { bank: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, bank, 0.08)
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.2
    }
  })
  return (
    <group ref={ref}>
      {/* 机身 */}
      <Cylinder args={[0.18, 0.12, 2, 16]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#e0e0ff" metalness={0.6} roughness={0.3} />
      </Cylinder>
      {/* 机头螺旋桨 */}
      <mesh position={[0, 0, 1.1]}>
        <coneGeometry args={[0.15, 0.3, 16]} />
        <meshStandardMaterial color="#ff2e88" emissive="#ff2e88" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0, 1.3]} ref={useRef<THREE.Mesh>(null)}>
        <boxGeometry args={[1.2, 0.04, 0.1]} />
        <meshStandardMaterial color="#00f5ff" transparent opacity={0.6} />
      </mesh>
      {/* 主机翼 */}
      <Box args={[3, 0.06, 0.6]} position={[0, 0, -0.2]}>
        <meshStandardMaterial color="#9d4edd" metalness={0.5} roughness={0.4} />
      </Box>
      {/* 尾翼 */}
      <Box args={[1.2, 0.04, 0.3]} position={[0, 0, -1]}>
        <meshStandardMaterial color="#9d4edd" metalness={0.5} roughness={0.4} />
      </Box>
      <Box args={[0.04, 0.5, 0.3]} position={[0, 0.25, -1]}>
        <meshStandardMaterial color="#ff2e88" emissive="#ff2e88" emissiveIntensity={0.4} />
      </Box>
    </group>
  )
}

function Clouds() {
  const clouds = useMemo(
    () =>
      Array.from({ length: 18 }, () => ({
        p: [
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 12,
        ] as [number, number, number],
        s: 0.4 + Math.random() * 0.8,
      })),
    [],
  )
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.children.forEach((c) => {
      c.position.z += delta * 1.5
      if (c.position.z > 6) c.position.z = -6
    })
  })
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <Sphere key={i} args={[c.s, 8, 8]} position={c.p}>
          <meshStandardMaterial color="#ffffff" transparent opacity={0.18} />
        </Sphere>
      ))}
    </group>
  )
}

export function Cockpit3D({ bank = 0 }: { bank?: number }) {
  return (
    <Canvas camera={{ position: [3, 1.5, 4], fov: 55 }} dpr={[1, 1.8]} gl={{ alpha: true }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffd700" />
        <pointLight position={[-3, 2, -3]} intensity={0.8} color="#00f5ff" />
        <Airplane bank={bank} />
        <Clouds />
        <OrbitControls enablePan={false} minDistance={3} maxDistance={10} autoRotate autoRotateSpeed={0.5} />
      </Suspense>
    </Canvas>
  )
}

/* ============================================================
 * UAV 无人机 —— 城市网格上空飞行
 * ============================================================ */
function Drone({ altitude }: { altitude: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = 1.5 + altitude
      ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.4) * 2
      ref.current.position.z = Math.cos(state.clock.elapsedTime * 0.4) * 2
      ref.current.rotation.y = -state.clock.elapsedTime * 0.4 + Math.PI / 2
    }
  })
  return (
    <group ref={ref}>
      {/* 机身 */}
      <Box args={[0.5, 0.12, 0.5]}>
        <meshStandardMaterial color="#1a1147" metalness={0.8} roughness={0.2} />
      </Box>
      {/* 4 个旋翼臂 */}
      {[[1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]].map((p, i) => (
        <group key={i} position={[p[0] * 0.5, 0, p[2] * 0.5]}>
          <Cylinder args={[0.04, 0.04, 0.4]} rotation={[0, 0, Math.PI / 2]}>
            <meshStandardMaterial color="#00f5ff" />
          </Cylinder>
          <mesh position={[p[0] * 0.2, 0.1, p[2] * 0.2]} ref={useRef<THREE.Mesh>(null)}>
            <cylinderGeometry args={[0.5, 0.5, 0.02, 16]} />
            <meshStandardMaterial color="#ff2e88" transparent opacity={0.25} emissive="#ff2e88" emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
      {/* LED */}
      <mesh position={[0, -0.1, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#39ff14" />
      </mesh>
      <pointLight color="#39ff14" intensity={0.5} distance={2} />
    </group>
  )
}

function CityGrid() {
  const buildings = useMemo(
    () =>
      Array.from({ length: 30 }, () => ({
        x: (Math.random() - 0.5) * 8,
        z: (Math.random() - 0.5) * 8,
        h: 0.3 + Math.random() * 1.2,
        c: Math.random() > 0.5 ? '#00f5ff' : '#ff2e88',
      })),
    [],
  )
  return (
    <group>
      {/* 地面网格 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
        <planeGeometry args={[12, 12, 12, 12]} />
        <meshStandardMaterial color="#0a0e27" wireframe />
      </mesh>
      {buildings.map((b, i) => (
        <Box key={i} args={[0.4, b.h, 0.4]} position={[b.x, -1.5 + b.h / 2, b.z]}>
          <meshStandardMaterial
            color="#0a0e27"
            emissive={b.c}
            emissiveIntensity={0.4}
            metalness={0.7}
            roughness={0.3}
          />
        </Box>
      ))}
    </group>
  )
}

export function DroneCity3D({ altitude = 0 }: { altitude?: number }) {
  return (
    <Canvas camera={{ position: [4, 3, 5], fov: 55 }} dpr={[1, 1.8]} gl={{ alpha: true }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 5, 0]} intensity={1} color="#9d4edd" />
        <Drone altitude={altitude} />
        <CityGrid />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={12} maxPolarAngle={Math.PI / 2.1} />
      </Suspense>
    </Canvas>
  )
}

/* ============================================================
 * HAM 无线电 —— 天线塔发射电波
 * ============================================================ */
function AntennaTower() {
  return (
    <group position={[0, -1, 0]}>
      {/* 塔身 */}
      <Cylinder args={[0.05, 0.12, 3, 6]} position={[0, 1.5, 0]}>
        <meshStandardMaterial color="#9d4edd" metalness={0.7} roughness={0.3} emissive="#9d4edd" emissiveIntensity={0.2} />
      </Cylinder>
      {/* 横档 */}
      {[0.5, 1.2, 1.9, 2.6].map((y, i) => (
        <Torus key={i} args={[0.15 + i * 0.02, 0.015, 6, 16]} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#00f5ff" emissive="#00f5ff" emissiveIntensity={0.4} />
        </Torus>
      ))}
      {/* 顶端天线 */}
      <Cylinder args={[0.02, 0.04, 0.8, 6]} position={[0, 3.4, 0]}>
        <meshStandardMaterial color="#ff2e88" emissive="#ff2e88" emissiveIntensity={0.6} />
      </Cylinder>
      <mesh position={[0, 3.9, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#ff2e88" />
      </mesh>
      <pointLight position={[0, 3.9, 0]} color="#ff2e88" intensity={1.5} distance={6} />
    </group>
  )
}

function WaveRings({ speed }: { speed: number }) {
  const group = useRef<THREE.Group>(null)
  const rings = useRef<THREE.Mesh[]>([])
  useFrame((_, delta) => {
    rings.current.forEach((m, i) => {
      if (m) {
        const s = m.scale.x + delta * speed * 1.5
        m.scale.setScalar(s)
        const mat = m.material as THREE.MeshBasicMaterial
        mat.opacity = Math.max(0, 1 - s / 6)
        if (s > 6) {
          m.scale.setScalar(0.5)
          mat.opacity = 0.8
        }
      }
    })
  })
  return (
    <group ref={group} position={[0, 2.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) rings.current[i] = el
          }}
          scale={0.5 + i * 1.5}
        >
          <ringGeometry args={[0.4, 0.42, 48]} />
          <meshBasicMaterial color="#00f5ff" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export function Antenna3D({ speed = 1 }: { speed?: number }) {
  return (
    <Canvas camera={{ position: [3, 2, 4], fov: 55 }} dpr={[1, 1.8]} gl={{ alpha: true }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 3]} intensity={0.6} />
        <AntennaTower />
        <WaveRings speed={speed} />
        <OrbitControls enablePan={false} minDistance={3} maxDistance={10} autoRotate autoRotateSpeed={0.3} />
      </Suspense>
    </Canvas>
  )
}

/* ============================================================
 * ECO 经济师 —— 3D 供需曲线 + 柱状图
 * ============================================================ */
function SupplyDemand() {
  // 供给曲线（上升）和需求曲线（下降）
  const supplyPoints = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 20; i++) {
      const x = -2 + (i / 20) * 4
      const y = -1 + (i / 20) * 2.2
      pts.push([x, y, 0])
    }
    return pts
  }, [])
  const demandPoints = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 20; i++) {
      const x = -2 + (i / 20) * 4
      const y = 1.2 - (i / 20) * 2.2
      pts.push([x, y, 0])
    }
    return pts
  }, [])

  return (
    <group>
      {/* 坐标轴 */}
      <Line points={[[0, -1.3, 0], [0, 1.5, 0]]} color="#00f5ff" lineWidth={2} />
      <Line points={[[-2.2, -1, 0], [2.2, -1, 0]]} color="#00f5ff" lineWidth={2} />
      {/* 供给 S */}
      <Line points={supplyPoints} color="#39ff14" lineWidth={3} />
      {/* 需求 D */}
      <Line points={demandPoints} color="#ff2e88" lineWidth={3} />
      {/* 均衡点 E */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>
      <pointLight position={[0, 0.5, 1]} color="#ffd700" intensity={1} distance={4} />
      <Text position={[0.2, 0.3, 0]} fontSize={0.18} color="#ffd700" anchorX="left">
        E 均衡点
      </Text>
      <Text position={[1.8, 1.2, 0]} fontSize={0.18} color="#39ff14" anchorX="left">
        S 供给
      </Text>
      <Text position={[1.8, -0.6, 0]} fontSize={0.18} color="#ff2e88" anchorX="left">
        D 需求
      </Text>
    </group>
  )
}

function Bars() {
  const data = useMemo(
    () => [
      { x: -1.5, h: 1.2, c: '#ff2e88' },
      { x: -0.5, h: 1.8, c: '#9d4edd' },
      { x: 0.5, h: 1.5, c: '#00f5ff' },
      { x: 1.5, h: 2.2, c: '#39ff14' },
    ],
    [],
  )
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current) {
      ref.current.children.forEach((c, i) => {
        const m = c as THREE.Mesh
        const target = data[i].h + Math.sin(state.clock.elapsedTime * 2 + i) * 0.15
        m.scale.y = THREE.MathUtils.lerp(m.scale.y, target / data[i].h, 0.1)
        m.position.y = -1 + (target / 2)
      })
    }
  })
  return (
    <group ref={ref} position={[0, 0, -1.5]}>
      {data.map((d, i) => (
        <Box key={i} args={[0.5, d.h, 0.5]} position={[d.x, -1 + d.h / 2, 0]}>
          <meshStandardMaterial color={d.c} emissive={d.c} emissiveIntensity={0.4} metalness={0.5} roughness={0.3} />
        </Box>
      ))}
    </group>
  )
}

export function Economy3D() {
  return (
    <Canvas camera={{ position: [3, 2, 4], fov: 55 }} dpr={[1, 1.8]} gl={{ alpha: true }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 3]} intensity={0.8} color="#ffd700" />
        <SupplyDemand />
        <Bars />
        <OrbitControls enablePan={false} minDistance={3} maxDistance={10} autoRotate autoRotateSpeed={0.4} />
      </Suspense>
    </Canvas>
  )
}
