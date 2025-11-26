import React, { useRef, useState, useEffect, useCallback } from 'react';

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  className?: string;
  label?: string;
}

const Joystick: React.FC<JoystickProps> = ({ onMove, onStart, onEnd, className, label }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Visual position of the stick
  const touchIdRef = useRef<number | null>(null);

  const RADIUS = 50; // Max drag radius

  const handleStart = useCallback((clientX: number, clientY: number, id: number | null) => {
    if (active) return;
    setActive(true);
    touchIdRef.current = id;
    if (onStart) onStart();
    handleMove(clientX, clientY);
  }, [active, onStart]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize output -1 to 1
    let normX = dx;
    let normY = dy;

    if (distance > RADIUS) {
      const ratio = RADIUS / distance;
      normX = dx * ratio;
      normY = dy * ratio;
    }

    setPosition({ x: normX, y: normY });
    
    // Output normalized vector
    const outX = normX / RADIUS;
    const outY = -(normY / RADIUS); // Invert Y for standard 2D cartesian up
    onMove(outX, outY);

  }, [onMove]);

  const handleEnd = useCallback(() => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
    touchIdRef.current = null;
    onMove(0, 0);
    if (onEnd) onEnd();
  }, [onMove, onEnd]);

  // Touch Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    // Only track the first touch that hits this zone
    const touch = e.changedTouches[0];
    handleStart(touch.clientX, touch.clientY, touch.identifier);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        handleMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        handleEnd();
        break;
      }
    }
  };

  // Mouse Handlers (for desktop testing)
  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY, null);
  };

  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      if (active && touchIdRef.current === null) {
        handleMove(e.clientX, e.clientY);
      }
    };
    const onWindowMouseUp = (e: MouseEvent) => {
      if (active && touchIdRef.current === null) {
        handleEnd();
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [active, handleMove, handleEnd]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-32 h-32 bg-gray-800/50 rounded-full border-2 border-white/20 touch-none ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-white/30 text-xs font-bold uppercase">{label}</span>
      </div>
      
      {/* Stick */}
      <div 
        className="absolute w-12 h-12 bg-white/80 rounded-full shadow-lg pointer-events-none transition-transform duration-75 ease-linear"
        style={{
          top: '50%',
          left: '50%',
          marginTop: '-1.5rem',
          marginLeft: '-1.5rem',
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      />
    </div>
  );
};

export default Joystick;
