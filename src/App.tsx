/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Zap } from 'lucide-react';

// --- Constants ---
const GROUND_HEIGHT = 80;
const PLAYER_SIZE = 50;
const INITIAL_GAME_SPEED = 5;
const SPEED_INCREMENT = 0.001;
const GRAVITY = 0.8;
const JUMP_FORCE = -16;

// --- Sound Utilities ---
const playJumpSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error('Audio error:', e);
  }
};

const playGameOverSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error('Audio error:', e);
  }
};

type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface Obstacle {
  x: number;
  width: number;
  height: number;
  color: string;
  shape: 'rect' | 'circle' | 'triangle';
}

interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('endless-runner-highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Game variables (refs to avoid re-renders during loop)
  const gameRef = useRef({
    playerY: 0,
    playerVelocityY: 0,
    isJumping: false,
    obstacles: [] as Obstacle[],
    clouds: [] as Cloud[],
    gameSpeed: INITIAL_GAME_SPEED,
    distance: 0,
    animationFrameId: 0,
    lastObstacleTime: 0,
    groundOffset: 0,
  });

  const startGame = () => {
    setGameState('PLAYING');
    setScore(0);
    gameRef.current = {
      playerY: 0,
      playerVelocityY: 0,
      isJumping: false,
      obstacles: [],
      clouds: Array.from({ length: 5 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * 200 + 50,
        size: Math.random() * 60 + 40,
        speed: Math.random() * 0.5 + 0.2,
      })),
      gameSpeed: INITIAL_GAME_SPEED,
      distance: 0,
      animationFrameId: 0,
      lastObstacleTime: 0,
      groundOffset: 0,
    };
  };

  const jump = () => {
    if (!gameRef.current.isJumping && gameState === 'PLAYING') {
      gameRef.current.playerVelocityY = JUMP_FORCE;
      gameRef.current.isJumping = true;
      playJumpSound();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (gameState === 'PLAYING') {
          jump();
        } else if (gameState === 'START' || gameState === 'GAMEOVER') {
          startGame();
        }
      }
    };

    const handleTouch = () => {
      if (gameState === 'PLAYING') {
        jump();
      } else if (gameState === 'START' || gameState === 'GAMEOVER') {
        startGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouch);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const update = () => {
      const g = gameRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const groundY = height - GROUND_HEIGHT;

      // Update Player
      g.playerVelocityY += GRAVITY;
      g.playerY += g.playerVelocityY;

      if (g.playerY > 0) {
        g.playerY = 0;
        g.playerVelocityY = 0;
        g.isJumping = false;
      }

      // Update Speed & Distance
      g.gameSpeed += SPEED_INCREMENT;
      g.distance += g.gameSpeed;
      setScore(Math.floor(g.distance / 50));

      // Update Ground
      g.groundOffset = (g.groundOffset + g.gameSpeed) % 100;

      // Update Clouds
      g.clouds.forEach(cloud => {
        cloud.x -= cloud.speed + g.gameSpeed * 0.1;
        if (cloud.x + cloud.size < 0) {
          cloud.x = width + cloud.size;
          cloud.y = Math.random() * 200 + 50;
        }
      });

      // Spawn Obstacles
      const now = Date.now();
      if (now - g.lastObstacleTime > Math.max(1500 - g.gameSpeed * 50, 600)) {
        const h = Math.random() * 40 + 30;
        const w = Math.random() * 30 + 30;
        const colors = ['#FF5F5F', '#FFBD33', '#33FF57', '#3357FF', '#F333FF'];
        const shapes: ('rect' | 'circle' | 'triangle')[] = ['rect', 'circle', 'triangle'];
        
        g.obstacles.push({
          x: width,
          width: w,
          height: h,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
        g.lastObstacleTime = now;
      }

      // Update Obstacles & Collision
      const playerX = 100;
      const playerYPos = groundY - PLAYER_SIZE + g.playerY;

      for (let i = g.obstacles.length - 1; i >= 0; i--) {
        const obs = g.obstacles[i];
        obs.x -= g.gameSpeed;

        // Collision Detection
        if (
          playerX < obs.x + obs.width &&
          playerX + PLAYER_SIZE > obs.x &&
          playerYPos < groundY &&
          playerYPos + PLAYER_SIZE > groundY - obs.height
        ) {
          setGameState('GAMEOVER');
          playGameOverSound();
          return;
        }

        if (obs.x + obs.width < 0) {
          g.obstacles.splice(i, 1);
        }
      }

      draw();
      g.animationFrameId = requestAnimationFrame(update);
    };

    const draw = () => {
      const g = gameRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const groundY = height - GROUND_HEIGHT;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Draw Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, '#87CEEB');
      skyGrad.addColorStop(1, '#E0F6FF');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, groundY);

      // Draw Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      g.clouds.forEach(cloud => {
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size * 0.5, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.3, cloud.y - cloud.size * 0.2, cloud.size * 0.4, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.6, cloud.y, cloud.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Ground
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, groundY, width, GROUND_HEIGHT);
      
      // Ground details (moving lines)
      ctx.strokeStyle = '#388E3C';
      ctx.lineWidth = 4;
      for (let x = -g.groundOffset; x < width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, groundY + 10);
        ctx.lineTo(x + 40, groundY + 10);
        ctx.stroke();
      }

      // Draw Player
      const playerX = 100;
      const playerYPos = groundY - PLAYER_SIZE + g.playerY;
      
      // Body
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.roundRect(playerX, playerYPos, PLAYER_SIZE, PLAYER_SIZE, 10);
      ctx.fill();
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Eyes
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(playerX + 35, playerYPos + 15, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(playerX + 37, playerYPos + 15, 3, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.beginPath();
      ctx.arc(playerX + 35, playerYPos + 30, 8, 0, Math.PI, false);
      ctx.stroke();

      // Draw Obstacles
      g.obstacles.forEach(obs => {
        ctx.fillStyle = obs.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = obs.color;
        
        if (obs.shape === 'rect') {
          ctx.beginPath();
          ctx.roundRect(obs.x, groundY - obs.height, obs.width, obs.height, 5);
          ctx.fill();
        } else if (obs.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, groundY - obs.height / 2, obs.width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(obs.x, groundY);
          ctx.lineTo(obs.x + obs.width / 2, groundY - obs.height);
          ctx.lineTo(obs.x + obs.width, groundY);
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    };

    update();

    return () => {
      cancelAnimationFrame(gameRef.current.animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [gameState]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('endless-runner-highscore', score.toString());
    }
  }, [score, highScore]);

  return (
    <div id="game-container" className="relative w-full h-screen overflow-hidden bg-sky-300 font-sans select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />

      {/* HUD */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
        <div className="bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg border-b-4 border-gray-200">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Score</p>
          <p className="text-4xl font-black text-indigo-600 tabular-nums">{score}</p>
        </div>
        
        <div className="bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg border-b-4 border-gray-200 text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
            <Trophy size={14} className="text-amber-500" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Best</p>
          </div>
          <p className="text-2xl font-black text-amber-600 tabular-nums">{highScore}</p>
        </div>
      </div>

      {/* Speed Indicator */}
      {gameState === 'PLAYING' && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">
          <Zap size={14} className="text-yellow-400 fill-yellow-400" />
          <span className="text-white text-xs font-bold uppercase tracking-tighter">
            Speed: {gameRef.current.gameSpeed.toFixed(1)}x
          </span>
        </div>
      )}

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-indigo-900/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-10 rounded-[40px] shadow-2xl text-center max-w-sm w-full border-b-8 border-indigo-100"
            >
              <div className="w-24 h-24 bg-yellow-400 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg transform rotate-12">
                <Play size={48} className="text-white fill-white ml-2" />
              </div>
              <h1 className="text-4xl font-black text-gray-900 mb-2">Endless Runner</h1>
              <p className="text-gray-500 mb-8 font-medium">Jump over obstacles and survive as long as you can!</p>
              
              <button
                onClick={startGame}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xl shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                Start Game
              </button>
              <p className="mt-4 text-xs text-gray-400 font-bold uppercase tracking-widest">Press Space or Tap to Jump</p>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-10 rounded-[40px] shadow-2xl text-center max-w-sm w-full border-b-8 border-red-100"
            >
              <div className="text-6xl mb-4">😵</div>
              <h1 className="text-4xl font-black text-gray-900 mb-2">Game Over!</h1>
              <div className="flex justify-center gap-8 my-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Score</p>
                  <p className="text-3xl font-black text-indigo-600">{score}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Best</p>
                  <p className="text-3xl font-black text-amber-600">{highScore}</p>
                </div>
              </div>
              
              <button
                onClick={startGame}
                className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-xl shadow-xl shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <RotateCcw size={24} />
                Try Again
              </button>
              <p className="mt-4 text-xs text-gray-400 font-bold uppercase tracking-widest">Press Space to Restart</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Hint */}
      {gameState === 'PLAYING' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
          Space or Tap to Jump
        </div>
      )}
    </div>
  );
}
