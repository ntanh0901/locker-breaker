"use client";

import { useState, useEffect } from "react";
import { Lock, Brain, Target, Trophy, RotateCcw } from "lucide-react";
import {
  GameState,
  Guess,
  Feedback,
  initializeGameState,
  addGuessToGameState,
  getBestNextGuess,
  getOptimalFirstGuess,
} from "@/lib/mastermind-solver";

export default function LockerBreaker() {
  const [gameState, setGameState] = useState<GameState>(initializeGameState());
  const [currentGuess, setCurrentGuess] = useState<number[]>([0, 0, 0, 0]);
  const [currentFeedback, setCurrentFeedback] = useState<Feedback>({
    correct: 0,
    partial: 0,
  });
  const [suggestion, setSuggestion] = useState<ReturnType<
    typeof getBestNextGuess
  > | null>(null);
  const [isGameWon, setIsGameWon] = useState(false);

  // Update suggestion when game state changes
  useEffect(() => {
    if (!isGameWon && gameState.possibleSolutions.length > 0) {
      const newSuggestion = getBestNextGuess(gameState);
      setSuggestion(newSuggestion);
    }
  }, [gameState, isGameWon]);

  const handleGuessChange = (index: number, value: string) => {
    const digit = parseInt(value) || 0;
    if (digit >= 0 && digit <= 9) {
      const newGuess = [...currentGuess];
      newGuess[index] = digit;
      setCurrentGuess(newGuess);
    }
  };

  const handleFeedbackChange = (type: "correct" | "partial", value: string) => {
    const num = parseInt(value) || 0;
    if (num >= 0 && num <= 4) {
      setCurrentFeedback((prev) => ({
        ...prev,
        [type]: num,
      }));
    }
  };

  const submitGuess = () => {
    if (currentFeedback.correct + currentFeedback.partial > 4) {
      alert("Total feedback cannot exceed 4!");
      return;
    }

    const newGameState = addGuessToGameState(
      gameState,
      currentGuess,
      currentFeedback
    );
    setGameState(newGameState);

    if (currentFeedback.correct === 4) {
      setIsGameWon(true);
    }

    // Reset for next guess
    setCurrentGuess([0, 0, 0, 0]);
    setCurrentFeedback({ correct: 0, partial: 0 });
  };

  const resetGame = () => {
    setGameState(initializeGameState());
    setCurrentGuess([0, 0, 0, 0]);
    setCurrentFeedback({ correct: 0, partial: 0 });
    setIsGameWon(false);
  };

  const useOptimalFirstGuess = () => {
    const optimal = getOptimalFirstGuess();
    setCurrentGuess(optimal);
  };

  const useSuggestedGuess = (guess: Guess) => {
    setCurrentGuess([...guess]);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Lock className="text-blue-400" size={32} />
            <h1 className="text-4xl font-bold text-white">Locker Breaker</h1>
            <Brain className="text-purple-400" size={32} />
          </div>
          <p className="text-gray-300 text-lg">
            Master the 4-digit code with optimal Mastermind strategy
          </p>
        </div>

        {/* Game won banner */}
        {isGameWon && (
          <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-lg p-6 mb-6 text-center">
            <Trophy className="mx-auto mb-2" size={32} />
            <h2 className="text-2xl font-bold">Congratulations!</h2>
            <p>You cracked the code in {gameState.guesses.length} moves!</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Input and History */}
          <div>
            {/* Current Guess Input */}
            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target size={20} />
                Enter Your Guess
              </h3>

              <div className="flex gap-2 mb-4">
                {currentGuess.map((digit, index) => (
                  <input
                    key={index}
                    type="number"
                    min="0"
                    max="9"
                    value={digit}
                    onChange={(e) => handleGuessChange(index, e.target.value)}
                    className="digit-input"
                    disabled={isGameWon}
                  />
                ))}
              </div>

              {/* Feedback Input */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Correct (Green)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={currentFeedback.correct}
                    onChange={(e) =>
                      handleFeedbackChange("correct", e.target.value)
                    }
                    className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-green-500"
                    disabled={isGameWon}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Partial (Yellow)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={currentFeedback.partial}
                    onChange={(e) =>
                      handleFeedbackChange("partial", e.target.value)
                    }
                    className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-yellow-500"
                    disabled={isGameWon}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={submitGuess}
                  disabled={isGameWon}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
                >
                  Submit Guess
                </button>
                <button
                  onClick={resetGame}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-medium transition-colors flex items-center gap-2"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
              </div>
            </div>

            {/* Guess History */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Guess History</h3>

              {gameState.guesses.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No guesses yet</p>
              ) : (
                <div className="space-y-3">
                  {gameState.guesses.map((guess, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 bg-slate-700 rounded"
                    >
                      <span className="text-sm text-gray-400 w-6">
                        #{index + 1}
                      </span>
                      <div className="flex gap-1">
                        {guess.map((digit, digitIndex) => (
                          <div
                            key={digitIndex}
                            className="w-8 h-8 bg-slate-600 rounded flex items-center justify-center font-mono"
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm">
                            {gameState.feedbacks[index].correct}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <span className="text-sm">
                            {gameState.feedbacks[index].partial}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - AI Suggestions */}
          <div>
            {/* AI Suggestions */}
            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Brain className="text-purple-400" size={20} />
                AI Strategy Assistant
              </h3>

              {gameState.guesses.length === 0 && (
                <div className="mb-4">
                  <p className="text-gray-300 mb-3">
                    Start with an optimal first guess:
                  </p>
                  <button
                    onClick={useOptimalFirstGuess}
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-medium transition-colors"
                  >
                    Use Optimal First Guess
                  </button>
                </div>
              )}

              {suggestion && !isGameWon && (
                <div>
                  <div className="mb-4">
                    <p className="text-gray-300 mb-2">
                      Recommended next guess:
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {suggestion.bestGuess.map((digit, index) => (
                          <div
                            key={index}
                            className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center font-mono font-bold"
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => useSuggestedGuess(suggestion.bestGuess)}
                        className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm font-medium transition-colors"
                      >
                        Use This
                      </button>
                    </div>
                  </div>

                  {suggestion.alternativeGuesses.length > 0 && (
                    <div>
                      <p className="text-gray-300 mb-2">
                        Alternative good moves:
                      </p>
                      <div className="space-y-2">
                        {suggestion.alternativeGuesses
                          .slice(0, 3)
                          .map((guess, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3"
                            >
                              <div className="flex gap-1">
                                {guess.map((digit, digitIndex) => (
                                  <div
                                    key={digitIndex}
                                    className="w-8 h-8 bg-slate-600 rounded flex items-center justify-center font-mono text-sm"
                                  >
                                    {digit}
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => useSuggestedGuess(guess)}
                                className="bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-xs font-medium transition-colors"
                              >
                                Use
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Game Stats */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Game Statistics</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {gameState.guesses.length}
                  </div>
                  <div className="text-sm text-gray-400">Guesses Made</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {gameState.possibleSolutions.length}
                  </div>
                  <div className="text-sm text-gray-400">
                    Possible Solutions
                  </div>
                </div>
                {suggestion && (
                  <div className="text-center col-span-2">
                    <div className="text-2xl font-bold text-green-400">
                      {suggestion.worstCaseRemaining}
                    </div>
                    <div className="text-sm text-gray-400">
                      Worst Case Remaining
                    </div>
                  </div>
                )}
              </div>

              {gameState.possibleSolutions.length <= 5 &&
                gameState.possibleSolutions.length > 1 && (
                  <div className="mt-4">
                    <p className="text-green-400 font-medium mb-2">
                      Remaining possibilities:
                    </p>
                    <div className="space-y-1">
                      {gameState.possibleSolutions.map((solution, index) => (
                        <div key={index} className="flex gap-1">
                          {solution.map((digit, digitIndex) => (
                            <div
                              key={digitIndex}
                              className="w-6 h-6 bg-green-600 rounded flex items-center justify-center font-mono text-xs"
                            >
                              {digit}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">How to Play</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-green-400 mb-2">
                🟢 Green (Correct)
              </h4>
              <p className="text-gray-300">Right digit in the right position</p>
            </div>
            <div>
              <h4 className="font-medium text-yellow-400 mb-2">
                🟡 Yellow (Partial)
              </h4>
              <p className="text-gray-300">Right digit in the wrong position</p>
            </div>
            <div>
              <h4 className="font-medium text-red-400 mb-2">🔴 Red (Wrong)</h4>
              <p className="text-gray-300">Digit not in the code at all</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
