'use client';
import React from 'react';
import { useGameStore } from '@/store/useGameStore';

const HUD: React.FC = () => {
  const { score, gameState } = useGameStore();

  if (gameState !== 'PLAYING') return null;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-50">
      {/* ─── Top Bar ─────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 flex items-center gap-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-black tracking-[0.3em] text-white/60 mb-1">Score</span>
          <span className="font-sans text-3xl font-black text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] leading-tight tracking-wider">
            {String(score).padStart(6, '0')}
          </span>
        </div>
      </div>

      {/* ─── Add your HUD elements here ──────────────────────── */}
    </div>
  );
};

export default HUD;
