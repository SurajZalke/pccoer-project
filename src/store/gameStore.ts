
import { GameRoom } from '@/types';

// Simulate a server-side store for active games
export const activeGamesStore: { [key: string]: GameRoom } = {};

// Create some predefined test games
export const TEST_GAME_CODES = ["TEST12", "DEMO01", "PLAY22", "QUIZ99", "FUN123"];

// Make sure all test games exist
export const initTestGames = () => {
  TEST_GAME_CODES.forEach((code, index) => {
    if (!activeGamesStore[code]) {
      activeGamesStore[code] = {
        id: `test_game_id_${index}`,
        code: code,
        hostId: `test_host_id_${index}`,
        quizId: "quiz1",
        players: [],
        status: "waiting",
        currentQuestionIndex: -1
      };
    }
  });
  console.log("All demo games initialized:", Object.keys(activeGamesStore));
};

// Initialize test games immediately
initTestGames();
