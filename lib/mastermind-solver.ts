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

// Generate all possible 4-digit combinations (0000 to 9999)
export function generateAllCombinations(): Guess[] {
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
  return combinations;
}

// Calculate feedback for a guess against a secret
export function calculateFeedback(guess: Guess, secret: Guess): Feedback {
  let correct = 0;
  let partial = 0;

  const guessUsed = new Array(4).fill(false);
  const secretUsed = new Array(4).fill(false);

  // First pass: count correct positions
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) {
      correct++;
      guessUsed[i] = true;
      secretUsed[i] = true;
    }
  }

  // Second pass: count partial matches
  for (let i = 0; i < 4; i++) {
    if (!guessUsed[i]) {
      for (let j = 0; j < 4; j++) {
        if (!secretUsed[j] && guess[i] === secret[j]) {
          partial++;
          secretUsed[j] = true;
          break;
        }
      }
    }
  }

  return { correct, partial };
}

// Filter possible solutions based on guess and feedback
export function filterPossibleSolutions(
  possibleSolutions: Guess[],
  guess: Guess,
  feedback: Feedback
): Guess[] {
  return possibleSolutions.filter((solution) => {
    const actualFeedback = calculateFeedback(guess, solution);
    return (
      actualFeedback.correct === feedback.correct &&
      actualFeedback.partial === feedback.partial
    );
  });
}

// Calculate the score for a potential guess using minimax strategy
function calculateGuessScore(guess: Guess, possibleSolutions: Guess[]): number {
  if (possibleSolutions.length <= 1) return 0;

  const feedbackGroups = new Map<string, number>();

  for (const solution of possibleSolutions) {
    const feedback = calculateFeedback(guess, solution);
    const key = `${feedback.correct}-${feedback.partial}`;
    feedbackGroups.set(key, (feedbackGroups.get(key) || 0) + 1);
  }

  // Return the worst-case scenario (largest group size)
  return Math.max(...Array.from(feedbackGroups.values()));
}

// Get the best next guess using minimax strategy
export function getBestNextGuess(gameState: GameState): {
  bestGuess: Guess;
  worstCaseRemaining: number;
  alternativeGuesses: Guess[];
} {
  const { possibleSolutions } = gameState;

  if (possibleSolutions.length === 0) {
    return {
      bestGuess: [0, 0, 0, 0],
      worstCaseRemaining: 0,
      alternativeGuesses: [],
    };
  }

  if (possibleSolutions.length === 1) {
    return {
      bestGuess: possibleSolutions[0],
      worstCaseRemaining: 0,
      alternativeGuesses: [],
    };
  }

  // For efficiency, we'll test both possible solutions and some strategic guesses
  const candidateGuesses = new Set<string>();

  // Add all possible solutions as candidates
  possibleSolutions.forEach((solution) => {
    candidateGuesses.add(solution.join(","));
  });

  // Add some strategic first moves if this is the first guess
  if (gameState.guesses.length === 0) {
    [
      [1, 1, 2, 2],
      [0, 0, 1, 1],
      [1, 2, 3, 4],
      [0, 1, 2, 3],
    ].forEach((guess) => {
      candidateGuesses.add(guess.join(","));
    });
  }

  // If we have many possibilities, add some additional strategic guesses
  if (possibleSolutions.length > 50) {
    for (let i = 0; i < 20; i++) {
      const randomGuess = Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 10)
      );
      candidateGuesses.add(randomGuess.join(","));
    }
  }

  let bestScore = Infinity;
  let bestGuesses: Guess[] = [];

  for (const candidateStr of Array.from(candidateGuesses)) {
    const candidate = candidateStr.split(",").map(Number);
    const score = calculateGuessScore(candidate, possibleSolutions);

    if (score < bestScore) {
      bestScore = score;
      bestGuesses = [candidate];
    } else if (score === bestScore) {
      bestGuesses.push(candidate);
    }
  }

  // Prefer guesses that are possible solutions
  const bestPossibleSolution = bestGuesses.find((guess) =>
    possibleSolutions.some((sol) => sol.every((digit, i) => digit === guess[i]))
  );

  const bestGuess = bestPossibleSolution || bestGuesses[0];
  const alternatives = bestGuesses
    .slice(0, 5)
    .filter((guess) => !guess.every((digit, i) => digit === bestGuess[i]));

  return {
    bestGuess,
    worstCaseRemaining: bestScore,
    alternativeGuesses: alternatives,
  };
}

// Get optimal first guess for the game
export function getOptimalFirstGuess(): Guess {
  // These are proven optimal first guesses for 4-peg, 10-color Mastermind
  const optimalStarters = [
    [1, 1, 2, 2],
    [0, 0, 1, 1],
    [1, 2, 3, 4],
  ];
  return optimalStarters[0];
}

// Initialize a new game state
export function initializeGameState(): GameState {
  return {
    guesses: [],
    feedbacks: [],
    possibleSolutions: generateAllCombinations(),
  };
}

// Add a guess and feedback to the game state
export function addGuessToGameState(
  gameState: GameState,
  guess: Guess,
  feedback: Feedback
): GameState {
  const newPossibleSolutions = filterPossibleSolutions(
    gameState.possibleSolutions,
    guess,
    feedback
  );

  return {
    guesses: [...gameState.guesses, guess],
    feedbacks: [...gameState.feedbacks, feedback],
    possibleSolutions: newPossibleSolutions,
  };
}
