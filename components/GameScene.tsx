import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics, RigidBody } from '@react-three/rapier';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

import { useGameStore } from '../store';
import { MAP_SIZE, COLORS, OBSTACLES, WS_URL } from '../constants';
import { BulletState, Vector3 } from '../types';

import Player from './Player';
import Opponent from './Opponent';
import Bullet from './Bullet';

// PartyKit WebSocket Logic inside the component for simplicity in this file structure
const GameScene: React.FC = () => {
  const { 
    myId, players, updatePlayer, removePlayer, 
    joystickMove, joystickAim 
  } = useGameStore();

  const [bullets, setBullets] = useState<BulletState[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // 1. Connection Logic
  useEffect(() => {
    if (!myId) return;

    // In a real app, you might use usePartySocket from partykit/react
    // Here we use native WS for generic support
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Connected to Game Server');
      socket.send(JSON.stringify({ 
        type: 'join', 
        id: myId, 
        nickname: useGameStore.getState().nickname 
      }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch(msg.type) {
        case 'sync':
          Object.values(msg.players).forEach((p: any) => {
            if (p.id !== myId) updatePlayer(p.id, p);
          });
          break;
        case 'update':
          if (msg.id !== myId) updatePlayer(msg.id, { position: msg.position, rotation: msg.rotation });
          break;
        case 'shoot':
          if (msg.id !== myId) spawnBullet(msg.id, msg.position, msg.direction);
          break;
        case 'hit':
             // Apply damage locally for visual feedback or score
             const target = players[msg.targetId];
             if (target) {
                 const newHp = Math.max(0, target.hp - msg.damage);
                 updatePlayer(msg.targetId, { hp: newHp, isDead: newHp <= 0 });
             }
          break;
        case 'kill':
            // Show kill feed?
            break;
      }
    };

    return () => {
      socket.close();
    };
  }, [myId]);

  // 2. Broadcast Loop (30Hz)
  useEffect(() => {
    if (!myId || !players[myId]) return;
    
    const interval = setInterval(() => {
       const p = players[myId];
       if (socketRef.current?.readyState === WebSocket.OPEN && !p.isDead) {
          socketRef.current.send(JSON.stringify({
             type: 'update',
             id: myId,
             position: p.position,
             rotation: p.rotation
          }));
       }
    }, 1000 / 30);

    return () => clearInterval(interval);
  }, [myId, players]);


  // 3. Game Logic Handlers
  const spawnBullet = (ownerId: string, pos: Vector3, dir: Vector3) => {
      const bullet: BulletState = {
          id: uuidv4(),
          ownerId,
          position: pos,
          direction: dir,
          timestamp: Date.now()
      };
      setBullets(prev => [...prev, bullet]);
      
      // Cleanup bullet after 2s
      setTimeout(() => {
          setBullets(prev => prev.filter(b => b.id !== bullet.id));
      }, 2000);
  };

  const handlePlayerShoot = (pos: THREE.Vector3, dir: THREE.Vector3) => {
      if (!myId) return;
      spawnBullet(myId, pos, dir);
      
      // Notify server
      if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
              type: 'shoot',
              id: myId,
              position: pos,
              direction: dir
          }));
      }
  };
  
  // Logic to trigger shoot on joystick release is handled in App.tsx (UI layer)
  // But we need a way to pass that trigger down. 
  // For now, let's expose a method or rely on the prop passed to Player.

  const handlePlayerUpdate = (pos: THREE.Vector3, rot: number) => {
      if (!myId) return;
      // Update local store immediately for responsiveness
      updatePlayer(myId, { position: pos, rotation: rot });
  };

  const handleBulletHit = (bulletId: string, targetId?: string) => {
      // Remove bullet
      setBullets(