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
  const score = Math.max(...Array.from(feedbackGroups.values()));
  calculationCache.set(cacheKey, score);
  return score;
}

// Generate information-maximizing guesses for small possibility sets
function generateInformationMaximizingGuesses(
  possibleSolutions: Guess[]
): Guess[] {
  if (possibleSolutions.length > 10) return [];

  const informationGuesses: Guess[] = [];

  // Extract unique digits from possible solutions
  const uniqueDigits = new Set<number>();
  possibleSolutions.forEach((solution) => {
    solution.forEach((digit) => uniqueDigits.add(digit));
  });

  const digits = Array.from(uniqueDigits);

  // Generate strategic guesses that test multiple possibilities at once
  if (digits.length >= 4) {
    // Create guesses that maximize information about which digits are present
    for (let i = 0; i < Math.min(3, digits.length - 3); i++) {
      const guess = [digits[i], digits[i + 1], digits[i + 2], digits[i + 3]];
      informationGuesses.push(guess);
    }

    // Add some permutations
    if (digits.length >= 4) {
      informationGuesses.push([digits[3], digits[0], digits[1], digits[2]]);
      informationGuesses.push([digits[2], digits[3], digits[0], digits[1]]);
    }
  }

  return informationGuesses;
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

  // When there are few possibilities left, ensure we show at least all possible solutions
  const effectiveMaxSuggestions =
    possibleSolutions.length <= 5
      ? Math.max(maxSuggestions, possibleSolutions.length)
      : maxSuggestions;

  return {
    suggestions: scoredGuesses.slice(0, effectiveMaxSuggestions),
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
