import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { PLAYER_SPEED } from '../constants';

interface PlayerProps {
  id: string;
  onShoot: (position: THREE.Vector3, direction: THREE.Vector3) => void;
  onUpdate: (position: THREE.Vector3, rotation: number) => void;
}

const Player: React.FC<PlayerProps> = ({ id, onShoot, onUpdate }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Group>(null);
  
  // Use selector to get stable player state
  const playerState = useGameStore(state => state.players[id]);
  
  // Refs for logic
  const prevShootTimestamp = useRef(0);
  const prevJumpTimestamp = useRef(0);

  const { camera } = useThree();

  // Temporary vectors for math
  const cameraTarget = new THREE.Vector3();

  useFrame((state, delta) => {
    if (!rigidBodyRef.current || !playerState || playerState.isDead) return;

    // PERFORMANCE: Read inputs directly from store state
    const { joystickMove, shootTimestamp, jumpTimestamp, cameraAngle } = useGameStore.getState();

    // 1. Movement Logic (Relative to Camera)
    const currentVel = rigidBodyRef.current.linvel();
    
    // Calculate movement vector based on Camera Angle
    // joystickMove.x (Right/Left)
    // joystickMove.y (Forward/Back - Note: Joystick Y is usually +Up, so we use it as -Z for forward)
    const inputVector = new THREE.Vector3(joystickMove.x, 0, -joystickMove.y);
    
    // Rotate input vector by camera angle so "Up" on stick moves "Away" from camera
    inputVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

    if (inputVector.length() > 0.1) {
      inputVector.normalize().multiplyScalar(PLAYER_SPEED);
      // Preserve vertical velocity (gravity/jump)
      rigidBodyRef.current.setLinvel({ x: inputVector.x, y: currentVel.y, z: inputVector.z }, true);
      
      // Rotate character to face movement direction smoothly
      const targetRotation = Math.atan2(inputVector.x, inputVector.z);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRotation);
      rigidBodyRef.current.setRotation(q, true);
    } else {
      // Damping (stop horizontally but keep vertical)
      rigidBodyRef.current.setLinvel({ x: currentVel.x * 0.9, y: currentVel.y, z: currentVel.z * 0.9 }, true);
    }

    // 2. Jumping Logic
    if (jumpTimestamp > prevJumpTimestamp.current) {
        prevJumpTimestamp.current = jumpTimestamp;
        // Simple ground check: if vertical velocity is near zero
        if (Math.abs(currentVel.y) < 0.1) {
            rigidBodyRef.current.applyImpulse({ x: 0, y: 5, z: 0 }, true);
        }
    }

    // 3. Sync Rotation State for Network
    const rotationQ = rigidBodyRef.current.rotation();
    const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(rotationQ.x, rotationQ.y, rotationQ.z, rotationQ.w));
    
    // 4. Shooting Logic
    if (shootTimestamp > prevShootTimestamp.current) {
        prevShootTimestamp.current = shootTimestamp;
        
        const pos = rigidBodyRef.current.translation();
        const spawnPos = new THREE.Vector3(pos.x, pos.y + 1, pos.z);
        
        // Shoot in direction character is facing
        let shootAngle = euler.y;
        
        // If standing still, snap shoot direction to camera forward? 
        // For better UX, let's keep it based on character facing for now, 
        // assuming user rotates char by moving.
        
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), shootAngle);
        spawnPos.add(forward.clone().multiplyScalar(1.2));
        
        onShoot(spawnPos, forward);
    }

    // 5. Network Sync
    const pos = rigidBodyRef.current.translation();
    onUpdate(new THREE.Vector3(pos.x, pos.y, pos.z), euler.y);

    // 6. Camera Orbit Logic (Revised for better feel)
    // Reduced distance and height for a closer, more "Action" feel.
    const dist = 14; 
    const height = 10; 
    
    // Calculate offset based on angle
    const offsetX = Math.sin(cameraAngle) * dist;
    const offsetZ = Math.cos(cameraAngle) * dist;

    // Look slightly above player center
    cameraTarget.set(pos.x, pos.y + 1.5, pos.z); 
    
    const desiredCamPos = new THREE.Vector3(
        pos.x + offsetX,
        pos.y + height,
        pos.z + offsetZ
    );

    // Smooth camera follow
    state.camera.position.lerp(desiredCamPos, 0.15);
    state.camera.lookAt(cameraTarget);
  });

  if (!playerState || playerState.isDead) return null;

  return (
    <RigidBody 
      ref={rigidBodyRef} 
      position={[playerState.position.x, playerState.position.y, playerState.position.z]} 
      colliders={false} 
      enabledRotations={[false, true, false]}
      type="dynamic"
    >
      <CapsuleCollider args={[0.75, 0.5]} position={[0, 1.25, 0]} />
      <group ref={meshRef}>
        {/* Main Body */}
        <mesh position={[0, 1, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.5, 1.5, 4, 8]} />
          <meshStandardMaterial color={playerState.color} />
        </mesh>
        
        {/* Goggles / Eye - indicates direction */}
        <mesh position={[0, 1.5, 0.35]}>
          <boxGeometry args={[0.7, 0.25, 0.3]} />
          <meshStandardMaterial color="#111" roughness={0.2} />
        </mesh>
        
        {/* Weapon / Arm */}
        <mesh position={[0.45, 1.1, 0.4]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.2, 0.2, 0.8]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </RigidBody>
  );
};

export default Player;