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
  const lastShootTimeRef = useRef(0);
  
  // Use selector to get stable player state (color, etc)
  const playerState = useGameStore(state => state.players[id]);
  
  // Ref to track previous shoot timestamp to detect new triggers
  const prevShootTimestamp = useRef(0);

  const { camera } = useThree();

  // Camera settings
  const cameraOffset = new THREE.Vector3(0, 25, 25);
  const cameraTarget = new THREE.Vector3();

  useFrame((state, delta) => {
    if (!rigidBodyRef.current || !playerState || playerState.isDead) return;

    // PERFORMANCE FIX: Read inputs directly from store state to avoid re-renders
    const { joystickMove, joystickAim, shootTimestamp } = useGameStore.getState();

    // 1. Movement Logic
    const moveX = joystickMove.x;
    const moveZ = -joystickMove.y; // Joystick Y is inverted
    
    const direction = new THREE.Vector3(moveX, 0, moveZ);
    const currentVel = rigidBodyRef.current.linvel();

    if (direction.length() > 0.1) {
      direction.normalize().multiplyScalar(PLAYER_SPEED);
      rigidBodyRef.current.setLinvel({ x: direction.x, y: currentVel.y, z: direction.z }, true);
    } else {
      // Damping
      rigidBodyRef.current.setLinvel({ x: currentVel.x * 0.9, y: currentVel.y, z: currentVel.z * 0.9 }, true);
    }

    // 2. Rotation Logic
    let rotation = playerState.rotation;
    
    // Aim takes priority
    if (joystickAim.active && (Math.abs(joystickAim.x) > 0.1 || Math.abs(joystickAim.y) > 0.1)) {
        rotation = Math.atan2(joystickAim.x, joystickAim.y);
    } else if (direction.length() > 0.1) {
        // Look at movement direction if not aiming
        rotation = Math.atan2(direction.x, direction.z);
    }
    
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    rigidBodyRef.current.setRotation(q, true);

    // 3. Shooting Logic (Detect timestamp change)
    if (shootTimestamp > prevShootTimestamp.current) {
        prevShootTimestamp.current = shootTimestamp;
        
        // Calculate spawn position (slightly in front of player)
        const pos = rigidBodyRef.current.translation();
        const spawnPos = new THREE.Vector3(pos.x, pos.y + 1, pos.z);
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
        spawnPos.add(forward.multiplyScalar(1.2));
        
        onShoot(spawnPos, forward);
    }

    // 4. Network Sync (Throttle if needed, but here simple)
    const pos = rigidBodyRef.current.translation();
    onUpdate(new THREE.Vector3(pos.x, pos.y, pos.z), rotation);

    // 5. Camera Follow
    cameraTarget.set(pos.x, pos.y, pos.z);
    const desiredCamPos = cameraTarget.clone().add(cameraOffset);
    state.camera.position.lerp(desiredCamPos, 0.1);
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
        
        {/* Goggles / Eye */}
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