/**
 * VIP Admin Configuration
 * Roll number 051107 bypasses all class/name lookups and
 * gets special access to join any quiz with a VIP entry animation.
 * 
 * When admin joins a game, we write a Firebase signal so EVERY
 * connected screen (host + all players) fires the full-screen animation.
 */

import { getDatabase, ref, get, set, onValue, off } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';

export const VIP_ADMIN_ROLL = '051107';
export const VIP_ADMIN_CLASS = 'VIP';
export const VIP_ADMIN_NAME = 'MR SURAJ ZALKE';

/** The full VIP player record stored in Firebase */
export const VIP_PLAYER_RECORD = {
  name: VIP_ADMIN_NAME,
  classId: VIP_ADMIN_CLASS,
  mobile: '',
  parentPhone: '',
  feeAmount: '',
  feeDueDate: '',
  feePaid: true,
  isVIP: true,
  isAdmin: true,
  specialAccess: true,
};

/** True if the given roll number is the VIP admin */
export const isVIPRoll = (roll: string) => roll === VIP_ADMIN_ROLL;

/**
 * Ensures the VIP player record exists in Firebase — ALWAYS overwrites to keep name current.
 */
export const ensureVIPPlayerExists = async () => {
  try {
    const db = getDatabase(app);
    const vipRef = ref(db, `players/${VIP_ADMIN_CLASS}/${VIP_ADMIN_ROLL}`);
    // Always write — ensures name stays "MR SURAJ ZALKE" even if old record exists
    await set(vipRef, VIP_PLAYER_RECORD);
    await set(ref(db, `classes/${VIP_ADMIN_CLASS}`), true);
    console.log('[VIP] Admin player record synced.');
  } catch (err) {
    console.warn('[VIP] Could not sync VIP player:', err);
  }
};

/**
 * BROADCAST: Write a VIP join signal to a game's Firebase node.
 * Also updates the player's nickname to VIP_ADMIN_NAME in the game.
 * All screens listening will fire the full-screen animation.
 */
export const broadcastVIPJoin = async (gameId: string, playerId?: string) => {
  try {
    const db = getDatabase(app);
    
    // Write the signal with current timestamp
    const signalRef = ref(db, `games/${gameId}/vipJoinSignal`);
    await set(signalRef, {
      name: VIP_ADMIN_NAME,
      roll: VIP_ADMIN_ROLL,
      timestamp: Date.now(),
    });

    // Also update player nickname in the game so it shows correctly
    if (playerId) {
      const nicknameRef = ref(db, `games/${gameId}/players/${playerId}/nickname`);
      const nameRef = ref(db, `games/${gameId}/players/${playerId}/name`);
      await set(nicknameRef, VIP_ADMIN_NAME);
      await set(nameRef, VIP_ADMIN_NAME);
    }

    console.log('[VIP] Broadcast VIP join signal for game', gameId);
  } catch (err) {
    console.warn('[VIP] Could not broadcast VIP join signal:', err);
  }
};

/**
 * LISTEN: Subscribe to VIP join signals for a game.
 * Calls onSignal(adminName) whenever a new VIP joins.
 * Returns an unsubscribe function.
 */
export const listenVIPJoin = (
  gameId: string,
  onSignal: (adminName: string) => void
): (() => void) => {
  const db = getDatabase(app);
  const signalRef = ref(db, `games/${gameId}/vipJoinSignal`);

  // Record the time we started listening — ignore any signal older than this
  const subscribeTime = Date.now();
  let lastSignalTimestamp = 0;

  const handler = onValue(signalRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();
    if (!data?.timestamp) return;
    if (data.timestamp <= lastSignalTimestamp) return;
    lastSignalTimestamp = data.timestamp;

    // Fire animation on fresh or recently-published VIP joins
    if (data.timestamp >= subscribeTime - 5000) {
      console.log('[VIP] Signal received:', data.name, data.timestamp);
      onSignal(data.name || VIP_ADMIN_NAME);
    } else {
      console.log('[VIP] Ignored old VIP signal:', data.timestamp, 'subscribeTime:', subscribeTime);
    }
  });

  return () => off(signalRef, 'value', handler);
};

/**
 * Looks up a roll number.
 * For VIP roll, returns the hardcoded record without hitting the DB.
 * For all others, searches across all classes.
 */
export const lookupPlayer = async (
  rollNo: string
): Promise<{ name: string; classId: string } | null> => {
  // VIP shortcut — never blocked by DB
  if (isVIPRoll(rollNo)) {
    return { name: VIP_ADMIN_NAME, classId: VIP_ADMIN_CLASS };
  }

  try {
    const db = getDatabase(app);
    const playersRef = ref(db, 'players');
    const snapshot = await get(playersRef);

    if (snapshot.exists()) {
      const allClasses = snapshot.val();
      for (const cId in allClasses) {
        if (allClasses[cId][rollNo]) {
          return {
            name: allClasses[cId][rollNo].name,
            classId: cId,
          };
        }
      }
    }
    return null;
  } catch (err) {
    console.error('[lookupPlayer] Error:', err);
    return null;
  }
};
