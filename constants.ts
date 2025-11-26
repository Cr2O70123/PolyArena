export const MAP_SIZE = 50;
export const PLAYER_SPEED = 6;
export const BULLET_SPEED = 20;
export const FIRE_RATE = 500; // ms
export const MAX_HP = 100;
export const RESPAWN_TIME = 3000;
export const WS_URL = 'ws://localhost:1999/party/polyarena'; // Default PartyKit dev URL

export const COLORS = {
  floor: '#2c3e50',
  wall: '#34495e',
  playerSelf: '#3498db',
  playerEnemy: '#e74c3c',
  bullet: '#f1c40f',
};

// Mock map generation
export const OBSTACLES = Array.from({ length: 20 }).map((_, i) => ({
  id: `obs-${i}`,
  x: (Math.random() - 0.5) * (MAP_SIZE - 5),
  z: (Math.random() - 0.5) * (MAP_SIZE - 5),
  width: 2 + Math.random() * 3,
  height: 2 + Math.random() * 2,
  depth: 2 + Math.random() * 3,
}));
