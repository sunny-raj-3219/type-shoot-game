import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface Word {
  id: string;
  text: string;
  x: number;
  y: number;
  speed: number;
  matched: string;
}

interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  score: number;
  level: number;
  lives: number;
  words: Word[];
  currentInput: string;
}

const WORD_LISTS = [
  // Level 1 - Easy words (50+ words)
  ['cat', 'dog', 'run', 'jump', 'fast', 'slow', 'big', 'small', 'hot', 'cold', 'red', 'blue', 'good', 'bad', 'new', 'old', 'yes', 'no', 'up', 'down', 'in', 'out', 'on', 'off', 'top', 'end', 'man', 'boy', 'girl', 'car', 'bus', 'sun', 'moon', 'day', 'year', 'way', 'may', 'say', 'play', 'try', 'why', 'how', 'now', 'low', 'show', 'know', 'grow', 'flow', 'blow', 'snow'],
  
  // Level 2 - Medium words (40+ words)
  ['house', 'computer', 'keyboard', 'monitor', 'window', 'button', 'screen', 'music', 'phone', 'table', 'chair', 'water', 'coffee', 'orange', 'purple', 'yellow', 'green', 'black', 'white', 'brown', 'happy', 'angry', 'tired', 'hungry', 'thirsty', 'sleepy', 'funny', 'smart', 'brave', 'quick', 'quiet', 'loud', 'bright', 'dark', 'clean', 'dirty', 'empty', 'full', 'open', 'close', 'start', 'finish', 'begin'],
  
  // Level 3 - Harder words (35+ words)
  ['beautiful', 'dangerous', 'fantastic', 'incredible', 'mysterious', 'wonderful', 'important', 'different', 'possible', 'terrible', 'amazing', 'excellent', 'brilliant', 'creative', 'exciting', 'fantastic', 'generous', 'hilarious', 'innovative', 'jealous', 'knowledge', 'language', 'mountain', 'necessary', 'obvious', 'peaceful', 'question', 'remember', 'sandwich', 'together', 'umbrella', 'vacation', 'welcome', 'yesterday', 'zebra'],
  
  // Level 4+ - Complex words (30+ words)
  ['extraordinary', 'incomprehensible', 'responsibility', 'characteristics', 'simultaneously', 'internationally', 'representative', 'administration', 'communication', 'entertainment', 'investigation', 'manufacturing', 'understanding', 'environmental', 'revolutionary', 'technological', 'philosophical', 'psychological', 'archaeological', 'astronomical', 'mathematical', 'geographical', 'biographical', 'alphabetical', 'mechanical', 'electrical', 'chemical', 'physical', 'musical', 'magical']
];

export const TypingGame = () => {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isGameOver: false,
    score: 0,
    level: 1,
    lives: 3,
    words: [],
    currentInput: ''
  });

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gameLoopRef = useRef<number>();
  const lastWordSpawnRef = useRef<number>(0);
  const recentlyUsedWords = useRef<Set<string>>(new Set());

  const getRandomWord = useCallback((level: number, currentWords: Word[]) => {
    const wordList = WORD_LISTS[Math.min(level - 1, WORD_LISTS.length - 1)];
    const currentWordTexts = new Set(currentWords.map(w => w.text.toLowerCase()));
    
    // Filter out words currently on screen and recently used
    const availableWords = wordList.filter(word => 
      !currentWordTexts.has(word.toLowerCase()) && 
      !recentlyUsedWords.current.has(word.toLowerCase())
    );
    
    // If we've used too many words, clear recent history but keep current words blocked
    if (availableWords.length === 0) {
      recentlyUsedWords.current.clear();
      const freshAvailableWords = wordList.filter(word => 
        !currentWordTexts.has(word.toLowerCase())
      );
      return freshAvailableWords[Math.floor(Math.random() * freshAvailableWords.length)];
    }
    
    const selectedWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    
    // Add to recently used (keep last 20 words to avoid repetition)
    recentlyUsedWords.current.add(selectedWord.toLowerCase());
    if (recentlyUsedWords.current.size > 20) {
      const firstWord = Array.from(recentlyUsedWords.current)[0];
      recentlyUsedWords.current.delete(firstWord);
    }
    
    return selectedWord;
  }, []);

  const spawnWord = useCallback(() => {
    if (!gameAreaRef.current) return;
    
    setGameState(prev => {
      const gameWidth = gameAreaRef.current!.clientWidth;
      const newWord: Word = {
        id: Math.random().toString(36).substr(2, 9),
        text: getRandomWord(prev.level, prev.words),
        x: Math.random() * (gameWidth - 100),
        y: -50,
        speed: 1 + (prev.level * 0.5),
        matched: ''
      };

      return {
        ...prev,
        words: [...prev.words, newWord]
      };
    });
  }, [getRandomWord]);

  const updateWords = useCallback(() => {
    setGameState(prev => {
      if (!gameAreaRef.current) return prev;
      
      const gameHeight = gameAreaRef.current.clientHeight;
      const baseThreshold = gameHeight - 100; // Base is 100px from bottom
      
      const updatedWords = prev.words.map(word => ({
        ...word,
        y: word.y + word.speed
      }));

      // Check for words that reached the base
      const wordsAtBase = updatedWords.filter(word => word.y >= baseThreshold);
      let newLives = prev.lives;

      if (wordsAtBase.length > 0) {
        newLives = Math.max(0, prev.lives - wordsAtBase.length);
        wordsAtBase.forEach(word => {
          toast.error(`"${word.text}" reached the base!`);
        });
        
        if (newLives <= 0) {
          toast.error('All lives lost! Game Over!');
          return {
            ...prev,
            isPlaying: false,
            isGameOver: true,
            words: [],
            lives: 0
          };
        }
      }

      // Remove words that reached the base or are off screen
      const activeWords = updatedWords.filter(word => word.y < baseThreshold);

      return {
        ...prev,
        words: activeWords,
        lives: newLives
      };
    });
  }, []);

  const getSpawnRate = useCallback((level: number) => {
    // Level 1: 15 words in 30 seconds = 1 word every 2 seconds
    // Each level increases spawn rate by 20%
    const baseRate = 2000; // 2 seconds for level 1
    const levelMultiplier = 1 - ((level - 1) * 0.2);
    return Math.max(baseRate * levelMultiplier, 500); // Minimum 500ms between spawns
  }, []);

  const gameLoop = useCallback(() => {
    const now = Date.now();
    
    // Spawn new words based on calculated rate for current level
    const spawnRate = getSpawnRate(gameState.level);
    if (now - lastWordSpawnRef.current > spawnRate) {
      spawnWord();
      lastWordSpawnRef.current = now;
    }

    updateWords();

    if (gameState.isPlaying) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameState.isPlaying, gameState.level, spawnWord, updateWords, getSpawnRate]);

  const handleInputChange = (value: string) => {
    setGameState(prev => {
      const newWords = prev.words.map(word => {
        if (word.text.toLowerCase().startsWith(value.toLowerCase()) && value.length > 0) {
          return { ...word, matched: value };
        }
        return { ...word, matched: '' };
      });

      return {
        ...prev,
        currentInput: value,
        words: newWords
      };
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && gameState.currentInput.trim()) {
      const targetWord = gameState.words.find(
        word => word.text.toLowerCase() === gameState.currentInput.toLowerCase().trim()
      );

      if (targetWord) {
        // Word hit!
        const points = targetWord.text.length * 10 * gameState.level;
        setGameState(prev => {
          const newScore = prev.score + points;
          const newLevel = Math.floor(newScore / 1000) + 1;
          
          if (newLevel > prev.level) {
            toast.success(`Level ${newLevel}! Difficulty increased!`);
          }

          return {
            ...prev,
            words: prev.words.filter(word => word.id !== targetWord.id),
            score: newScore,
            level: newLevel,
            currentInput: ''
          };
        });
        toast.success(`+${points} points!`);
      } else {
        setGameState(prev => ({
          ...prev,
          currentInput: ''
        }));
        toast.error('Word not found!');
      }
    }
  };

  const startGame = () => {
    setGameState({
      isPlaying: true,
      isGameOver: false,
      score: 0,
      level: 1,
      lives: 3,
      words: [],
      currentInput: ''
    });
    lastWordSpawnRef.current = Date.now();
    toast.success('Game started! Type words to shoot them!');
  };

  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: false,
      isGameOver: false,
      words: [],
      currentInput: ''
    }));
  };

  useEffect(() => {
    if (gameState.isPlaying) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      inputRef.current?.focus();
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.isPlaying, gameLoop]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Stars background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary to-background">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-accent rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* HUD */}
      <div className="relative z-10 p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-6">
            <Card className="px-4 py-2 bg-card/80 backdrop-blur border-game-neon-green">
              <span className="text-game-neon-green font-bold">Score: {gameState.score}</span>
            </Card>
            <Card className="px-4 py-2 bg-card/80 backdrop-blur border-game-neon-blue">
              <span className="text-game-neon-blue font-bold">Level: {gameState.level}</span>
            </Card>
            <Card className="px-4 py-2 bg-card/80 backdrop-blur border-game-danger">
              <span className="text-game-danger font-bold">Lives: {gameState.lives}</span>
            </Card>
          </div>

          {!gameState.isPlaying && (
            <Button 
              onClick={gameState.isGameOver ? resetGame : startGame}
              className="bg-gradient-neon text-black font-bold px-8 py-2 shadow-neon animate-pulse-neon"
            >
              {gameState.isGameOver ? 'Play Again' : 'Start Game'}
            </Button>
          )}
        </div>

      </div>

      {/* Game Area */}
      <div ref={gameAreaRef} className="relative w-full h-full min-h-[600px]">
        {gameState.words.map((word) => (
          <div
            key={word.id}
            className={`absolute ${
              word.matched ? 'text-game-neon-green scale-110 transition-all duration-200' : 'text-foreground'
            }`}
            style={{
              transform: `translate(${word.x}px, ${word.y}px)`,
              textShadow: word.matched ? '0 0 10px currentColor' : 'none'
            }}
          >
            <span className="text-xl font-mono font-bold px-3 py-1 bg-card/70 backdrop-blur rounded border">
              {word.matched && (
                <span className="text-game-neon-green">{word.matched}</span>
              )}
              <span className={word.matched ? 'text-muted-foreground' : ''}>
                {word.text.substring(word.matched.length)}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Game Over Screen */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur flex items-center justify-center z-50">
          <Card className="p-8 text-center border-game-danger bg-gradient-danger">
            <h1 className="text-4xl font-bold text-white mb-4">GAME OVER</h1>
            <p className="text-xl text-white mb-2">Final Score: {gameState.score}</p>
            <p className="text-lg text-white mb-6">Level Reached: {gameState.level}</p>
            <Button 
              onClick={resetGame}
              className="bg-gradient-neon text-black font-bold px-8 py-3 shadow-neon"
            >
              Play Again
            </Button>
          </Card>
        </div>
      )}

      {/* Input */}
      {gameState.isPlaying && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
          <Input
            ref={inputRef}
            value={gameState.currentInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type words to shoot them..."
            className="w-96 text-lg bg-card/80 backdrop-blur border-primary text-center shadow-glow"
            autoFocus
          />
        </div>
      )}

      {/* Instructions */}
      {!gameState.isPlaying && !gameState.isGameOver && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-center">
          <Card className="p-6 bg-card/80 backdrop-blur border-primary">
            <h2 className="text-2xl font-bold text-primary mb-4">ZType Typing Defense</h2>
            <p className="text-muted-foreground mb-2">Type the falling words to shoot them!</p>
            <p className="text-muted-foreground mb-2">Don't let words reach your base!</p>
            <p className="text-muted-foreground">Level up every 1000 points for increased difficulty!</p>
          </Card>
        </div>
      )}
    </div>
  );
};