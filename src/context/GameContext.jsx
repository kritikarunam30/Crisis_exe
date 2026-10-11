import { createContext, useContext, useReducer } from 'react';
import { randomSeed } from '../logic/randomiser.js';
import { createInitialState, gameReducer } from '../logic/gameReducer.js';

const GameContext = createContext();

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState(randomSeed()));
  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  return useContext(GameContext);
}
