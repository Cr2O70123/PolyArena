export const MAP_SIZE = 50;
export const PLAYER_SPEED = 6;
export const BULLET_SPEED = 20;
export const FIRE_RATE = 500; // ms
export const MAX_HP = 100;
export const RESPAWN_TIME = 3000;

// Use WSS (Secure WebSocket) for production compatibility.
// If you are developing locally with a separate PartyKit server, use 'ws://localhost:1999...'
// For Vercel, this needs to point to your deployed PartyKit URL.
// We default to a secure localhost placeholder which will fail gracefully rather than security block.
// REPLACE THIS with your actual PartyKit URL (e.g. wss://polyarena.yourname.partykit.dev)
export const WS_URL = 'wss://polyarena-party.edward-hong.partykit.dev/party/polyarena'; 

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