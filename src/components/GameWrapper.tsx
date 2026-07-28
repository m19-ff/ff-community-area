'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import GameCanvas with SSR disabled
const GameCanvas = dynamic(() => import('../ui/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-black">
      <div className="text-white font-mono animate-pulse">Loading Game Engine...</div>
    </div>
  ),
});

const GameWrapper: React.FC = () => {
  return (
    <div className="game-wrapper absolute inset-0 z-0">
      <GameCanvas />
    </div>
  );
};

export default GameWrapper;
