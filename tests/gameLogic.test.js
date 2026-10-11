// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import cityData from '../src/logic/cityData.js';
import disasterData from '../src/logic/disasterData.js';
import { assignCity, buildSchedule, createRng, nextSeed } from '../src/logic/randomiser.js';
import {
  ESCALATION,
  RESOURCE_TYPES,
  RESUPPLY_PER_ROUND,
  STARTING_RESOURCES,
  TOTAL_ROUNDS,
  buildIncidents,
  disastersPerRound,
  resolveRound,
  resupply,
  sanitiseAllocation
} from '../src/logic/gameRules.js';
import { calcScore } from '../src/logic/scoreCalc.js';
import { createInitialState, gameReducer } from '../src/logic/gameReducer.js';

const dispatchAll = (state, ...actions) =>
  actions.reduce((s, action) => gameReducer(s, typeof action === 'string' ? { type: action } : action), state);

const needs = (disasters) => {
  const total = { rescue: 0, medical: 0, food: 0, engineers: 0 };
  disasters.forEach(d => Object.entries(d.baseCost).forEach(([k, v]) => { total[k] += v; }));
  return total;
};

// Everything that must hold for any game state, however it was reached
function assertValidState(state, label) {
  assert.ok(Number.isInteger(state.cityHealth), `${label}: health is an integer`);
  assert.ok(state.cityHealth >= 0 && state.cityHealth <= 100, `${label}: health in range (${state.cityHealth})`);
  assert.ok(state.round >= 1 && state.round <= TOTAL_ROUNDS, `${label}: round in range (${state.round})`);
  for (const type of RESOURCE_TYPES) {
    const amount = state.resources[type];
    assert.ok(Number.isInteger(amount) && amount >= 0, `${label}: ${type} is a non-negative integer (${amount})`);
  }
  assert.deepEqual(Object.keys(state.resources).sort(), [...RESOURCE_TYPES].sort(), `${label}: no stray resource keys`);
  assert.ok(Number.isFinite(state.score) && state.score >= 0, `${label}: score is finite (${state.score})`);
  assert.ok(state.escalation >= 0 && state.escalation <= ESCALATION.max + 1e-9, `${label}: escalation in range`);
  assert.ok(Array.isArray(state.disasters) && Array.isArray(state.lastResults), `${label}: lists are arrays`);
  for (const d of state.disasters) {
    assert.ok(d.id && d.name && d.emoji && d.warning, `${label}: disaster has display fields`);
    assert.ok(d.maxDamage > 0, `${label}: disaster has maxDamage`);
    for (const cost of Object.values(d.baseCost)) assert.ok(Number.isInteger(cost) && cost >= 1, `${label}: cost is a positive integer`);
  }
  for (const r of state.lastResults) {
    assert.ok(['resolved', 'partial', 'failed'].includes(r.status), `${label}: valid status`);
    assert.equal(typeof r.message, 'string');
    assert.ok(r.coverage >= 0 && r.coverage <= 1, `${label}: coverage in range`);
    assert.ok(Number.isInteger(r.damage) && r.damage >= 0, `${label}: damage is a non-negative integer`);
  }
}

// ── Random generation ──────────────────────────────────────────────────────

test('same seed gives the same city and disasters', () => {
  for (const seed of [0, 1, 42, 0xffffffff, 123456789]) {
    const a = dispatchAll(createInitialState(seed), 'ASSIGN_CITY');
    const b = dispatchAll(createInitialState(seed), 'ASSIGN_CITY');
    assert.deepEqual(a, b);
  }
});

test('every city can be assigned and seeds vary the outcome', () => {
  const seen = new Set();
  for (let seed = 0; seed < 500; seed++) seen.add(assignCity(createRng(seed)).name);
  assert.equal(seen.size, cityData.length);
});

test('a game never repeats a disaster and has 1, 2, 3 per round', () => {
  assert.deepEqual(disastersPerRound(), [1, 2, 3]);
  for (const city of cityData) {
    for (let seed = 0; seed < 300; seed++) {
      const schedule = buildSchedule(createRng(seed), city, disastersPerRound());
      assert.deepEqual(schedule.map(r => r.length), [1, 2, 3]);
      const ids = schedule.flat();
      assert.equal(new Set(ids).size, ids.length);
      ids.forEach(id => assert.ok(disasterData.some(d => d.id === id)));
    }
  }
});

test('city risk profile makes its signature disaster more common', () => {
  const count = (city, id) => {
    let hits = 0;
    for (let seed = 0; seed < 2000; seed++) {
      if (buildSchedule(createRng(seed), city, disastersPerRound()).flat().includes(id)) hits++;
    }
    return hits;
  };
  const mumbai = cityData.find(c => c.name === 'Mumbai');
  const delhi = cityData.find(c => c.name === 'Delhi');
  assert.ok(count(mumbai, 'flood') > count(delhi, 'flood'));
  assert.ok(count(delhi, 'heatwave') > count(mumbai, 'heatwave'));
});

test('nextSeed produces a different, valid seed', () => {
  let seed = 7;
  const seen = new Set([seed]);
  for (let i = 0; i < 200; i++) {
    seed = nextSeed(seed);
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
    seen.add(seed);
  }
  assert.ok(seen.size > 190);
});

// ── Rules ──────────────────────────────────────────────────────────────────

test('costs scale with round severity, escalation and city quirks', () => {
  const plain = { name: 'Nowhere' };
  const [r1] = buildIncidents(['flood'], 1, plain, 0);
  assert.deepEqual(r1.baseCost, { rescue: 15, food: 10 });
  assert.equal(r1.maxDamage, 20);

  const [r3] = buildIncidents(['flood'], 3, plain, 0);
  assert.deepEqual(r3.baseCost, { rescue: 17, food: 12 });
  assert.equal(r3.maxDamage, 23);

  const [escalated] = buildIncidents(['flood'], 1, plain, 0.2);
  assert.deepEqual(escalated.baseCost, { rescue: 18, food: 12 });

  const mumbai = cityData.find(c => c.name === 'Mumbai');
  const [mumbaiFlood] = buildIncidents(['flood'], 1, mumbai, 0);
  assert.deepEqual(mumbaiFlood.baseCost, { rescue: 21, food: 14 });
  assert.equal(mumbaiFlood.maxDamage, 28);

  const hyderabad = cityData.find(c => c.name === 'Hyderabad');
  const [hydFlood] = buildIncidents(['flood'], 1, hyderabad, 0);
  assert.deepEqual(hydFlood.baseCost, { rescue: 20, food: 10 });
});

test('every disaster in every city can be built for every round', () => {
  for (const city of [...cityData, null, {}]) {
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      const incidents = buildIncidents(disasterData.map(d => d.id), round, city, ESCALATION.max);
      assert.equal(incidents.length, disasterData.length);
      incidents.forEach(d => Object.values(d.baseCost).forEach(c => assert.ok(Number.isInteger(c) && c > 0)));
    }
  }
});

test('full, partial and failed outcomes', () => {
  const incidents = buildIncidents(['flood'], 1, null, 0); // needs 15 rescue + 10 food, max damage 20

  const full = resolveRound(incidents, { rescue: 15, food: 10 });
  assert.equal(full.results[0].status, 'resolved');
  assert.equal(full.totalDamage, 0);
  assert.equal(full.escalation, 0);

  const partial = resolveRound(incidents, { rescue: 15, food: 0 });
  assert.equal(partial.results[0].status, 'partial');
  assert.equal(partial.totalDamage, 8); // 40% short of 20
  assert.equal(partial.escalation, ESCALATION.partial);

  const failed = resolveRound(incidents, { rescue: 5 });
  assert.equal(failed.results[0].status, 'failed');
  assert.equal(failed.totalDamage, 16);
  assert.equal(failed.escalation, ESCALATION.failed);

  const nothing = resolveRound(incidents, {});
  assert.equal(nothing.results[0].status, 'failed');
  assert.equal(nothing.totalDamage, 20);
});

test('over-deploying does no harm and reports the waste', () => {
  const incidents = buildIncidents(['flood'], 1, null, 0);
  const result = resolveRound(incidents, { rescue: 25, medical: 25, food: 25, engineers: 25 });
  assert.equal(result.totalDamage, 0);
  assert.equal(result.wasted, 75);
});

test('the most dangerous disaster is supplied first, results keep draw order', () => {
  // power_outage (max 15) drawn first, cyclone (max 25) second; both want medical
  const incidents = buildIncidents(['power_outage', 'cyclone'], 2, null, 0);
  const { results } = resolveRound(incidents, { rescue: 20, medical: 15, engineers: 20 });
  assert.deepEqual(results.map(r => r.id), ['power_outage', 'cyclone']);
  assert.equal(results[1].status, 'resolved');
  assert.equal(results[0].status, 'partial');
});

test('a round with no disasters resolves to nothing', () => {
  assert.deepEqual(resolveRound([], { rescue: 5 }), { results: [], totalDamage: 0, escalation: 0, wasted: 5 });
});

test('allocations are clamped to valid whole units in stock', () => {
  const stock = { rescue: 10, medical: 0, food: 5, engineers: 25 };
  const cases = [
    [undefined, { rescue: 0, medical: 0, food: 0, engineers: 0 }],
    [null, { rescue: 0, medical: 0, food: 0, engineers: 0 }],
    ['garbage', { rescue: 0, medical: 0, food: 0, engineers: 0 }],
    [{ rescue: 999, medical: 5, food: -3, engineers: 2.9 }, { rescue: 10, medical: 0, food: 0, engineers: 2 }],
    [{ rescue: '7', medical: NaN, food: Infinity, engineers: null }, { rescue: 7, medical: 0, food: 5, engineers: 0 }],
    [{ rescue: -Infinity, bogus: 50, food: '2abc' }, { rescue: 0, medical: 0, food: 0, engineers: 0 }],
  ];
  for (const [input, expected] of cases) assert.deepEqual(sanitiseAllocation(input, stock), expected);
});

test('resupply adds to every branch without mutating the input', () => {
  const before = { rescue: 0, medical: 3, food: 25, engineers: 10 };
  const after = resupply(before);
  assert.deepEqual(before, { rescue: 0, medical: 3, food: 25, engineers: 10 });
  for (const type of RESOURCE_TYPES) assert.equal(after[type], before[type] + RESUPPLY_PER_ROUND);
});

// ── Scoring ────────────────────────────────────────────────────────────────

test('score formula', () => {
  const history = [
    { status: 'resolved', difficultyWeight: 2 },
    { status: 'partial', difficultyWeight: 3 },
    { status: 'failed', difficultyWeight: 3 },
  ];
  const result = calcScore({ cityHealth: 80, resources: { rescue: 10, medical: 10, food: 0, engineers: 0 }, history, city: { multiplier: 1.5 } });
  assert.deepEqual(result.details, { base: 80, efficiency: 5, disasterBonus: 9 });
  assert.equal(result.score, 141);
});

test('efficiency bonus is capped and lost when the city collapses', () => {
  const rich = { rescue: 100, medical: 100, food: 100, engineers: 100 };
  assert.equal(calcScore({ cityHealth: 50, resources: rich, history: [], city: { multiplier: 1 } }).details.efficiency, 20);
  const collapsed = calcScore({ cityHealth: 0, resources: rich, history: [{ status: 'resolved', difficultyWeight: 2 }], city: { multiplier: 1.2 } });
  assert.deepEqual(collapsed.details, { base: 0, efficiency: 0, disasterBonus: 6 });
  assert.equal(collapsed.score, 7);
});

test('score works without a city or history', () => {
  const result = calcScore({ cityHealth: 100, resources: { ...STARTING_RESOURCES }, history: [], city: null });
  assert.equal(result.score, 120);
});

// ── Reducer: normal play ───────────────────────────────────────────────────

test('new game starts clean', () => {
  const state = createInitialState(1);
  assert.equal(state.city, null);
  assert.equal(state.round, 1);
  assert.equal(state.cityHealth, 100);
  assert.deepEqual(state.resources, STARTING_RESOURCES);
  assertValidState(state, 'initial');
});

test('a full well-played game runs three rounds and scores', () => {
  let state = dispatchAll(createInitialState(2024), { type: 'SET_NICKNAME', payload: 'TESTER' }, 'ASSIGN_CITY', 'DRAW_DISASTERS');
  assert.equal(state.nickname, 'TESTER');
  assert.ok(state.city);

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    assert.equal(state.round, round);
    assert.equal(state.disasters.length, round);
    state = gameReducer(state, { type: 'ALLOCATE', payload: needs(state.disasters) });
    assert.equal(state.lastResults.length, round);
    assertValidState(state, `round ${round}`);
    if (round < TOTAL_ROUNDS) state = dispatchAll(state, 'NEXT_ROUND', 'DRAW_DISASTERS');
  }

  state = gameReducer(state, { type: 'CALC_SCORE' });
  assert.equal(state.history.length, 6);
  assert.ok(state.cityHealth > 0);
  assert.ok(state.score > 0);
  assert.equal(state.score, Math.round((state.scoreDetails.base + state.scoreDetails.efficiency + state.scoreDetails.disasterBonus) * state.city.multiplier));
});

test('round 1 can always be fully handled from starting resources in a quirk-free city', () => {
  for (const d of disasterData) {
    const [incident] = buildIncidents([d.id], 1, null, 0);
    for (const [type, cost] of Object.entries(incident.baseCost)) assert.ok(cost <= STARTING_RESOURCES[type], `${d.id} needs ${cost} ${type}`);
  }
});

test('doing nothing collapses the city and ends the game early', () => {
  for (let seed = 0; seed < 200; seed++) {
    let state = dispatchAll(createInitialState(seed), 'ASSIGN_CITY');
    let rounds = 0;
    while (!state.gameOver && rounds < 10) {
      state = gameReducer(state, { type: 'ALLOCATE', payload: {} });
      rounds++;
      if (!state.gameOver) state = gameReducer(state, { type: 'NEXT_ROUND' });
    }
    assert.equal(state.cityHealth, 0, `seed ${seed}`);
    assert.ok(state.gameOver);
    state = gameReducer(state, { type: 'CALC_SCORE' });
    assert.equal(state.score, 0);
    assertValidState(state, `seed ${seed}`);
  }
});

test('escalation raises later costs and is capped', () => {
  let state = dispatchAll(createInitialState(5), 'ASSIGN_CITY');
  const baseline = buildIncidents(state.schedule[1], 2, state.city, 0);
  state = dispatchAll(state, { type: 'ALLOCATE', payload: {} }, 'NEXT_ROUND');
  assert.equal(state.escalation, ESCALATION.failed);
  state.disasters.forEach((d, i) => {
    for (const type of Object.keys(d.baseCost)) assert.ok(d.baseCost[type] >= baseline[i].baseCost[type]);
  });
  assert.ok(Object.values(needs(state.disasters)).reduce((a, b) => a + b) > Object.values(needs(baseline)).reduce((a, b) => a + b));
});

test('resupply arrives between rounds and is reported', () => {
  let state = dispatchAll(createInitialState(9), 'ASSIGN_CITY', { type: 'ALLOCATE', payload: { rescue: 25, medical: 25, food: 25, engineers: 25 } }, 'NEXT_ROUND');
  for (const type of RESOURCE_TYPES) {
    assert.equal(state.resources[type], RESUPPLY_PER_ROUND);
    assert.equal(state.lastSupply[type], RESUPPLY_PER_ROUND);
  }
});

// ── Reducer: misuse and odd orderings ──────────────────────────────────────

test('repeated or early actions are ignored safely', () => {
  let state = dispatchAll(createInitialState(11), 'ASSIGN_CITY');
  const city = state.city;

  // Re-assigning or re-drawing changes nothing
  assert.equal(dispatchAll(state, 'ASSIGN_CITY', 'DRAW_DISASTERS', 'DRAW_DISASTERS'), state);

  // Cannot skip a round without deploying
  assert.equal(gameReducer(state, { type: 'NEXT_ROUND' }), state);

  // Cannot deploy twice in one round
  const deployed = gameReducer(state, { type: 'ALLOCATE', payload: needs(state.disasters) });
  assert.equal(gameReducer(deployed, { type: 'ALLOCATE', payload: { rescue: 5 } }), deployed);

  // City never changes mid-game
  const later = dispatchAll(deployed, 'NEXT_ROUND', 'ASSIGN_CITY');
  assert.equal(later.city, city);

  // Unknown actions are no-ops
  assert.equal(gameReducer(later, { type: 'NOT_A_REAL_ACTION' }), later);
});

test('actions work even before a city is assigned', () => {
  const fresh = createInitialState(3);
  assertValidState(gameReducer(fresh, { type: 'CALC_SCORE' }), 'score first');
  assert.equal(gameReducer(fresh, { type: 'NEXT_ROUND' }), fresh);

  const drawn = gameReducer(fresh, { type: 'DRAW_DISASTERS' });
  assert.ok(drawn.city);
  assert.equal(drawn.disasters.length, 1);

  const allocated = gameReducer(fresh, { type: 'ALLOCATE', payload: { rescue: 10 } });
  assert.ok(allocated.city);
  assert.equal(allocated.lastResults.length, 1);
  assertValidState(allocated, 'allocate first');
});

test('the game cannot go past the last round', () => {
  let state = dispatchAll(createInitialState(21), 'ASSIGN_CITY');
  for (let i = 0; i < 10; i++) {
    state = dispatchAll(state, { type: 'ALLOCATE', payload: needs(state.disasters) }, 'NEXT_ROUND');
  }
  assert.equal(state.round, TOTAL_ROUNDS);
  assert.ok(state.gameOver);
  assert.equal(state.history.length, 6);
  assertValidState(state, 'over-advanced');
});

test('nothing happens after the city has collapsed', () => {
  let state = dispatchAll(createInitialState(4), 'ASSIGN_CITY');
  while (!state.gameOver) state = dispatchAll(state, { type: 'ALLOCATE', payload: {} }, 'NEXT_ROUND');
  const after = dispatchAll(state, { type: 'ALLOCATE', payload: { rescue: 5 } }, 'NEXT_ROUND', 'DRAW_DISASTERS');
  assert.equal(after, state);
});

test('reset starts a fresh game with a new seed', () => {
  let state = dispatchAll(createInitialState(77), { type: 'SET_NICKNAME', payload: 'A' }, 'ASSIGN_CITY', { type: 'ALLOCATE', payload: {} }, 'NEXT_ROUND', 'CALC_SCORE');
  const reset = gameReducer(state, { type: 'RESET' });
  assert.deepEqual({ ...reset, seed: 0 }, { ...createInitialState(0) });
  assert.notEqual(reset.seed, state.seed);
  // Many resets in a row keep producing playable games
  let s = reset;
  const cities = new Set();
  for (let i = 0; i < 100; i++) {
    s = dispatchAll(s, 'ASSIGN_CITY');
    cities.add(s.city.name);
    assertValidState(s, `replay ${i}`);
    s = gameReducer(s, { type: 'RESET' });
  }
  assert.ok(cities.size >= 4);
});

test('the reducer never mutates the previous state', () => {
  const freeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
  let state = freeze(createInitialState(31));
  const steps = ['ASSIGN_CITY', 'DRAW_DISASTERS', { type: 'ALLOCATE', payload: { rescue: 10, food: 3 } }, 'NEXT_ROUND', { type: 'ALLOCATE', payload: {} }, 'NEXT_ROUND', { type: 'ALLOCATE', payload: { medical: 99 } }, 'CALC_SCORE', 'RESET'];
  for (const step of steps) state = freeze(gameReducer(state, typeof step === 'string' ? { type: step } : step));
});

// ── Fuzzing ────────────────────────────────────────────────────────────────

test('random play with random allocations always stays valid (20,000 games)', () => {
  const junk = [undefined, null, NaN, -5, 1e9, '12', 'x', 3.7, Infinity, {}, []];
  for (let seed = 0; seed < 20000; seed++) {
    const rng = createRng(seed * 31 + 7);
    let state = dispatchAll(createInitialState(seed), 'ASSIGN_CITY');
    let guard = 0;
    while (!state.gameOver && guard++ < 10) {
      const payload = {};
      for (const type of RESOURCE_TYPES) {
        const roll = rng();
        payload[type] = roll < 0.1 ? junk[Math.floor(rng() * junk.length)] : Math.floor(rng() * 60) - 5;
      }
      state = gameReducer(state, { type: 'ALLOCATE', payload: rng() < 0.02 ? junk[Math.floor(rng() * junk.length)] : payload });
      assertValidState(state, `seed ${seed}`);
      state = gameReducer(state, { type: 'NEXT_ROUND' });
      assertValidState(state, `seed ${seed}`);
    }
    assert.ok(state.gameOver, `seed ${seed} finishes`);
    assert.ok(state.history.length >= 1 && state.history.length <= 6);
    state = gameReducer(state, { type: 'CALC_SCORE' });
    assertValidState(state, `seed ${seed} scored`);
    assert.ok(state.score <= 400, `seed ${seed}: score ${state.score} is plausible`);
  }
});

test('random action sequences in any order never crash (5,000 runs)', () => {
  const types = ['SET_NICKNAME', 'ASSIGN_CITY', 'DRAW_DISASTERS', 'ALLOCATE', 'ALLOCATE', 'NEXT_ROUND', 'NEXT_ROUND', 'CALC_SCORE', 'RESET', 'UNKNOWN'];
  for (let seed = 0; seed < 5000; seed++) {
    const rng = createRng(seed + 99991);
    let state = createInitialState(seed);
    for (let step = 0; step < 40; step++) {
      const type = types[Math.floor(rng() * types.length)];
      if (type === 'RESET' && rng() < 0.7) continue;
      const payload = type === 'ALLOCATE'
        ? { rescue: Math.floor(rng() * 40), medical: Math.floor(rng() * 40), food: Math.floor(rng() * 40), engineers: Math.floor(rng() * 40) }
        : 'NICK';
      state = gameReducer(state, { type, payload });
      assertValidState(state, `seed ${seed} step ${step} ${type}`);
    }
  }
});

// ── Balance ────────────────────────────────────────────────────────────────

test('balance: matching needs survives comfortably in every city', () => {
  for (const city of cityData) {
    let totalHealth = 0;
    const games = 1500;
    for (let i = 0; i < games; i++) {
      const rng = createRng(i * 7919 + 13);
      const schedule = buildSchedule(rng, city, disastersPerRound());
      let state = { ...createInitialState(i), city, schedule };
      state = gameReducer(state, { type: 'DRAW_DISASTERS' });
      while (!state.gameOver) state = dispatchAll(state, { type: 'ALLOCATE', payload: needs(state.disasters) }, 'NEXT_ROUND');
      assert.ok(state.cityHealth > 0, `${city.name} game ${i} collapsed despite sensible play`);
      totalHealth += state.cityHealth;
    }
    const average = totalHealth / games;
    assert.ok(average > 55 && average < 90, `${city.name} average integrity ${average.toFixed(1)}`);
  }
});
