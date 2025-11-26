import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody, euler, quat } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { PLAYER_SPEED, FIRE_RATE } from '../constants';

interface PlayerProps {
  id: string;
  onShoot: (position: THREE.Vector3, direction: THREE.Vector3) => void;
  onUpdate: (position: THREE.Vector3, rotation: number) => void;
}

const Player: React.FC<PlayerProps> = ({ id, onShoot, onUpdate }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Group>(null);
  
  const { joystickMove, joystickAim, players } = useGameStore();
  const playerState = players[id];

  const { camera } = useThree();
  const [lastFireTime, setLastFireTime] = useState(0);

  // Smooth camera follow
  const cameraOffset = new THREE.Vector3(0, 20, 20);
  const cameraTarget = new THREE.Vector3();

  useFrame((state, delta) => {
    if (!rigidBodyRef.current || !playerState || playerState.isDead) return;

    // 1. Movement Logic (Relative to world, isometric)
    const moveX = joystickMove.x;
    const moveZ = -joystickMove.y; // Joystick Y is inverted in 2D
    
    // Create movement vector
    const direction = new THREE.Vector3(moveX, 0, moveZ);
    if (direction.length() > 0.1) {
      direction.normalize().multiplyScalar(PLAYER_SPEED);
      
      // Apply velocity directly for snappy movement
      const vel = rigidBodyRef.current.linvel();
      rigidBodyRef.current.setLinvel({ x: direction.x, y: vel.y, z: direction.z }, true);
    } else {
      // Dampen horizontal velocity if no input
      const vel = rigidBodyRef.current.linvel();
      rigidBodyRef.current.setLinvel({ x: vel.x * 0.9, y: vel.y, z: vel.z * 0.9 }, true);
    }

    // 2. Rotation Logic (Aiming)
    let rotation = playerState.rotation;
    
    if (joystickAim.active && (Math.abs(joystickAim.x) > 0.1 || Math.abs(joystickAim.y) > 0.1)) {
        // Calculate angle from joystick
        // In screen space: Right is +X, Up is -Y. In 3D World: Right is +X, Forward is -Z.
        // Joystick Y is already inverted by the component (-Up, +Down).
        // Standard ATAN2(y, x). 
        // We want 0 rads to be facing -Z (North).
        
        // Let's rely on standard mapping: 
        // Joystick (0, 1) -> Up -> World (0, 0, -1)
        // Joystick (1, 0) -> Right -> World (1, 0, 0)
        
        const aimAngle = Math.atan2(joystickAim.x, joystickAim.y); 
        rotation = aimAngle;
        
        // Update rigid body rotation
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
        rigidBodyRef.current.setRotation(q, true);
    } else if (direction.length() > 0.1) {
        // If not aiming, look where moving
        const moveAngle = Math.atan2(direction.x, direction.z);
        rotation = moveAngle;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
        rigidBodyRef.current.setRotation(q, true);
    }

    // 3. Shooting Logic
    // We fire when joystick is released? The prompt says "Drag to aim, release to shoot"
    // However, handling "release" inside useFrame is tricky. 
    // Let's check `joystickAim.active`. If it WAS active and now isn't, we fired.
    // BUT the store updates reactively.
    // For simplicity in this loop, let's auto-fire if aiming at max magnitude or specialized trigger.
    // Actually, let's implement the prompt's "Right stick -> drag to aim, release to shoot" in the UI layer component
    // passing a specific `fire` trigger prop, OR standard dual stick shooter: always fire if holding?
    // User constraint: "release to shoot".
    // We will let the parent component call `onShoot` and handle logic there.
    
    // 4. Sync physics pos to visual & network
    const pos = rigidBodyRef.current.translation();
    
    // Network update (throttled by parent, but we provide data)
    onUpdate(new THREE.Vector3(pos.x, pos.y, pos.z), rotation);

    // 5. Camera Follow
    cameraTarget.set(pos.x, pos.y, pos.z);
    
    // Smooth Lerp Camera
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
        {/* Body */}
        <mesh position={[0, 1, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.5, 1.5, 4, 8]} />
          <meshStandardMaterial color={playerState.color} />
        </mesh>
        
        {/* Visor/Direction Indicator */}
        <mesh position={[0, 1.5, 0.4]}>
          <boxGeometry args={[0.6, 0.3, 0.4]} />
          <meshStandardMaterial color="black" />
        </mesh>
        
        {/* Weapon */}
        <mesh position={[0.4, 1.0, 0.5]}>
          <boxGeometry args={[0.2, 0.2, 0.8]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </group>
    </RigidBody>
  );
};

export default Player;
