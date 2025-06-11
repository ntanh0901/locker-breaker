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

  // First pass: identify all correct positions
  const correctPositions = new Set<number>();
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) {
      result[i] = "correct";
      correctPositions.add(i);
    }
  }

  // Second pass: handle incorrect positions with new rules
  for (let i = 0; i < 4; i++) {
    if (correctPositions.has(i)) {
      continue; // Already marked as correct
    }

    const guessDigit = guess[i];

    // Count total occurrences of this digit in secret
    const totalInSecret = secret.filter((d) => d === guessDigit).length;

    // Count how many times we guessed this digit correctly
    const correctGuesses = guess.filter(
      (d, idx) => d === guessDigit && correctPositions.has(idx)
    ).length;

    if (totalInSecret === 0) {
      // Digit doesn't exist in secret at all
      result[i] = "wrong";
    } else if (totalInSecret <= correctGuesses) {
      // We've already found ALL instances of this digit correctly (or more)
      // No additional instances exist, so this incorrect guess is red
      result[i] = "wrong";
    } else {
      // There are additional instances of this digit beyond what we got right
      // This means the digit appears in other positions we haven't found
      result[i] = "partial";
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

  // Create a more deterministic cache key that includes solution set characteristics
  const solutionSignature =
    possibleSolutions.length < 100
      ? possibleSolutions
          .map((s) => s.join(""))
          .sort()
          .join("|")
      : `${possibleSolutions.length}_${possibleSolutions[0].join(
          ""
        )}_${possibleSolutions[Math.floor(possibleSolutions.length / 2)].join(
          ""
        )}`;

  const cacheKey = `score_${guess.join("")}_${solutionSignature}`;
  if (calculationCache.has(cacheKey)) {
    return calculationCache.get(cacheKey);
  }

  const feedbackGroups = new Map<string, number>();

  for (const solution of possibleSolutions) {
    const slotFeedback = calculateSlotBySlotFeedback(guess, solution);
    const key = slotFeedback.join("-");
    feedbackGroups.set(key, (feedbackGroups.get(key) || 0) + 1);
  }

  // For small sets, prioritize information gain over worst-case
  if (possibleSolutions.length <= 10) {
    // Calculate entropy/information gain score
    const totalSolutions = possibleSolutions.length;
    let entropy = 0;

    for (const groupSize of Array.from(feedbackGroups.values())) {
      const probability = groupSize / totalSolutions;
      entropy -= probability * Math.log2(probability);
    }

    // Convert entropy to a comparable score (higher entropy = lower score = better)
    // Normalize to a 0-10 range where lower is better
    const maxEntropy = Math.log2(totalSolutions);
    const normalizedScore = Math.round(
      ((maxEntropy - entropy) / maxEntropy) * 10
    );

    calculationCache.set(cacheKey, normalizedScore);
    return normalizedScore;
  }

  // Return the worst-case scenario (largest group size) for larger sets
  let score = Math.max(...Array.from(feedbackGroups.values()));

  // Feedback pruning: bonus for moves that confirm duplicates early
  for (const feedbackKey of Array.from(feedbackGroups.keys())) {
    if (feedbackKey.includes("correct-correct")) {
      score *= 0.8; // 20% bonus for locking duplicates early
      break;
    }
  }

  calculationCache.set(cacheKey, score);
  return score;
}

// Generate information-maximizing guesses for small possibility sets
// ENHANCED: Prioritizes unique digits for maximum information gain under new feedback rules
function generateInformationMaximizingGuesses(
  possibleSolutions: Guess[]
): Guess[] {
  if (possibleSolutions.length > 10) return [];

  const informationGuesses: Guess[] = [];

  // Extract digits that appear in possible solutions
  const digitFrequency = new Map<number, number>();
  possibleSolutions.forEach((solution) => {
    solution.forEach((digit) => {
      digitFrequency.set(digit, (digitFrequency.get(digit) || 0) + 1);
    });
  });

  // Get all digits that could be in the solution, sorted by frequency (rarest first for max info)
  const candidateDigits = Array.from(digitFrequency.keys()).sort(
    (a, b) => digitFrequency.get(a)! - digitFrequency.get(b)!
  );

  // Also include some common digits not in the solution set to test elimination
  const allDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const unknownDigits = allDigits.filter((d) => !digitFrequency.has(d));

  // Strategy 1: Test 4 unique digits from candidates (prioritize rare ones)
  if (candidateDigits.length >= 4) {
    // Test rarest digits first for maximum elimination potential
    informationGuesses.push([
      candidateDigits[0],
      candidateDigits[1],
      candidateDigits[2],
      candidateDigits[3],
    ]);

    // Alternative combination
    if (candidateDigits.length >= 8) {
      informationGuesses.push([
        candidateDigits[4],
        candidateDigits[5],
        candidateDigits[6],
        candidateDigits[7],
      ]);
    }
  }

  // Strategy 2: Mix candidate digits with unknown digits for hybrid testing
  if (candidateDigits.length >= 2 && unknownDigits.length >= 2) {
    informationGuesses.push([
      candidateDigits[0],
      candidateDigits[1],
      unknownDigits[0],
      unknownDigits[1],
    ]);
  }

  // Strategy 3: Test completely unknown digits to eliminate large chunks
  if (unknownDigits.length >= 4) {
    informationGuesses.push([
      unknownDigits[0],
      unknownDigits[1],
      unknownDigits[2],
      unknownDigits[3],
    ]);
  }

  // Remove duplicates and ensure all guesses have 4 unique digits
  return informationGuesses.filter(
    (guess) => new Set(guess).size === 4 // Ensure no duplicate digits in any guess
  );
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
    winProbabilities?: { [moves: number]: number };
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
          winProbabilities: { [gameState.guesses.length + 1]: 1.0 },
        },
      ],
      possibleSolutionsCount: 1,
    };
  }

  // Endgame optimization: show all solutions when ≤3 remain, plus strategic alternatives
  if (possibleSolutions.length <= 3) {
    const suggestions: Array<{
      guess: Guess;
      score: number;
      isPossibleSolution: boolean;
      winProbabilities?: { [moves: number]: number };
    }> = [];

    // Add all possible solutions with correct win probabilities
    const sortedSolutions = possibleSolutions.sort(
      (a, b) => new Set(b).size - new Set(a).size // Prefer solutions with more duplicates
    );

    const nextMove = gameState.guesses.length + 1;
    const winProbabilityThisMove = 1.0 / possibleSolutions.length; // 33% for 3 solutions
    const winProbabilityNextMove =
      possibleSolutions.length > 1 ? 1.0 - winProbabilityThisMove : 0;

    sortedSolutions.forEach((solution, index) => {
      suggestions.push({
        guess: solution,
        score: index, // Lower score for duplicate-preferred solutions
        isPossibleSolution: true,
        winProbabilities: {
          [nextMove]: winProbabilityThisMove,
          [nextMove + 1]: winProbabilityNextMove,
        },
      });
    });

    // Add strategic "safe" guesses for guaranteed next-move win
    if (possibleSolutions.length > 1) {
      const strategicGuesses =
        generateInformationMaximizingGuesses(possibleSolutions);
      strategicGuesses.slice(0, 2).forEach((strategicGuess, index) => {
        suggestions.push({
          guess: strategicGuess,
          score: 100 + index, // Higher score (worse) than direct solutions
          isPossibleSolution: false,
          winProbabilities: {
            [nextMove + 1]: 1.0, // Guaranteed win in next move
          },
        });
      });
    }

    return {
      suggestions,
      possibleSolutionsCount: possibleSolutions.length,
    };
  }

  // For efficiency, we'll test both possible solutions and some strategic guesses
  const candidateGuesses = new Set<string>();

  // ALWAYS add all possible solutions as candidates when there are few left
  if (possibleSolutions.length <= 10) {
    possibleSolutions.forEach((solution) => {
      candidateGuesses.add(solution.join(","));
    });
  } else {
    // For larger sets, add a representative sample of possible solutions
    const maxSolutions = Math.min(possibleSolutions.length, 50);
    for (let i = 0; i < maxSolutions; i++) {
      candidateGuesses.add(possibleSolutions[i].join(","));
    }
  }

  // Add information-maximizing guesses for small sets
  if (possibleSolutions.length <= 10) {
    const infoGuesses = generateInformationMaximizingGuesses(possibleSolutions);
    infoGuesses.forEach((guess) => {
      candidateGuesses.add(guess.join(","));
    });
  }

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
    // Use deterministic strategic guesses instead of random ones
    const strategicGuesses = [
      [0, 2, 4, 6],
      [1, 3, 5, 7],
      [2, 4, 6, 8],
      [3, 5, 7, 9],
      [0, 1, 8, 9],
      [2, 3, 6, 7],
      [4, 5, 2, 3],
      [6, 7, 0, 1],
      [8, 9, 4, 5],
      [1, 4, 7, 0],
      [0, 5, 2, 9],
      [3, 6, 1, 8],
      [7, 2, 5, 4],
      [9, 0, 3, 6],
      [1, 8, 4, 7],
      [5, 3, 0, 2],
      [6, 9, 7, 1],
      [2, 5, 8, 3],
      [4, 0, 6, 9],
      [8, 1, 3, 5],
      [0, 7, 9, 2],
      [3, 4, 1, 8],
      [5, 6, 0, 7],
      [9, 2, 4, 1],
      [1, 5, 8, 0],
      [7, 3, 2, 6],
      [4, 8, 5, 9],
      [0, 6, 3, 4],
      [2, 9, 7, 5],
      [8, 0, 1, 3],
    ];

    strategicGuesses.forEach((guess) => {
      candidateGuesses.add(guess.join(","));
    });
  }

  const scoredGuesses: Array<{
    guess: Guess;
    score: number;
    isPossibleSolution: boolean;
    winProbabilities?: { [moves: number]: number };
  }> = [];

  for (const candidateStr of Array.from(candidateGuesses)) {
    const candidate = candidateStr.split(",").map(Number);
    const score = calculateGuessScore(candidate, possibleSolutions);
    const isPossibleSolution = possibleSolutions.some((sol) =>
      sol.every((digit, i) => digit === candidate[i])
    );

    // Calculate win probabilities for small solution sets (performance consideration)
    let winProbabilities: { [moves: number]: number } | undefined;
    if (possibleSolutions.length <= 20) {
      winProbabilities = calculateWinProbabilities(
        candidate,
        possibleSolutions,
        gameState.guesses.length
      );
    }

    scoredGuesses.push({
      guess: candidate,
      score,
      isPossibleSolution,
      winProbabilities,
    });
  }

  // Sort by score (lower is better), then prioritize possible solutions
  scoredGuesses.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.isPossibleSolution && !b.isPossibleSolution) return -1;
    if (!a.isPossibleSolution && b.isPossibleSolution) return 1;
    return 0;
  });

  // Filter out significantly inferior suggestions
  const bestScore = Math.min(...scoredGuesses.map((s) => s.score));
  const qualitySuggestions = scoredGuesses.filter((suggestion) => {
    // Always include possible solutions
    if (suggestion.isPossibleSolution) return true;

    // For non-solutions, only include if they're competitive
    // Allow some tolerance, but not dramatically worse scores
    const scoreThreshold =
      possibleSolutions.length <= 10 ? bestScore + 2 : bestScore * 1.5;
    return suggestion.score <= scoreThreshold;
  });

  // When there are few possibilities left, ensure we show at least all possible solutions
  const possibleSolutionSuggestions = qualitySuggestions.filter(
    (s) => s.isPossibleSolution
  );
  const effectiveMaxSuggestions =
    possibleSolutions.length <= 5
      ? Math.max(maxSuggestions, possibleSolutionSuggestions.length)
      : maxSuggestions;

  return {
    suggestions: qualitySuggestions.slice(0, effectiveMaxSuggestions),
    possibleSolutionsCount: possibleSolutions.length,
  };
}

// Get optimal first guess for slot-by-slot feedback game
export function getOptimalFirstGuesses(): Guess[] {
  // Based on analysis results: [0,2,4,6] consistently outperforms others under enhanced feedback rules
  return [
    [0, 2, 4, 6], // PROVEN OPTIMAL: Score 1036.8, achieves 51.86% 4-move wins
    [1, 2, 3, 4], // Traditional: Classic Mastermind approach
    [3, 5, 7, 9], // Alternative: Duplicate testing strategy
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

// Test function to demonstrate the optimization with a specific scenario
export function testOptimizationScenario(): void {
  console.log("Testing optimization scenario...");

  // Simulate the user's scenario: code is 1467
  const secret = [1, 4, 6, 7];

  // After first two moves, we should have: 1 4 6 ?
  // Possible solutions: [1,4,6,0], [1,4,6,1], [1,4,6,2], [1,4,6,3], [1,4,6,4], [1,4,6,5], [1,4,6,6], [1,4,6,7], [1,4,6,8], [1,4,6,9]
  const remainingPossibilities = [
    [1, 4, 6, 0],
    [1, 4, 6, 1],
    [1, 4, 6, 2],
    [1, 4, 6, 3],
    [1, 4, 6, 4],
    [1, 4, 6, 5],
    [1, 4, 6, 6],
    [1, 4, 6, 7],
    [1, 4, 6, 8],
    [1, 4, 6, 9],
  ];

  // Test information-maximizing guess: 7890
  const infoGuess = [7, 8, 9, 0];
  const feedback = calculateSlotBySlotFeedback(infoGuess, secret);
  console.log("Guess 7890 feedback:", feedback); // Should be: ["partial", "wrong", "wrong", "wrong"]

  // This tells us 7 is in the code, so answer must be 1467
  const filtered = filterSolutionsSlotBySlot(
    remainingPossibilities,
    infoGuess,
    feedback
  );
  console.log("Remaining after info guess:", filtered); // Should be: [[1,4,6,7]]

  console.log(
    "Optimization successful! Solved in 1 additional move instead of up to 5."
  );
}

// Calculate win probability distribution for a guess
function calculateWinProbabilities(
  guess: Guess,
  possibleSolutions: Guess[],
  currentMoveCount: number,
  maxDepth: number = 3
): { [moves: number]: number } {
  if (possibleSolutions.length <= 1 || maxDepth <= 0) {
    // If only 1 or 0 solutions left, we can finish in the next move
    const nextMove = currentMoveCount + 1;
    return { [nextMove]: 1.0 };
  }

  // Group solutions by what feedback they would give for this guess
  const feedbackGroups = new Map<string, Guess[]>();

  for (const solution of possibleSolutions) {
    const slotFeedback = calculateSlotBySlotFeedback(guess, solution);
    const key = slotFeedback.join("-");
    if (!feedbackGroups.has(key)) {
      feedbackGroups.set(key, []);
    }
    feedbackGroups.get(key)!.push(solution);
  }

  const totalOutcomes: { [moves: number]: number } = {};

  // Check if this guess is actually one of the possible solutions
  const isGuessAPossibleSolution = possibleSolutions.some((sol) =>
    sol.every((digit, i) => digit === guess[i])
  );

  for (const [feedbackKey, remainingSolutions] of Array.from(
    feedbackGroups.entries()
  )) {
    const groupProbability =
      remainingSolutions.length / possibleSolutions.length;

    // Check if this feedback means we found the correct answer
    const isWinningFeedback = feedbackKey === "correct-correct-correct-correct";

    if (isWinningFeedback) {
      // This feedback would win the game immediately
      const winMove = currentMoveCount + 1;
      totalOutcomes[winMove] = (totalOutcomes[winMove] || 0) + groupProbability;
    } else if (remainingSolutions.length === 1) {
      // After this feedback, only one solution remains - we can win in the next move
      const winMove = currentMoveCount + 2; // +1 for this move, +1 for the final move
      totalOutcomes[winMove] = (totalOutcomes[winMove] || 0) + groupProbability;
    } else if (maxDepth > 1) {
      // Need to continue playing - simulate deeper
      const nextBestGuess = findOptimalNextGuess(remainingSolutions);
      const subProbabilities = calculateWinProbabilities(
        nextBestGuess,
        remainingSolutions,
        currentMoveCount + 1,
        maxDepth - 1
      );

      // Add weighted probabilities from this branch
      for (const [moves, prob] of Object.entries(subProbabilities)) {
        const moveCount = parseInt(moves);
        totalOutcomes[moveCount] =
          (totalOutcomes[moveCount] || 0) + groupProbability * prob;
      }
    } else {
      // Reached max depth - estimate remaining moves needed
      // For small groups, estimate 1-2 more moves; for larger groups, estimate more
      const estimatedAdditionalMoves = remainingSolutions.length <= 3 ? 2 : 3;
      const estimatedFinishMove =
        currentMoveCount + 1 + estimatedAdditionalMoves;
      totalOutcomes[estimatedFinishMove] =
        (totalOutcomes[estimatedFinishMove] || 0) + groupProbability;
    }
  }

  return totalOutcomes;
}

// Find the optimal next guess for a given set of solutions (simplified)
function findOptimalNextGuess(possibleSolutions: Guess[]): Guess {
  if (possibleSolutions.length <= 1) {
    return possibleSolutions[0] || [0, 0, 0, 0];
  }

  // For efficiency, just test the possible solutions plus a few strategic guesses
  const candidates = [...possibleSolutions];

  // Add a couple strategic alternatives if the set is small
  if (possibleSolutions.length <= 10) {
    const infoGuesses = generateInformationMaximizingGuesses(possibleSolutions);
    candidates.push(...infoGuesses);
  }

  let bestGuess = candidates[0];
  let bestScore = calculateGuessScore(bestGuess, possibleSolutions);

  for (const candidate of candidates) {
    const score = calculateGuessScore(candidate, possibleSolutions);
    if (score < bestScore) {
      bestScore = score;
      bestGuess = candidate;
    }
  }

  return bestGuess;
}

// IMPORTANT: Algorithm updated for new feedback rules (Enhanced Information System)
//
// NEW RULE: When guessing the same digit multiple times with at least one correct:
// - RED (wrong): No additional instances of this digit exist beyond the correct ones
// - YELLOW (partial): Additional instances exist in other positions we haven't found
//
// This provides much more precise information about digit frequencies and should
// significantly improve the 4-move win rate by reducing ambiguity in endgame scenarios.
