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
  
  // Use selector to get stable player state (color, etc)
  const playerState = useGameStore(state => state.players[id]);
  
  // Ref to track previous shoot timestamp to detect new triggers
  const prevShootTimestamp = useRef(0);

  const { camera } = useThree();

  // Temporary vectors for math
  const moveDirection = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  useFrame((state, delta) => {
    if (!rigidBodyRef.current || !playerState || playerState.isDead) return;

    // PERFORMANCE FIX: Read inputs directly from store state
    const { joystickMove, shootTimestamp, cameraAngle } = useGameStore.getState();

    // 1. Movement Logic (Relative to Camera)
    // joystickMove.x is Left/Right, joystickMove.y is Forward/Back (Up/Down on screen)
    
    // Create a vector based on joystick input
    // In 3D space: x is right, z is forward/back. 
    // We invert Y from joystick because usually Up(-1) is Forward(-z)
    const inputVector = new THREE.Vector3(joystickMove.x, 0, -joystickMove.y);

    // Apply camera rotation to the input vector so "Up" moves away from camera
    inputVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

    const currentVel = rigidBodyRef.current.linvel();

    if (inputVector.length() > 0.1) {
      inputVector.normalize().multiplyScalar(PLAYER_SPEED);
      rigidBodyRef.current.setLinvel({ x: inputVector.x, y: currentVel.y, z: inputVector.z }, true);
      
      // Rotate character to face movement direction smoothly
      const targetRotation = Math.atan2(inputVector.x, inputVector.z);
      
      // Smooth rotation (optional, but looks better)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRotation);
      rigidBodyRef.current.setRotation(q, true);
    } else {
      // Damping
      rigidBodyRef.current.setLinvel({ x: currentVel.x * 0.9, y: currentVel.y, z: currentVel.z * 0.9 }, true);
      // Keep previous rotation when stopping
    }

    // 2. Sync Rotation State for Network
    // We want the network to know the character's facing direction
    // If moving, it's movement dir. If shooting (and not moving), we might want to face camera dir?
    // For now, let's assume character faces movement, or if stopped, keeps facing.
    const rotationQ = rigidBodyRef.current.rotation();
    const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(rotationQ.x, rotationQ.y, rotationQ.z, rotationQ.w));
    
    // 3. Shooting Logic
    if (shootTimestamp > prevShootTimestamp.current) {
        prevShootTimestamp.current = shootTimestamp;
        
        // Calculate spawn position
        const pos = rigidBodyRef.current.translation();
        const spawnPos = new THREE.Vector3(pos.x, pos.y + 1, pos.z);
        
        // Shooting direction:
        // If moving, shoot forward. 
        // If standing still, shoot in direction of camera? Or character forward?
        // Let's shoot in the direction of the Character's current facing.
        const charRotation = euler.y;
        
        // However, usually in TPS, you shoot where the camera is looking if you use crosshair.
        // But this is top-down-ish. Let's shoot where the character is facing.
        // Better UX: If standing still, snap character to face camera direction then shoot?
        // Let's use simple character forward for now.
        
        // Improvement: If input is zero, use Camera Angle as shoot direction
        let shootAngle = charRotation;
        if (inputVector.length() < 0.1) {
            shootAngle = cameraAngle + Math.PI; // Camera is behind, so angle is consistent?
            // Actually cameraAngle 0 means camera is at +Z looking at 0,0 (South to North)
            // Let's just use the character's last rotation for stability.
        }

        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), shootAngle);
        spawnPos.add(forward.clone().multiplyScalar(1.2));
        
        onShoot(spawnPos, forward);
    }

    // 4. Network Sync
    const pos = rigidBodyRef.current.translation();
    onUpdate(new THREE.Vector3(pos.x, pos.y, pos.z), euler.y);

    // 5. Camera Orbit Logic
    // Camera position is calculated based on player position + offset rotated by cameraAngle
    const dist = 30; // Distance from player
    const height = 25; // Height above player
    
    // Calculate offset based on angle
    // angle 0: Camera at +z (looking -z)
    const offsetX = Math.sin(cameraAngle) * dist;
    const offsetZ = Math.cos(cameraAngle) * dist;

    cameraTarget.set(pos.x, pos.y + 2, pos.z); // Look slightly above player center
    
    const desiredCamPos = new THREE.Vector3(
        pos.x + offsetX,
        pos.y + height,
        pos.z + offsetZ
    );

    // Smooth camera follow
    state.camera.position.lerp(desiredCamPos, 0.2); // Faster lerp for responsive rotation
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