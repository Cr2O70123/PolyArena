import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from './store';
import GameScene from './components/GameScene';
import Joystick from './components/Joystick';
import { PlayerState } from './types';

const App: React.FC = () => {
  const { 
    phase, nickname, setNickname, setPhase, setMyId, updatePlayer,
    setJoystickMove, setCameraAngle, triggerShoot, triggerJump,
    resetGame, players, myId
  } = useGameStore();
  
  const [localName, setLocalName] = useState('');
  const touchLookRef = useRef<{ startX: number, startAngle: number } | null>(null);

  // Desktop Controls (Keyboard + Mouse Look)
  useEffect(() => {
    const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, " ": false };
    
    const updateMove = () => {
      let x = 0;
      let y = 0;
      if (keys.w || keys.ArrowUp) y += 1;
      if (keys.s || keys.ArrowDown) y -= 1;
      if (keys.a || keys.ArrowLeft) x -= 1;
      if (keys.d || keys.ArrowRight) x += 1;
      
      // Normalize if diagonal
      if (x !== 0 || y !== 0) {
        const length = Math.sqrt(x*x + y*y);
        x /= length;
        y /= length;
      }
      setJoystickMove(x, y);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        triggerJump();
      }
      if (Object.prototype.hasOwnProperty.call(keys, e.key)) {
        (keys as any)[e.key] = true;
        updateMove();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (Object.prototype.hasOwnProperty.call(keys, e.key)) {
        (keys as any)[e.key] = false;
        updateMove();
      }
    };

    // Mouse Look (Pointer Lock)
    const handleMouseMove = (e: MouseEvent) => {
      if (phase === 'PLAYING' && document.pointerLockElement === document.body) {
         // Adjust sensitivity as needed
         const sensitivity = 0.005;
         // Subtracting because dragging left (negative) should rotate camera left (reduce angle)
         setCameraAngle(useGameStore.getState().cameraAngle - e.movementX * sensitivity);
      }
    };
    
    const handleMouseDown = (e: MouseEvent) => {
        if (phase === 'PLAYING') {
           // Request pointer lock on click if not locked
           if (document.pointerLockElement !== document.body) {
              document.body.requestPointerLock();
           } else {
              // If locked, left click shoots
              if (e.button === 0) triggerShoot();
           }
        }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [phase]);

  // Touch Look Logic (Right side of screen)
  const handleTouchLookStart = (e: React.TouchEvent) => {
     const touch = e.changedTouches[0];
     // Only if touch is on the right half of the screen (approx)
     touchLookRef.current = {
         startX: touch.clientX,
         startAngle: useGameStore.getState().cameraAngle
     };
  };

  const handleTouchLookMove = (e: React.TouchEvent) => {
     if (!touchLookRef.current) return;
     const touch = e.changedTouches[0];
     const deltaX = touch.clientX - touchLookRef.current.startX;
     
     // Sensitivity for touch
     const sensitivity = 0.01; 
     setCameraAngle(touchLookRef.current.startAngle - deltaX * sensitivity);
  };

  const handleTouchLookEnd = () => {
     touchLookRef.current = null;
  };

  const handleStart = () => {
    if (!localName.trim()) return;
    const id = uuidv4();
    setNickname(localName);
    setMyId(id);
    // Optimistic spawn
    updatePlayer(id, {
        id,
        nickname: localName,
        position: { x: 0, y: 1, z: 0 },
        rotation: 0,
        hp: 100,
        isDead: false,
        score: 0,
        color: '#3b82f6',
        team: 'blue'
    });
    setPhase('PLAYING');
  };

  const handleRestart = () => {
    resetGame();
  };

  const myPlayer = myId ? players[myId] : null;

  // Leaderboard Logic
  const leaderboard = Object.values(players)
    .sort((a: PlayerState, b: PlayerState) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden select-none font-sans text-white">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0" 
           onMouseDown={(e) => {
             // Ensure click on canvas triggers pointer lock logic
             if(phase === 'PLAYING' && document.pointerLockElement !== document.body) {
               document.body.requestPointerLock();
             }
           }}>
        {(phase === 'PLAYING' || phase === 'DEAD') && <GameScene />}
      </div>

      {/* Lobby Interface */}
      {phase === 'LOBBY' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
          <div className="bg-white/10 p-8 rounded-2xl shadow-2xl border border-white/10 w-full max-w-md backdrop-blur-md">
            <h1 className="text-5xl font-black text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              POLY ARENA
            </h1>
            <p className="text-gray-300 text-center mb-8 tracking-widest text-sm font-bold">多人連線大亂鬥</p>
            
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="輸入您的暱稱"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                className="w-full bg-black/40 border border-white/20 rounded-xl py-4 px-6 text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center"
              />
              
              <button 
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/30 text-xl tracking-wider"
              >
                開始戰鬥
              </button>
            </div>
            
            <p className="mt-4 text-xs text-center text-gray-500">
              支援: 手機觸控 / 電腦鍵盤 WASD + 空白鍵跳躍 + 滑鼠
            </p>
          </div>
        </div>
      )}

      {/* In-Game HUD */}
      {phase === 'PLAYING' && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Top Bar */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 animate-fade-in">
             <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg border-2 border-white/20">
                    {nickname.charAt(0).toUpperCase()}
                </div>
                <div className="text-lg font-bold text-white drop-shadow-md">{nickname}</div>
             </div>
             
             <div className="relative w-64 h-6 bg-black/60 rounded-full overflow-hidden border border-white/10 backdrop-blur-sm">
                <div 
                  className={`h-full transition-all duration-300 ease-out ${myPlayer && myPlayer.hp < 30 ? 'bg-gradient-to-r from-red-600 to-red-500' : 'bg-gradient-to-r from-green-500 to-emerald-400'}`}
                  style={{ width: `${myPlayer ? myPlayer.hp : 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/90 drop-shadow-sm">
                   {myPlayer?.hp || 100} / 100 HP
                </span>
             </div>
          </div>

          {/* Leaderboard */}
          <div className="absolute top-6 right-6 bg-black/40 p-4 rounded-xl backdrop-blur-md border border-white/5 w-48">
            <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">排行榜</h3>
            {leaderboard.map((p: PlayerState, i) => (
              <div key={p.id} className="flex justify-between items-center text-sm gap-2 mb-2 last:mb-0">
                <span className={`truncate font-medium ${p.id === myId ? 'text-yellow-400' : 'text-gray-200'}`}>
                  {i+1}. {p.nickname || 'Unknown'}
                </span>
                <span className="font-mono font-bold text-white bg-white/10 px-2 rounded text-xs">{p.score}</span>
              </div>
            ))}
          </div>

          {/* Mobile: Left Joystick for Move */}
          <div className="absolute bottom-12 left-12 pointer-events-auto opacity-80 hover:opacity-100 transition-opacity">
             <Joystick 
               label="移動"
               onMove={(x, y) => setJoystickMove(x, y)} 
             />
          </div>

          {/* Mobile: Touch Look Zone (Right half of screen) */}
          <div 
             className="absolute top-0 right-0 w-1/2 h-full pointer-events-auto z-0 touch-none"
             onTouchStart={handleTouchLookStart}
             onTouchMove={handleTouchLookMove}
             onTouchEnd={handleTouchLookEnd}
          />

          {/* Mobile Actions Container */}
          <div className="absolute bottom-12 right-12 pointer-events-auto z-20 flex flex-col gap-4">
            
            {/* Jump Button (Mobile) */}
             <button
               className="w-16 h-16 rounded-full bg-blue-600/80 border-2 border-white/30 shadow-lg active:bg-blue-700 active:scale-95 transition-all flex items-center justify-center backdrop-blur-sm mb-2"
               onTouchStart={(e) => {
                 e.preventDefault();
                 triggerJump();
               }}
               onMouseDown={(e) => e.stopPropagation()} 
             >
                <div className="font-bold text-xs uppercase tracking-wider">Jump</div>
             </button>

             {/* Shoot Button (Mobile) */}
             <button
               className="w-24 h-24 rounded-full bg-red-600/80 border-4 border-white/30 shadow-lg active:bg-red-700 active:scale-95 transition-all flex items-center justify-center backdrop-blur-sm"
               onTouchStart={(e) => {
                 e.preventDefault();
                 triggerShoot();
               }}
               onMouseDown={(e) => e.stopPropagation()} 
             >
                <div className="w-12 h-12 border-2 border-white rounded-full flex items-center justify-center">
                   <div className="w-8 h-8 bg-white rounded-full" />
                </div>
             </button>
          </div>
          
          {/* Desktop Hint */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/30 text-xs hidden md:block bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
            WASD 移動 • 空白鍵 跳躍 • 滑鼠 轉視角 • 左鍵 射擊
          </div>
        </div>
      )}

      {/* Dead / Respawn Screen */}
      {phase === 'DEAD' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md animate-pulse-slow">
          <h2 className="text-8xl font-black text-red-500 mb-2 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] tracking-tighter">
            陣亡
          </h2>
          <p className="text-2xl text-red-200 mb-10 font-light">你被擊殺了</p>
          
          <div className="bg-black/30 p-6 rounded-xl mb-8 backdrop-blur-sm border border-red-500/30">
             <div className="text-center">
                <span className="text-gray-400 text-sm uppercase tracking-widest">最終得分</span>
                <div className="text-4xl font-mono font-bold text-white">{myPlayer?.score || 0}</div>
             </div>
          </div>

          <button 
            onClick={handleRestart}
            className="px-12 py-4 bg-white text-red-900 font-black text-xl rounded-full shadow-2xl hover:bg-gray-100 transition-transform hover:scale-105 active:scale-95 tracking-wider"
          >
            重新復活
          </button>
        </div>
      )}
    </div>
  );
};

export default App;