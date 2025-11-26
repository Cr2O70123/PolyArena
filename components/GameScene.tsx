import React, { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { SoftShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import PartySocket from 'partysocket';

import { useGameStore } from '../store';
import { MAP_SIZE, COLORS, OBSTACLES, WS_URL } from '../constants';
import { PlayerState } from '../types';

import Player from './Player';
import Opponent from './Opponent';
import Bullet from './Bullet';

// Map Component
const GameMap = () => {
  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" friction={1}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        <CuboidCollider args={[MAP_SIZE / 2, 0.5, MAP_SIZE / 2]} position={[0, -0.5, 0]} />
      </RigidBody>

      {/* Grid Helper for visual reference */}
      <gridHelper args={[MAP_SIZE, 25, '#64748b', '#475569']} position={[0, 0.01, 0]} />

      {/* Walls/Obstacles */}
      {OBSTACLES.map((obs) => (
        <RigidBody key={obs.id} type="fixed" position={[obs.x, obs.height / 2, obs.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[obs.width, obs.height, obs.depth]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.5} />
          </mesh>
        </RigidBody>
      ))}

      {/* Boundary Walls */}
      <RigidBody type="fixed">
         <CuboidCollider args={[MAP_SIZE/2, 5, 1]} position={[0, 2, -MAP_SIZE/2]} />
         <CuboidCollider args={[MAP_SIZE/2, 5, 1]} position={[0, 2, MAP_SIZE/2]} />
         <CuboidCollider args={[1, 5, MAP_SIZE/2]} position={[-MAP_SIZE/2, 2, 0]} />
         <CuboidCollider args={[1, 5, MAP_SIZE/2]} position={[MAP_SIZE/2, 2, 0]} />
      </RigidBody>
    </group>
  );
};

const GameSceneContent: React.FC = () => {
  const { 
    players, updatePlayer, removePlayer, myId, 
    shootTimestamp, triggerShoot 
  } = useGameStore();

  const [bullets, setBullets] = useState<any[]>([]);
  const socketRef = useRef<PartySocket | null>(null);

  // WebSocket Connection Management
  useEffect(() => {
    const ws = new PartySocket({
      host: WS_URL,
      room: "polyarena-main"
    });

    ws.addEventListener('open', () => {
      const currentMyId = useGameStore.getState().myId;
      if (currentMyId) {
        ws.send(JSON.stringify({
          type: 'join',
          id: currentMyId,
          nickname: useGameStore.getState().nickname
        }));
      }
    });

    ws.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data);
      switch (msg.type) {
        case 'sync':
          if (msg.players) {
            Object.values(msg.players).forEach((p: any) => {
              updatePlayer(p.id, p);
            });
          }
          break;
        case 'update':
          updatePlayer(msg.id, { position: msg.position, rotation: msg.rotation });
          break;
        case 'shoot':
          const bulletId = `${msg.id}-${Date.now()}`;
          setBullets(prev => [...prev, { ...msg, id: bulletId, timestamp: Date.now() }]);
          break;
        case 'hit':
            // Hit logic handled via state sync
            break;
      }
    });

    socketRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  // Handle local player updates sending to server
  const handleLocalUpdate = (position: THREE.Vector3, rotation: number) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !myId) return;
    
    socket.send(JSON.stringify({
      type: 'update',
      id: myId,
      position,
      rotation
    }));
  };

  const handleLocalShoot = (position: THREE.Vector3, direction: THREE.Vector3) => {
    // Also spawn local bullet immediately
    const bulletId = `${myId}-${Date.now()}`;
    setBullets(prev => [...prev, { id: bulletId, ownerId: myId, position, direction, timestamp: Date.now() }]);

    const socket = socketRef.current;
    if (!socket || !myId) return;
    socket.send(JSON.stringify({
      type: 'shoot',
      id: myId,
      position,
      direction
    }));
  };

  return (
    <>
      <Environment preset="city" />
      <hemisphereLight intensity={0.6} color="#ffffff" groundColor="#444444" />
      <directionalLight 
        position={[20, 50, 20]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30]} />
      </directionalLight>
      <ambientLight intensity={0.5} />

      <Physics gravity={[0, -20, 0]}>
        <GameMap />
        
        {Object.values(players).map((p: PlayerState) => {
          if (p.id === myId) {
            return (
              <Player 
                key={p.id} 
                id={p.id} 
                onUpdate={handleLocalUpdate}
                onShoot={handleLocalShoot}
              />
            );
          } else {
            return <Opponent key={p.id} state={p} />;
          }
        })}

        {bullets.map(b => (
           <Bullet 
             key={b.id} 
             data={b} 
             onHit={(bid, targetId) => {
                if (b.ownerId === myId && targetId && targetId !== myId) {
                   const socket = socketRef.current;
                   if (socket && socket.readyState === WebSocket.OPEN) {
                       socket.send(JSON.stringify({
                          type: 'hit',
                          targetId,
                          sourceId: myId,
                          damage: 10
                       }));
                   }
                }
                setBullets(prev => prev.filter(x => x.id !== b.id));
             }} 
           />
        ))}
      </Physics>
    </>
  );
};

const GameScene: React.FC = () => {
  return (
    <Canvas shadows camera={{ position: [0, 20, 20], fov: 45 }}>
      <color attach="background" args={['#1e293b']} />
      <GameSceneContent />
      <SoftShadows size={10} samples={16} />
    </Canvas>
  );
};

export default GameScene;