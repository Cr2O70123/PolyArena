import { create } from 'zustand';
import { PlayerState, GamePhase, Vector3 } from './types';
import { MAX_HP } from './constants';

interface GameStore {
  // Game Status
  phase: GamePhase;
  myId: string | null;
  nickname: string;
  
  // Players
  players: Record<string, PlayerState>;
  
  // Inputs
  joystickMove: { x: number; y: number };
  cameraAngle: number; // Horizontal rotation angle in radians
  
  // Actions to bridge UI and 3D
  shootTimestamp: number;
  jumpTimestamp: number; // New: Jump trigger

  // Actions
  setPhase: (phase: GamePhase) => void;
  setNickname: (name: string) => void;
  setMyId: (id: string) => void;
  updatePlayer: (id: string, data: Partial<PlayerState>) => void;
  removePlayer: (id: string) => void;
  setJoystickMove: (x: number, y: number) => void;
  setCameraAngle: (angle: number) => void;
  triggerShoot: () => void;
  triggerJump: () => void; // New action
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  phase: 'LOBBY',
  myId: null,
  nickname: '',
  players: {},
  joystickMove: { x: 0, y: 0 },
  cameraAngle: 0,
  shootTimestamp: 0,
  jumpTimestamp: 0,

  setPhase: (phase) => set({ phase }),
  setNickname: (nickname) => set({ nickname }),
  setMyId: (myId) => set({ myId }),
  
  updatePlayer: (id, data) => set((state) => {
    const existing = state.players[id];
    if (!existing) {
       // Init new player
       return {
         players: {
           ...state.players,
           [id]: {
             id,
             nickname: 'Unknown',
             position: { x: 0, y: 1, z: 0 },
             rotation: 0,
             hp: MAX_HP,
             isDead: false,
             score: 0,
             color: '#ffffff',
             team: 'blue',
             ...data
           }
         }
       };
    }
    return {
      players: {
        ...state.players,
        [id]: { ...existing, ...data }
      }
    };
  }),

  removePlayer: (id) => set((state) => {
    const { [id]: _, ...rest } = state.players;
    return { players: rest };
  }),

  setJoystickMove: (x, y) => set({ joystickMove: { x, y } }),
  setCameraAngle: (angle) => set({ cameraAngle: angle }),
  triggerShoot: () => set({ shootTimestamp: Date.now() }),
  triggerJump: () => set({ jumpTimestamp: Date.now() }),

  resetGame: () => set((state) => ({
    players: {},
    phase: 'LOBBY',
    myId: null,
    joystickMove: { x: 0, y: 0 },
    cameraAngle: 0,
  })),
}));