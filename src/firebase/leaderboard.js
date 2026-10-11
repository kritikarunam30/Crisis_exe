import { ref, push, get } from 'firebase/database';
import { db, isFirebaseConfigured } from './config';

const LOCAL_SCORES_KEY = 'crisis_exe_local_scores';

function getLocalScores() {
  try {
    const saved = localStorage.getItem(LOCAL_SCORES_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // Ignore localStorage parse errors
  }
  return [
    { nickname: 'CYBER_ACE', score: 18450, city: 'Mumbai', survived: true, timestamp: Date.now() - 3600000 },
    { nickname: 'DISASTER_X', score: 16200, city: 'Bengaluru', survived: true, timestamp: Date.now() - 7200000 },
    { nickname: 'RESCUE_99', score: 14100, city: 'Chennai', survived: true, timestamp: Date.now() - 10800000 },
    { nickname: 'TACTICAL_01', score: 12500, city: 'Delhi', survived: true, timestamp: Date.now() - 14400000 },
    { nickname: 'ALPHA_TEAM', score: 11000, city: 'Hyderabad', survived: false, timestamp: Date.now() - 18000000 },
  ];
}

export async function submitScore({ nickname, score, city, survived }) {
  const newEntry = {
    nickname,
    score,
    city,
    survived,
    timestamp: Date.now()
  };

  if (!db || !isFirebaseConfigured) {
    try {
      const localScores = getLocalScores();
      localScores.push(newEntry);
      localScores.sort((a, b) => (b.score || 0) - (a.score || 0));
      localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(localScores.slice(0, 50)));
    } catch (e) {
      console.warn('Could not save score locally', e);
    }
    return;
  }

  const scoresRef = ref(db, 'scores');
  await push(scoresRef, newEntry);
}

export async function getTopScores(limit = 10) {
  if (!db || !isFirebaseConfigured) {
    return getLocalScores()
      .filter((entry) => entry && Number.isFinite(Number(entry.score)))
      .sort((a, b) => Number(b.score) - Number(a.score))
      .slice(0, limit);
  }

  const scoresRef = ref(db, 'scores');
  const snapshot = await get(scoresRef);
  const scores = snapshot.exists() ? Object.values(snapshot.val()) : [];

  return scores
    .filter((entry) => entry && typeof entry.nickname === 'string' && Number.isFinite(Number(entry.score)))
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, limit);
}
