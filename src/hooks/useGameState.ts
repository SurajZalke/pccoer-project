import { useState, useCallback, useEffect } from 'react';
import { GameRoom, Player, Quiz, Question } from '@/types';
import { generateGameCode } from '@/utils/gameUtils';
import { useToast } from '@/components/ui/use-toast';
import { database, auth } from '@/lib/firebaseConfig';
import { ref, set, push, get, update, onValue } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';

export const useGameState = () => {
  const [activeGame, setActiveGame] = useState<GameRoom | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);

  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [questionEnded, setQuestionEnded] = useState<boolean>(false);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);

  // Initialize server time offset
  useEffect(() => {
    const offsetRef = ref(database, '.info/serverTimeOffset');
    const unsubscribe = onValue(offsetRef, (snapshot) => {
      const offset = snapshot.val() || 0;
      setServerTimeOffset(offset);
    });

    return () => unsubscribe();
  }, []);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser && activeGame && isHost) {
      const hostPlayerId = currentUser.uid;
      const currentHostPlayer = activeGame.players.find(p => p.id === hostPlayerId);

      if (currentHostPlayer && 
          (currentHostPlayer.nickname !== currentUser.user_metadata?.name || 
           currentHostPlayer.avatar !== currentUser.user_metadata?.avatar_url)) {
        const updatedHostPlayer = {
          ...currentHostPlayer,
          nickname: currentUser.user_metadata?.name || currentHostPlayer.nickname,
          avatar: currentUser.user_metadata?.avatar_url || currentHostPlayer.avatar,
        };
        
        setActiveGame(prevGame => {
          if (!prevGame) return null;

          const updatedPlayers = prevGame.players.map(player => {
            if (player.id === hostPlayerId) {
              return {
                ...player,
                nickname: currentUser.user_metadata?.name || player.nickname,
                avatar: currentUser.user_metadata?.avatar_url || player.avatar,
              };
            }
            return player;
          });

          return {
            ...prevGame,
            players: updatedPlayers,
          };
        });

        const playerRef = ref(database, `games/${activeGame.id}/players/${hostPlayerId}`);
        update(playerRef, {
          nickname: updatedHostPlayer.nickname,
          avatar: updatedHostPlayer.avatar,
        }).catch(error => {
          console.error("Failed to update host player profile in Firebase:", error);
          toast({
            title: "Error",
            description: "Failed to update host profile in game. Please try refreshing.",
            variant: "destructive"
          });
        });
      }
    }
  }, [currentUser, activeGame, isHost, setActiveGame, toast]);

  const createGame = useCallback(async (quiz: Quiz, quizAudienceType: 'college' | 'classes'): Promise<{
    gameId: string | null; success: boolean; message?: string 
}> => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in.");

        return {
          gameId: null,
          success: false,
          message: 'You must be logged in to create a game.',
        };
      }

      // The quiz object is now passed directly, no need to find it from local storage.

      if (!quiz) {
        return {
          gameId: null,
          success: false,
          message: 'Quiz not found.',
        };
      }

      // Generate unique game code
      const gamesRef = ref(database, 'games');
      const code = generateGameCode();
      
      // Check if code already exists
      const existingGamesSnapshot = await get(gamesRef);
      if (existingGamesSnapshot.exists()) {
        const games = existingGamesSnapshot.val();
        const codeExists = Object.values(games).some((game: any) => game.code === code);
        if (codeExists) {
          return {
            gameId: null,
          success: false,
          message: 'Failed to generate unique game code. Please try again.',
        };
        }
      }

      // Create a new game room in Realtime Database
      const newGameRef = push(gamesRef); // This generates a unique ID
      const gameId = newGameRef.key;

      if (!gameId) {
        return {
          gameId: null,
          success: false,
          message: 'Failed to generate game ID.',
        };
      }

      const gameData = {
        id: gameId,
        code,
        quizAudienceType,
        quiz: {
          ...quiz,
          questions: quiz.questions.map(question => ({
            ...question,
            imageUrl: question.imageUrl || '', // Ensure imageUrl is a string
            explanation: question.explanation || '', // Ensure explanation is a string
          })),
        },
        hostId: user.uid,
        status: 'waiting',
        currentQuestionIndex: -1,
        players: {
          [user.uid]: {
            id: user.uid,
            player_id: user.uid,
            nickname: currentUser?.user_metadata?.name || user.displayName || user.email || 'Host',
            score: 0,
            answers: [],
            avatar: currentUser?.user_metadata?.avatar_url || user.photoURL || null
          },
        },
        startedAt: new Date().toISOString(),
        endedAt: null,
        endTime: null,
        scores: {},
        answers: {}
      };

      // Save the game data
      await set(newGameRef, gameData);

      // Update local state
      const gameRoom = {
        ...gameData,
        players: Object.values(gameData.players),
        showScores: false
      } as unknown as GameRoom;
      
      setActiveGame(gameRoom);
      setCurrentQuiz(quiz);
      setIsHost(true);
      setCurrentPlayer({
        ...gameData.players[user.uid],
        uid: user.uid
      });

      toast({
        title: 'Game Created!',
        description: `Share code ${code} with your players`,
      });

      return {
        gameId: gameId,
        success: true,
        message: `Game created successfully with code ${code}`
      };

    } catch (error) {
      console.error('Error creating game:', error);
      toast({
        title: 'Error',
        description: 'Failed to create game. Please try again.',
        variant: 'destructive'
      });
      return {
        gameId: null,
        success: false,
        message: 'Failed to create game. Please try again.'
      };
    }
  }, [setActiveGame, setCurrentQuiz, setIsHost, setCurrentPlayer, toast]);

  const endGame = async (gameId: string) => {
    try {
      await update(ref(database, `games/${gameId}`), {
        endedAt: new Date().toISOString(), // Set end time here
      });

      // Optionally, you can also update the local state or perform other actions
      setActiveGame(prevGame => {
        if (!prevGame) return null;
        return {
          ...prevGame,
          endedAt: new Date().toISOString(),
          status: 'ended',
        };
      });

      toast({
        title: 'Game Ended',
        description: 'The game has been successfully ended.',
      });
    } catch (error) {
      console.error('Error ending game:', error);
      toast({
        title: 'Error',
        description: 'Failed to end the game. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return {
    activeGame,
    setActiveGame,
    currentPlayer,
    setCurrentPlayer,
    currentQuiz,
    setCurrentQuiz,
    currentQuestion,
    setCurrentQuestion,
    isHost,
    setIsHost,
    showCorrectAnswer: activeGame?.showScores || false,
    questionStartTime,
    setQuestionStartTime,
    questionEnded,
    setQuestionEnded,
    serverTimeOffset,
    createGame,
    endGame
  };
};
