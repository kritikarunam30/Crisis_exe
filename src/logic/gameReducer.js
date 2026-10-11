import { assignCity, buildSchedule, createRng, nextSeed } from './randomiser.js';
import {
  ESCALATION,
  STARTING_HEALTH,
  STARTING_RESOURCES,
  TOTAL_ROUNDS,
  buildIncidents,
  disastersPerRound,
  resolveRound,
  resupply,
  sanitiseAllocation
} from './gameRules.js';
import { calcScore } from './scoreCalc.js';

// Pure game reducer. Kept free of React so it can be tested directly.

export function createInitialState(seed) {
  return {
    seed,
    nickname: "",
    city: null,
    round: 1,
    schedule: null,        // disaster ids for every round, fixed once the city is assigned
    disasters: [],         // this round's incidents (costs already scaled for round, escalation and quirks)
    disastersRound: 0,     // round the current `disasters` were drawn for
    resources: { ...STARTING_RESOURCES },
    cityHealth: STARTING_HEALTH,
    escalation: 0,         // extra cost applied to upcoming disasters, grows when threats are not contained
    roundResolved: false,  // true once resources have been deployed this round
    lastSupply: null,      // units added by the last between-round resupply
    lastDamage: 0,
    score: 0,
    gameOver: false,
    lastResults: [],
    history: [],           // every result so far, used for scoring
    scoreDetails: null
  };
}

// Assigns the city and fixes the full disaster schedule from the seed
function withCity(state) {
  if (state.city && state.schedule) return state;
  const rng = createRng(state.seed);
  const city = state.city ?? assignCity(rng);
  return { ...state, city, schedule: buildSchedule(rng, city, disastersPerRound()) };
}

function withDisasters(state) {
  if (state.disastersRound === state.round) return state;
  const ready = withCity(state);
  return {
    ...ready,
    disasters: buildIncidents(ready.schedule[ready.round - 1] ?? [], ready.round, ready.city, ready.escalation),
    disastersRound: ready.round
  };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_NICKNAME':
      return { ...state, nickname: action.payload };

    case 'ASSIGN_CITY':
      return withDisasters(state);

    case 'DRAW_DISASTERS':
      return withDisasters(state);

    case 'ALLOCATE': {
      // A round can only be deployed once
      if (state.roundResolved || state.gameOver) return state;
      state = withDisasters(state);

      const allocated = sanitiseAllocation(action.payload, state.resources); // { rescue: 5, ... }

      const newResources = { ...state.resources };
      for (const [key, val] of Object.entries(allocated)) {
        newResources[key] -= val;
      }

      const { results, totalDamage, escalation } = resolveRound(state.disasters, allocated);
      const newHealth = Math.max(0, state.cityHealth - totalDamage);

      return {
        ...state,
        resources: newResources,
        cityHealth: newHealth,
        escalation: Math.min(ESCALATION.max, state.escalation + escalation),
        roundResolved: true,
        lastDamage: totalDamage,
        lastResults: results,
        history: [...state.history, ...results],
        gameOver: newHealth === 0
      };
    }

    case 'NEXT_ROUND': {
      if (!state.roundResolved || state.gameOver) return state;
      if (state.round >= TOTAL_ROUNDS) return { ...state, gameOver: true };

      const resources = resupply(state.resources);
      const lastSupply = {};
      for (const key of Object.keys(resources)) {
        lastSupply[key] = resources[key] - state.resources[key];
      }

      // Next round's disasters are drawn here so the warning screen never shows stale ones
      return withDisasters({
        ...state,
        round: state.round + 1,
        resources,
        lastSupply,
        roundResolved: false
      });
    }

    case 'CALC_SCORE': {
      const { score, details } = calcScore(state);
      return { ...state, score, scoreDetails: details };
    }

    case 'RESET':
      return createInitialState(nextSeed(state.seed));

    default:
      return state;
  }
}
