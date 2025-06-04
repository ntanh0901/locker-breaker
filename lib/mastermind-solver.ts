export type Guess = number[];
export type Feedback = {
  correct: number; // Green pegs - right digit, right position
  partial: number; // Yellow pegs - right digit, wrong position
};

export type GameState = {
  guesses: Guess[];
  feedbacks: Feedback[];
  possibleSolutions: Guess[];
};

export type SlotFeedback = ("correct" | "partial" | "wrong")[];

// Cache for expensive calculations
const calculationCache = new Map<string, any>();

// Generate all possible 4-digit combinations (0000 to 9999)
export function generateAllCombinations(): Guess[] {
  const cacheKey = "all_combinations";
  if (calculationCache.has(cacheKey)) {
    return calculationCache.get(cacheKey);
  }

  const combinations: Guess[] = [];
  for (let i = 0; i < 10000; i++) {
    const digits = [
      Math.floor(i / 1000) % 10,
      Math.floor(i / 100) % 10,
      Math.floor(i / 10) % 10,
      i % 10,
    ];
    combinations.push(digits);
  }

  calculationCache.set(cacheKey, combinations);
  return combinations;
}

// Calculate slot-by-slot feedback for the game variant we use
export function calculateSlotBySlotFeedback(
  guess: Guess,
  secret: Guess
): SlotFeedback {
  const result: SlotFeedback = [];

  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) {
      // Exact position match
      result[i] = "correct";
    } else if (secret.includes(guess[i])) {
      // Digit appears somewhere in secret
      result[i] = "partial";
    } else {
      // Digit doesn't appear in secret at all
      result[i] = "wrong";
    }
  }

  return result;
}

// Convert slot feedback to standard feedback for statistics
export function convertSlotFeedback(slotFeedback: SlotFeedback): Feedback {
  const correct = slotFeedback.filter((f) => f === "correct").length;
  const partial = slotFeedback.filter((f) => f === "partial").length;
  return { correct, partial };
}

// Filter solutions using slot-by-slot feedback system
export function filterSolutionsSlotBySlot(
  possibleSolutions: Guess[],
  guess: Guess,
  slotFeedback: SlotFeedback
): Guess[] {
  return possibleSolutions.filter((solution) => {
    const actualFeedback = calculateSlotBySlotFeedback(guess, solution);
    return actualFeedback.every((feedback, i) => feedback === slotFeedback[i]);
  });
}

// Calculate the score for a potential guess using minimax strategy
function calculateGuessScore(guess: Guess, possibleSolutions: Guess[]): number {
  if (possibleSolutions.length <= 1) return 0;

  const cacheKey = `score_${guess.join("")}_${possibleSolutions.length}`;
  if (calculationCache.has(cacheKey)) {
    return calculationCache.get(cacheKey);
  }

  const feedbackGroups = new Map<string, number>();

  for (const solution of possibleSolutions) {
    const slotFeedback = calculateSlotBySlotFeedback(guess, solution);
    const key = slotFeedback.join("-");
    feedbackGroups.set(key, (feedbackGroups.get(key) || 0) + 1);
  }

  // Return the worst-case scenario (largest group size)
  const score = Math.max(...Array.from(feedbackGroups.values()));
  calculationCache.set(cacheKey, score);
  return score;
}

// Get multiple best next guesses using minimax strategy
export function getBestNextGuesses(
  gameState: GameState,
  maxSuggestions: number = 5
): {
  suggestions: Array<{
    guess: Guess;
    score: number;
    isPossibleSolution: boolean;
  }>;
  possibleSolutionsCount: number;
} {
  const { possibleSolutions } = gameState;

  if (possibleSolutions.length === 0) {
    return {
      suggestions: [],
      possibleSolutionsCount: 0,
    };
  }

  if (possibleSolutions.length === 1) {
    return {
      suggestions: [
        {
          guess: possibleSolutions[0],
          score: 0,
          isPossibleSolution: true,
        },
      ],
      possibleSolutionsCount: 1,
    };
  }

  // For efficiency, we'll test both possible solutions and some strategic guesses
  const candidateGuesses = new Set<string>();

  // Add all possible solutions as candidates (prioritize these)
  possibleSolutions.forEach((solution) => {
    candidateGuesses.add(solution.join(","));
  });

  // Add some strategic first moves if this is the first guess
  if (gameState.guesses.length === 0) {
    [
      [1, 2, 3, 4],
      [0, 1, 2, 3],
      [5, 6, 7, 8],
      [0, 2, 4, 6],
      [1, 3, 5, 7],
      [2, 4, 6, 8],
    ].forEach((guess) => {
      candidateGuesses.add(guess.join(","));
    });
  }

  // If we have many possibilities, add some additional strategic guesses
  if (possibleSolutions.length > 100) {
    for (let i = 0; i < 30; i++) {
      const randomGuess = Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 10)
      );
      candidateGuesses.add(randomGuess.join(","));
    }
  }

  const scoredGuesses: Array<{
    guess: Guess;
    score: number;
    isPossibleSolution: boolean;
  }> = [];

  for (const candidateStr of Array.from(candidateGuesses)) {
    const candidate = candidateStr.split(",").map(Number);
    const score = calculateGuessScore(candidate, possibleSolutions);
    const isPossibleSolution = possibleSolutions.some((sol) =>
      sol.every((digit, i) => digit === candidate[i])
    );

    scoredGuesses.push({
      guess: candidate,
      score,
      isPossibleSolution,
    });
  }

  // Sort by score (lower is better), then prioritize possible solutions
  scoredGuesses.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.isPossibleSolution && !b.isPossibleSolution) return -1;
    if (!a.isPossibleSolution && b.isPossibleSolution) return 1;
    return 0;
  });

  return {
    suggestions: scoredGuesses.slice(0, maxSuggestions),
    possibleSolutionsCount: possibleSolutions.length,
  };
}

// Get optimal first guess for slot-by-slot feedback game
export function getOptimalFirstGuesses(): Guess[] {
  // These are optimized for slot-by-slot feedback (4 unique digits provide most information)
  return [
    [1, 2, 3, 4], // Best: tests 4 different digits
    [0, 1, 2, 3], // Alternative: covers low digits
    [5, 6, 7, 8], // Alternative: covers high digits
    [0, 2, 4, 6], // Alternative: even digits
    [1, 3, 5, 7], // Alternative: odd digits
  ];
}

// Initialize a new game state
export function initializeGameState(): GameState {
  return {
    guesses: [],
    feedbacks: [],
    possibleSolutions: generateAllCombinations(),
  };
}

// Add a guess and feedback to the game state (optimized for slot-by-slot)
export function addGuessToGameState(
  gameState: GameState,
  guess: Guess,
  slotFeedback: SlotFeedback
): GameState {
  const newPossibleSolutions = filterSolutionsSlotBySlot(
    gameState.possibleSolutions,
    guess,
    slotFeedback
  );

  return {
    guesses: [...gameState.guesses, guess],
    feedbacks: [...gameState.feedbacks, convertSlotFeedback(slotFeedback)],
    possibleSolutions: newPossibleSolutions,
  };
}

// Generate a random secret code for practice mode
export function generateRandomSecret(): Guess {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10));
}
