import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, BallCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { BULLET_SPEED, COLORS } from '../constants';
import { BulletState } from '../types';

interface BulletProps {
  data: BulletState;
  onHit: (bulletId: string, targetId?: string) => void;
}

const Bullet: React.FC<BulletProps> = ({ data, onHit }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  
  useEffect(() => {
    if (rigidBodyRef.current) {
      // Set initial velocity
      const vel = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z)
        .normalize()
        .multiplyScalar(BULLET_SPEED);
      rigidBodyRef.current.setLinvel(vel, true);
    }
  }, []); // Run once on mount

  useFrame(() => {
    // Optional: Destroy if too far or too old (handled by parent typically)
  });

  return (
    <RigidBody 
      ref={rigidBodyRef} 
      position={[data.position.x, data.position.y, data.position.z]} 
      sensor // Bullet is a sensor, triggers intersection events but doesn't bounce physically
      onIntersectionEnter={(payload) => {
        // Only hit dynamic objects (players) or fixed (walls), ignore other sensors
        // Rapier `other.rigidBodyObject` can help identify what we hit
        // Ideally we check user data. For this sim:
        onHit(data.id); 
      }}
      userData={{ type: 'bullet', id: data.id, owner: data.ownerId }}
    >
      <BallCollider args={[0.2]} />
      <mesh>
        <sphereGeometry args={[0.2]} />
        <meshStandardMaterial color={COLORS.bullet} emissive={COLORS.bullet} emissiveIntensity={2} />
      </mesh>
    </RigidBody>
  );
};

export default Bullet;
