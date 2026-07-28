import { create } from 'zustand';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER' | 'VICTORY';

interface GameState {
  score: number;
  gameState: GameStatus;

  // Actions
  addScore: (amount: number) => void;
  setGameState: (state: GameStatus) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  score: 0,
  gameState: 'START',

  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  setGameState: (s) => set({ gameState: s }),
  reset: () => set({ score: 0, gameState: 'START' }),
}));
