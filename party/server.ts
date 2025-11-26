import type { Party, PartyKitServer, Connection } from "partykit/server";

interface Player {
  id: string;
  nickname: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  hp: number;
  score: number;
  isDead: boolean;
  team: 'red' | 'blue';
}

export default class GameServer implements PartyKitServer {
  players: Record<string, Player> = {};

  constructor(readonly party: Party) {}

  onConnect(conn: Connection, ctx: any) {
    console.log(`Connected: ${conn.id}`);
  }

  onClose(conn: Connection) {
    console.log(`Disconnected: ${conn.id}`);
    delete this.players[conn.id];
    // Broadcast disconnect so clients can remove the player
    // Note: In a robust app, we'd send a specific 'leave' message.
    // For this simple sync implementation, clients sync the full player list or handle it via update timeout.
    // But let's send a sync to be sure.
    this.party.broadcast(JSON.stringify({
      type: 'sync',
      players: this.players
    }));
  }

  onMessage(message: string, sender: Connection) {
    const msg = JSON.parse(message);

    switch (msg.type) {
      case 'join':
        this.players[msg.id] = {
          id: msg.id,
          nickname: msg.nickname || 'Unknown',
          position: { x: 0, y: 1, z: 0 },
          rotation: 0,
          hp: 100,
          score: 0,
          isDead: false,
          team: Object.keys(this.players).length % 2 === 0 ? 'blue' : 'red'
        };
        // Broadcast full state to everyone including sender
        this.party.broadcast(JSON.stringify({
          type: 'sync',
          players: this.players
        }));
        break;

      case 'update':
        if (this.players[msg.id]) {
          this.players[msg.id].position = msg.position;
          this.players[msg.id].rotation = msg.rotation;
          // Relay movement to others (excluding sender to save bandwidth/latency loop, though local interpolation handles it)
          this.party.broadcast(JSON.stringify(msg), [sender.id]);
        }
        break;

      case 'shoot':
        // Relay shoot event to everyone else
        this.party.broadcast(message, [sender.id]);
        break;

      case 'hit':
        // msg: { type: 'hit', targetId, damage, sourceId }
        const target = this.players[msg.targetId];
        const source = this.players[msg.sourceId];
        
        if (target && !target.isDead) {
          target.hp -= msg.damage;
          if (target.hp <= 0) {
            target.hp = 0;
            target.isDead = true;
            if (source) {
              source.score += 1;
            }
          }
          // Broadcast the hit/damage result to everyone
          this.party.broadcast(JSON.stringify({
             type: 'hit',
             targetId: msg.targetId,
             damage: msg.damage,
             sourceId: msg.sourceId
          }));
          
          // If dead, sync scores
          if (target.isDead) {
             this.party.broadcast(JSON.stringify({
                type: 'sync',
                players: this.players
             }));
          }
        }
        break;
    }
  }
}