"use client";

import { useState } from "react";
import {
  Lock,
  Brain,
  Play,
  RotateCcw,
  Zap,
  Target,
  Trophy,
  Lightbulb,
  Shuffle,
  Eye,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  GameState,
  Guess,
  SlotFeedback,
  initializeGameState,
  addGuessToGameState,
  getBestNextGuesses,
  getOptimalFirstGuesses,
  generateRandomSecret,
  calculateSlotBySlotFeedback,
} from "@/lib/mastermind-solver";

type GameMode = "helper" | "practice";
type GameStep =
  | "waiting_for_guess"
  | "waiting_for_result"
  | "analyzing"
  | "showing_suggestions";

export default function LockerBreaker() {
  // Game state
  const [gameMode, setGameMode] = useState<GameMode>("helper");
  const [gameStep, setGameStep] = useState<GameStep>("waiting_for_guess");
  const [gameState, setGameState] = useState<GameState>(initializeGameState());

  // Current move
  const [currentGuess, setCurrentGuess] = useState<number[]>([0, 0, 0, 0]);
  const [currentSlotFeedback, setCurrentSlotFeedback] = useState<SlotFeedback>([
    "wrong",
    "wrong",
    "wrong",
    "wrong",
  ]);

  // Suggestions
  const [suggestions, setSuggestions] = useState<ReturnType<
    typeof getBestNextGuesses
  > | null>(null);

  // Practice mode
  const [practiceSecret, setPracticeSecret] = useState<Guess>([0, 0, 0, 0]);
  const [practiceGuess, setPracticeGuess] = useState<number[]>([0, 0, 0, 0]);
  const [practiceResult, setPracticeResult] = useState<SlotFeedback | null>(
    null
  );
  const [showSecret, setShowSecret] = useState(false);

  // Game status
  const [isGameWon, setIsGameWon] = useState(false);

  const handleGuessChange = (index: number, value: string) => {
    const digit = parseInt(value) || 0;
    if (digit >= 0 && digit <= 9) {
      if (gameMode === "helper") {
        const newGuess = [...currentGuess];
        newGuess[index] = digit;
        setCurrentGuess(newGuess);
      } else {
        const newGuess = [...practiceGuess];
        newGuess[index] = digit;
        setPracticeGuess(newGuess);
      }
    }
  };

  const adjustDigit = (index: number, direction: "up" | "down") => {
    const currentArray = gameMode === "helper" ? currentGuess : practiceGuess;
    const currentValue = currentArray[index];
    let newValue;

    if (direction === "up") {
      newValue = currentValue === 9 ? 0 : currentValue + 1;
    } else {
      newValue = currentValue === 0 ? 9 : currentValue - 1;
    }

    if (gameMode === "helper") {
      const newGuess = [...currentGuess];
      newGuess[index] = newValue;
      setCurrentGuess(newGuess);
    } else {
      const newGuess = [...practiceGuess];
      newGuess[index] = newValue;
      setPracticeGuess(newGuess);
    }
  };

  const handleSlotFeedbackChange = (
    index: number,
    feedback: "correct" | "partial" | "wrong"
  ) => {
    const newFeedback = [...currentSlotFeedback];
    newFeedback[index] = feedback;
    setCurrentSlotFeedback(newFeedback);
  };

  const cycleSlotFeedback = (index: number) => {
    const currentFeedback = currentSlotFeedback[index];
    let nextFeedback: "correct" | "partial" | "wrong";

    switch (currentFeedback) {
      case "wrong":
        nextFeedback = "partial";
        break;
      case "partial":
        nextFeedback = "correct";
        break;
      case "correct":
        nextFeedback = "wrong";
        break;
      default:
        nextFeedback = "wrong";
    }

    handleSlotFeedbackChange(index, nextFeedback);
  };

  // Validate feedback for mathematical possibility
  const validateFeedback = (
    guess: number[],
    slotFeedback: SlotFeedback
  ): { isValid: boolean; message?: string } => {
    const correctCount = slotFeedback.filter((f) => f === "correct").length;
    const partialCount = slotFeedback.filter((f) => f === "partial").length;

    // Basic validation: total feedback can't exceed 4
    if (correctCount + partialCount > 4) {
      return {
        isValid: false,
        message: "Total feedback (correct + partial) cannot exceed 4!",
      };
    }

    return { isValid: true };
  };

  const submitMove = () => {
    if (gameMode === "helper") {
      // Validate feedback first
      const validation = validateFeedback(currentGuess, currentSlotFeedback);
      if (!validation.isValid) {
        alert(validation.message);
        return;
      }

      setGameStep("analyzing");

      // Debug logging
      console.log("Current guess:", currentGuess);
      console.log("Slot feedback:", currentSlotFeedback);
      console.log(
        "Current possible solutions:",
        gameState.possibleSolutions.length
      );

      // Use slot-by-slot filtering
      const newGameState = addGuessToGameState(
        gameState,
        currentGuess,
        currentSlotFeedback
      );

      setGameState(newGameState);
      console.log(
        "New possible solutions:",
        newGameState.possibleSolutions.length
      );

      // Check for win
      const correctCount = currentSlotFeedback.filter(
        (f) => f === "correct"
      ).length;
      if (correctCount === 4) {
        setIsGameWon(true);
        setGameStep("waiting_for_guess");
        return;
      }

      // Calculate suggestions
      setTimeout(() => {
        try {
          const newSuggestions = getBestNextGuesses(newGameState, 5);
          console.log("Generated suggestions:", newSuggestions);
          setSuggestions(newSuggestions);
          setGameStep("showing_suggestions");
        } catch (error) {
          console.error("Error generating suggestions:", error);
          // Fallback: show remaining possible solutions as suggestions
          const fallbackSuggestions = {
            suggestions: newGameState.possibleSolutions
              .slice(0, 5)
              .map((guess) => ({
                guess,
                score: 1,
                isPossibleSolution: true,
              })),
            possibleSolutionsCount: newGameState.possibleSolutions.length,
          };
          setSuggestions(fallbackSuggestions);
          setGameStep("showing_suggestions");
        }
      }, 500);
    } else {
      // Practice mode
      const result = calculateSlotBySlotFeedback(practiceGuess, practiceSecret);
      setPracticeResult(result);

      if (result.every((r) => r === "correct")) {
        setIsGameWon(true);
      }
    }
  };

  const nextMove = () => {
    // Go back to results entry with the same guess, don't reset everything
    setGameStep("waiting_for_result");
    setCurrentSlotFeedback(["wrong", "wrong", "wrong", "wrong"]);
    setSuggestions(null);
  };

  const resetGame = () => {
    setGameState(initializeGameState());
    setCurrentGuess([0, 0, 0, 0]);
    setCurrentSlotFeedback(["wrong", "wrong", "wrong", "wrong"]);
    setSuggestions(null);
    setGameStep("waiting_for_guess");
    setIsGameWon(false);

    if (gameMode === "practice") {
      setPracticeSecret(generateRandomSecret());
      setPracticeGuess([0, 0, 0, 0]);
      setPracticeResult(null);
      setShowSecret(false);
    }
  };

  const switchMode = (mode: GameMode) => {
    setGameMode(mode);
    resetGame();

    if (mode === "practice") {
      setPracticeSecret(generateRandomSecret());
    }
  };

  const useSuggestion = (guess: Guess) => {
    setCurrentGuess([...guess]);
    setGameStep("waiting_for_result");
  };

  const getSlotColor = (feedback: "correct" | "partial" | "wrong") => {
    switch (feedback) {
      case "correct":
        return "bg-green-500 border-green-400";
      case "partial":
        return "bg-yellow-500 border-yellow-400";
      case "wrong":
        return "bg-red-500 border-red-400";
    }
  };

  const getFeedbackEmoji = (feedback: "correct" | "partial" | "wrong") => {
    switch (feedback) {
      case "correct":
        return "🟢";
      case "partial":
        return "🟡";
      case "wrong":
        return "🔴";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-2 sm:p-4 lg:p-6">
      <div className="max-w-sm sm:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Lock className="text-yellow-400" size={32} />
            <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              LOCKER BREAKER
            </h1>
            <Brain className="text-purple-400" size={32} />
          </div>
        </header>

        {/* Mode Selector */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="bg-slate-800 rounded-xl p-1 sm:p-2 flex gap-1 sm:gap-2 w-full max-w-md">
            <button
              onClick={() => switchMode("helper")}
              className={`flex-1 px-4 sm:px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
                gameMode === "helper"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-slate-700"
              }`}
              aria-label="Switch to game helper mode"
            >
              <Target size={18} />
              <span className="hidden sm:inline">Game Helper</span>
              <span className="sm:hidden">Helper</span>
            </button>
            <button
              onClick={() => switchMode("practice")}
              className={`flex-1 px-4 sm:px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
                gameMode === "practice"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-slate-700"
              }`}
              aria-label="Switch to practice mode"
            >
              <Play size={18} />
              Practice
            </button>
          </div>
        </div>

        {/* Game Won Banner */}
        {isGameWon && (
          <div
            className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-xl p-4 sm:p-6 mb-6 text-center shadow-2xl"
            role="alert"
            aria-live="polite"
          >
            <Trophy className="mx-auto mb-2" size={32} />
            <h2 className="text-2xl sm:text-3xl font-bold">
              🎉 CODE CRACKED! 🎉
            </h2>
            <p className="text-base sm:text-lg">
              {gameMode === "helper"
                ? `Solved in ${gameState.guesses.length} moves!`
                : "You found the secret code!"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Main Game Area */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 lg:p-8 shadow-2xl border border-slate-700">
              {/* Slot Machine Header */}
              <div className="text-center mb-4 sm:mb-6">
                <div className="flex justify-center gap-2 sm:gap-4 text-xs sm:text-sm">
                  <span className="text-green-400">🟢 JACKPOT</span>
                  <span className="text-yellow-400">🟡 NEAR MISS</span>
                  <span className="text-red-400">🔴 NO MATCH</span>
                </div>
              </div>

              {/* Main Combination Lock Display */}
              <div className="bg-black rounded-xl p-3 sm:p-6 mb-4 sm:mb-6 border-4 border-yellow-500 shadow-inner">
                <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4">
                  {/* Combination Lock Wheels */}
                  {(gameMode === "helper" ? currentGuess : practiceGuess).map(
                    (digit, index) => (
                      <div key={index} className="relative">
                        {/* Lock Wheel Container */}
                        <div className="bg-slate-700 rounded-lg border-2 border-slate-600 overflow-hidden">
                          {/* Up Arrow */}
                          <button
                            onClick={() => adjustDigit(index, "up")}
                            disabled={isGameWon}
                            className="w-full h-8 sm:h-10 bg-slate-600 hover:bg-slate-500 active:bg-slate-400 disabled:opacity-50 flex items-center justify-center border-b border-slate-500 touch-manipulation transition-colors"
                            aria-label={`Increase digit ${index + 1}`}
                          >
                            <ChevronUp size={16} className="text-orange-400" />
                          </button>

                          {/* Number Display */}
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="9"
                              value={digit}
                              onChange={(e) =>
                                handleGuessChange(index, e.target.value)
                              }
                              className="w-full h-12 sm:h-16 text-center text-2xl sm:text-3xl font-bold bg-gradient-to-b from-slate-600 to-slate-800 text-white border-none focus:outline-none focus:ring-4 focus:ring-yellow-400 appearance-none p-0 leading-none flex items-center justify-center"
                              style={{
                                lineHeight: "1",
                                paddingTop: "0",
                                paddingBottom: "0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              disabled={isGameWon}
                              aria-label={`Digit ${index + 1}`}
                              inputMode="numeric"
                            />
                            {/* Lock wheel effect overlay */}
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="w-full h-full border-l border-r border-slate-500 opacity-50"></div>
                            </div>
                          </div>

                          {/* Down Arrow */}
                          <button
                            onClick={() => adjustDigit(index, "down")}
                            disabled={isGameWon}
                            className="w-full h-8 sm:h-10 bg-slate-600 hover:bg-slate-500 active:bg-slate-400 disabled:opacity-50 flex items-center justify-center border-t border-slate-500 touch-manipulation transition-colors"
                            aria-label={`Decrease digit ${index + 1}`}
                          >
                            <ChevronDown
                              size={16}
                              className="text-orange-400"
                            />
                          </button>
                        </div>

                        {/* Slot Result Indicator */}
                        {gameMode === "helper" &&
                          gameStep !== "waiting_for_guess" && (
                            <div
                              className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 ${getSlotColor(
                                currentSlotFeedback[index]
                              )} flex items-center justify-center text-xs z-10`}
                              aria-label={`Slot ${index + 1} result: ${
                                currentSlotFeedback[index]
                              }`}
                            >
                              {getFeedbackEmoji(currentSlotFeedback[index])}
                            </div>
                          )}

                        {/* Practice Mode Results */}
                        {gameMode === "practice" && practiceResult && (
                          <div
                            className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 ${getSlotColor(
                              practiceResult[index]
                            )} flex items-center justify-center text-xs z-10`}
                            aria-label={`Slot ${index + 1} result: ${
                              practiceResult[index]
                            }`}
                          >
                            {getFeedbackEmoji(practiceResult[index])}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Feedback Input for Helper Mode */}
                {gameMode === "helper" && gameStep === "waiting_for_result" && (
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-slate-800 rounded-lg">
                    <h4 className="text-base sm:text-lg font-semibold mb-4 text-center">
                      🎯 Enter Results from Your Attempt
                    </h4>
                    <p className="text-sm text-gray-400 text-center mb-4">
                      Tap the colored circles below each number to cycle through
                      results
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:gap-4">
                      {currentSlotFeedback.map((feedback, index) => (
                        <div key={index} className="text-center">
                          {/* <div className="mb-2 text-sm font-medium text-gray-300">
                            Slot {index + 1}
                          </div> */}
                          {/* <div className="mb-3 w-8 h-8 mx-auto bg-slate-600 rounded flex items-center justify-center text-lg font-bold">
                            {currentGuess[index]}
                          </div> */}
                          <button
                            onClick={() => cycleSlotFeedback(index)}
                            className={`w-full h-16 rounded-lg border-2 transition-all touch-manipulation flex flex-col items-center justify-center gap-1 ${
                              feedback === "correct"
                                ? "bg-green-600 border-green-400 text-white"
                                : feedback === "partial"
                                ? "bg-yellow-600 border-yellow-400 text-white"
                                : "bg-red-600 border-red-400 text-white"
                            }`}
                            aria-label={`Slot ${
                              index + 1
                            }: ${feedback}. Tap to change.`}
                          >
                            <div className="text-lg">
                              {feedback === "correct"
                                ? "🟢"
                                : feedback === "partial"
                                ? "🟡"
                                : "🔴"}
                            </div>
                            <span className="text-xs font-bold">
                              {feedback === "correct"
                                ? "CORRECT"
                                : feedback === "partial"
                                ? "PARTIAL"
                                : "WRONG"}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* <div className="mt-4 text-xs text-gray-400 text-center">
                      🔴 Wrong → 🟡 Partial → 🟢 Correct → 🔴 Wrong
                    </div> */}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                  {gameMode === "helper" &&
                    gameStep === "waiting_for_guess" && (
                      <button
                        onClick={() => setGameStep("waiting_for_result")}
                        disabled={isGameWon}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95 px-4 sm:px-6 py-3 rounded-lg font-bold text-sm sm:text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation min-h-[48px]"
                        aria-label="Try this code on your device"
                      >
                        <Zap size={18} />
                        <span className="hidden sm:inline">TRY THIS CODE</span>
                        <span className="sm:hidden">TRY CODE</span>
                      </button>
                    )}

                  {gameMode === "helper" &&
                    gameStep === "waiting_for_result" && (
                      <button
                        onClick={submitMove}
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 active:scale-95 px-4 sm:px-6 py-3 rounded-lg font-bold text-sm sm:text-lg transition-all flex items-center justify-center gap-2 touch-manipulation min-h-[48px]"
                        aria-label="Analyze the results"
                      >
                        <Brain size={18} />
                        <span className="hidden sm:inline">
                          ANALYZE RESULTS
                        </span>
                        <span className="sm:hidden">ANALYZE</span>
                      </button>
                    )}

                  {gameMode === "helper" &&
                    gameStep === "showing_suggestions" && (
                      <button
                        onClick={nextMove}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 active:scale-95 px-4 sm:px-6 py-3 rounded-lg font-bold text-sm sm:text-lg transition-all flex items-center justify-center gap-2 touch-manipulation min-h-[48px]"
                        aria-label="Proceed to next move"
                      >
                        <Target size={18} />
                        <span className="hidden sm:inline">NEXT MOVE</span>
                        <span className="sm:hidden">NEXT</span>
                      </button>
                    )}

                  {gameMode === "practice" && (
                    <button
                      onClick={submitMove}
                      disabled={isGameWon}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 active:scale-95 px-4 sm:px-6 py-3 rounded-lg font-bold text-sm sm:text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation min-h-[48px]"
                      aria-label="Check your code guess"
                    >
                      <Play size={18} />
                      <span className="hidden sm:inline">CHECK CODE</span>
                      <span className="sm:hidden">CHECK</span>
                    </button>
                  )}

                  <button
                    onClick={resetGame}
                    className="bg-gray-600 hover:bg-gray-700 active:scale-95 px-4 sm:px-6 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 touch-manipulation min-h-[48px]"
                    aria-label="Reset the game"
                  >
                    <RotateCcw size={18} />
                    <span className="hidden sm:inline">RESET</span>
                  </button>
                </div>

                {/* Practice Mode Secret */}
                {gameMode === "practice" && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-sm text-gray-400 hover:text-white flex items-center gap-2 mx-auto touch-manipulation min-h-[44px] px-2 py-1"
                      aria-label={
                        showSecret ? "Hide secret code" : "Show secret code"
                      }
                      aria-expanded={showSecret}
                    >
                      <Eye size={16} />
                      {showSecret ? "Hide" : "Show"} Secret Code
                    </button>
                    {showSecret && (
                      <div
                        className="mt-2 flex gap-1 justify-center"
                        role="region"
                        aria-label="Secret code"
                      >
                        {practiceSecret.map((digit, index) => (
                          <div
                            key={index}
                            className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-600 rounded text-center leading-6 sm:leading-8 font-bold text-xs sm:text-sm"
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Loading Animation */}
              {gameStep === "analyzing" && (
                <div
                  className="text-center py-6 sm:py-8"
                  role="status"
                  aria-live="polite"
                >
                  <div className="inline-block animate-spin text-3xl sm:text-4xl mb-4">
                    🧠
                  </div>
                  <p className="text-lg sm:text-xl text-purple-400 font-semibold">
                    Analyzing your results...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Suggestions & Stats */}
          <div className="space-y-4 sm:space-y-6">
            {/* AI Suggestions */}
            {gameMode === "helper" && gameStep === "showing_suggestions" && (
              <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
                <h3 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
                  <Lightbulb className="text-yellow-400" size={20} />
                  Suggestions
                </h3>

                {suggestions && suggestions.suggestions.length > 0 ? (
                  <div className="space-y-3">
                    {suggestions.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className={`w-full p-3 sm:p-4 rounded-lg border transition-all hover:scale-105 active:scale-95 touch-manipulation ${
                          index === 0
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 border-blue-400"
                            : "bg-slate-700 border-slate-600 hover:border-slate-500"
                        }`}
                        onClick={() => useSuggestion(suggestion.guess)}
                        aria-label={`Use suggestion ${
                          index + 1
                        }: ${suggestion.guess.join(" ")}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs sm:text-sm font-medium">
                            {index === 0
                              ? "🌟 BEST MOVE"
                              : `Option ${index + 1}`}
                          </span>
                          <span className="text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                            Score: {suggestion.score}
                          </span>
                        </div>

                        <div className="flex gap-1 mb-2 justify-center">
                          {suggestion.guess.map((digit, digitIndex) => (
                            <div
                              key={digitIndex}
                              className={`w-6 h-6 sm:w-8 sm:h-8 rounded flex items-center justify-center font-bold text-xs sm:text-sm ${
                                index === 0
                                  ? "bg-white text-purple-800"
                                  : "bg-slate-600 text-white"
                              }`}
                            >
                              {digit}
                            </div>
                          ))}
                        </div>

                        <div className="text-xs text-gray-300">
                          {suggestion.isPossibleSolution &&
                            "✨ Possible solution"}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : gameState.possibleSolutions.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-yellow-400 text-sm mb-3">
                      🎯 Remaining possible solutions:
                    </p>
                    {gameState.possibleSolutions
                      .slice(0, 5)
                      .map((solution, index) => (
                        <button
                          key={index}
                          className="w-full p-3 sm:p-4 rounded-lg border bg-slate-700 border-slate-600 hover:border-slate-500 transition-all hover:scale-105 active:scale-95 touch-manipulation"
                          onClick={() => useSuggestion(solution)}
                          aria-label={`Use solution ${
                            index + 1
                          }: ${solution.join(" ")}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs sm:text-sm font-medium">
                              Solution {index + 1}
                            </span>
                          </div>

                          <div className="flex gap-1 mb-2 justify-center">
                            {solution.map((digit, digitIndex) => (
                              <div
                                key={digitIndex}
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded flex items-center justify-center font-bold bg-green-600 text-white text-xs sm:text-sm"
                              >
                                {digit}
                              </div>
                            ))}
                          </div>

                          <div className="text-xs text-gray-300">
                            ✨ Guaranteed solution
                          </div>
                        </button>
                      ))}
                    {gameState.possibleSolutions.length > 5 && (
                      <p className="text-xs text-gray-400 text-center">
                        ...and {gameState.possibleSolutions.length - 5} more
                        possibilities
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8 text-gray-400">
                    <p>🤔 No valid solutions found.</p>
                    <p className="text-xs mt-2">
                      Check your feedback - there might be an error.
                    </p>
                    <button
                      onClick={() => {
                        setGameStep("waiting_for_result");
                      }}
                      className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 rounded text-sm touch-manipulation min-h-[44px]"
                      aria-label="Go back to fix feedback"
                    >
                      Fix Feedback
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Start for Helper Mode */}
            {gameMode === "helper" && gameState.guesses.length === 0 && (
              <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
                <h3 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
                  <Shuffle className="text-green-400" size={20} />
                  Quick Start
                </h3>

                <p className="text-gray-300 mb-4 text-sm">
                  Start with an optimal first move for slot-by-slot games:
                </p>

                <div className="space-y-2">
                  {getOptimalFirstGuesses()
                    .slice(0, 3)
                    .map((guess, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentGuess([...guess]);
                          setGameStep("waiting_for_result");
                        }}
                        className="w-full p-3 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded-lg transition-all flex items-center justify-between touch-manipulation min-h-[48px]"
                        aria-label={`Use optimal guess ${
                          index + 1
                        }: ${guess.join(" ")}`}
                      >
                        <div className="flex gap-1">
                          {guess.map((digit, digitIndex) => (
                            <div
                              key={digitIndex}
                              className="w-5 h-5 sm:w-6 sm:h-6 bg-slate-500 rounded text-center text-xs sm:text-sm font-bold leading-5 sm:leading-6"
                            >
                              {digit}
                            </div>
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">
                          {index === 0
                            ? "Most Popular"
                            : `Alternative ${index + 1}`}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Game Statistics */}
            <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
              <h3 className="text-lg sm:text-xl font-bold mb-4">Game Stats</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-400">
                    {gameMode === "helper"
                      ? gameState.guesses.length
                      : practiceResult
                      ? 1
                      : 0}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">
                    Attempts
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-purple-400">
                    {gameMode === "helper"
                      ? gameState.possibleSolutions.length
                      : "????"}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">
                    Possible Codes
                  </div>
                </div>
              </div>

              {gameMode === "helper" &&
                gameState.possibleSolutions.length <= 10 &&
                gameState.possibleSolutions.length > 1 && (
                  <div className="mt-4">
                    <p className="text-green-400 font-medium mb-2 text-sm">
                      🎯 Almost there! Remaining possibilities:
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {gameState.possibleSolutions.map((solution, index) => (
                        <div key={index} className="flex gap-1 justify-center">
                          {solution.map((digit, digitIndex) => (
                            <div
                              key={digitIndex}
                              className="w-4 h-4 sm:w-5 sm:h-5 bg-green-600 rounded text-center text-xs font-bold leading-4 sm:leading-5"
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

            {/* Move History */}
            {gameMode === "helper" && gameState.guesses.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
                <h3 className="text-lg sm:text-xl font-bold mb-4">
                  Move History
                </h3>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {gameState.guesses.map((guess, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 sm:gap-3 p-2 bg-slate-700 rounded"
                    >
                      <span className="text-xs text-gray-400 w-4">
                        #{index + 1}
                      </span>
                      <div className="flex gap-1">
                        {guess.map((digit, digitIndex) => (
                          <div
                            key={digitIndex}
                            className="w-5 h-5 sm:w-6 sm:h-6 bg-slate-600 rounded text-center text-xs font-bold leading-5 sm:leading-6"
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1 ml-auto">
                        <span className="text-xs">
                          🟢{gameState.feedbacks[index].correct}
                        </span>
                        <span className="text-xs">
                          🟡{gameState.feedbacks[index].partial}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <footer className="mt-6 sm:mt-8 bg-slate-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
          <h3 className="text-lg sm:text-xl font-bold mb-4">🎰 How to Play</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">
                🎯 Game Helper Mode
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                <li>Use arrow buttons or tap numbers to set your guess</li>
                <li>Try the code on your actual game</li>
                <li>Come back and tap the color results for each slot</li>
                <li>Get analysis and next move suggestions</li>
                <li>Repeat until you crack the code!</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-purple-400 mb-2">
                🎮 Practice Mode
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                <li>Practice against a randomly generated secret code</li>
                <li>Use up/down arrows to adjust each digit</li>
                <li>Build your intuition for the real game</li>
                <li>Toggle secret visibility to check your progress</li>
                <li>Reset anytime for a new challenge</li>
              </ol>
            </div>
          </div>
          <div className="mt-4 p-3 sm:p-4 bg-slate-700 rounded-lg">
            <h4 className="font-medium mb-2">🎨 Color Code</h4>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm">
              <span className="flex items-center gap-2">
                🟢 <strong>Correct:</strong> Right digit, right position
              </span>
              <span className="flex items-center gap-2">
                🟡 <strong>Partial:</strong> Right digit, wrong position
              </span>
              <span className="flex items-center gap-2">
                🔴 <strong>Wrong:</strong> Digit not in code
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
