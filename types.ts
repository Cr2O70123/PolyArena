export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  nickname: string;
  position: Vector3;
  rotation: number; // Y-axis rotation in radians
  hp: number;
  isDead: boolean;
  score: number;
  color: string;
  team: 'red' | 'blue';
}

export interface BulletState {
  id: string;
  ownerId: string;
  position: Vector3;
  direction: Vector3;
  timestamp: number;
}

export type GamePhase = 'LOBBY' | 'PLAYING' | 'DEAD';

// Network Message Types
export type NetMessage = 
  | { type: 'join'; id: string; nickname: string }
  | { type: 'update'; id: string; position: Vector3; rotation: number }
  | { type: 'shoot'; id: string; position: Vector3; direction: Vector3 }
  | { type: 'hit'; targetId: string; damage: number; sourceId: string }
  | { type: 'kill'; killerId: string; victimId: string }
  | { type: 'sync'; players: Record<string, PlayerState> };

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      capsuleGeometry: any;
      meshStandardMaterial: any;
      boxGeometry: any;
      planeGeometry: any;
      meshBasicMaterial: any;
      sphereGeometry: any;
      gridHelper: any;
      ambientLight: any;
      directionalLight: any;
      hemisphereLight: any;
      orthographicCamera: any;
      color: any;
    }
  }
}