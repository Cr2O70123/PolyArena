import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlayerState } from '../types';

interface OpponentProps {
  state: PlayerState;
}

const Opponent: React.FC<OpponentProps> = ({ state }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Create vectors for lerping
  const targetPos = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
  const targetRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.rotation);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    
    // Lerp Position
    groupRef.current.position.lerp(targetPos, 10 * delta);
    
    // Slerp Rotation
    groupRef.current.quaternion.slerp(targetRot, 10 * delta);
  });

  if (state.isDead) return null;

  return (
    <group ref={groupRef} position={[state.position.x, state.position.y, state.position.z]}>
       {/* Body */}
       <mesh position={[0, 1, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.5, 1.5, 4, 8]} />
          <meshStandardMaterial color={state.color === '#3498db' ? '#3498db' : '#e74c3c'} /> 
          {/* Fallback logic: if it's an opponent, usually red, but we use state color */}
        </mesh>
        
        {/* Visor */}
        <mesh position={[0, 1.5, 0.4]}>
          <boxGeometry args={[0.6, 0.3, 0.4]} />
          <meshStandardMaterial color="black" />
        </mesh>

        {/* Floating Health Bar or Name (simplified) */}
        <mesh position={[0, 2.5, 0]}>
           <planeGeometry args={[1, 0.2]} />
           <meshBasicMaterial color="red" />
           <mesh position={[-0.5 + (state.hp/200), 0, 0.01]}>
              <planeGeometry args={[state.hp / 100, 0.15]} />
              <meshBasicMaterial color="#00ff00" />
           </mesh>
        </mesh>
    </group>
  );
};

export default Opponent;
