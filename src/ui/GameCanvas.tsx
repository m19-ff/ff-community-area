'use client';

import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { initGame } from '../game/boot';

const GameCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      gameRef.current = initGame(containerRef.current.id);
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      id="phaser-game-container"
      ref={containerRef}
      className="absolute inset-0 w-screen h-screen"
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    />
  );
};

export default GameCanvas;
