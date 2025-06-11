// Algorithm Analysis Script - Enhanced Feedback Rules Version
// Tests the Mastermind solver against all possible 4-digit codes (0000-9999)
//
// UPDATED: Now uses enhanced feedback rules for better information precision:
// - RED (wrong): No additional instances of digit exist beyond correct ones
// - YELLOW (partial): Additional instances exist in other positions

const fs = require("fs");

// Global cache for performance
const scoreCache = new Map();
const combinationsCache = new Map();

// Types and core functions
function generateAllCombinations() {
  if (combinationsCache.has("all")) {
    return combinationsCache.get("all");
  }

  const combinations = [];
  for (let i = 0; i < 10000; i++) {
    const digits = [
      Math.floor(i / 1000) % 10,
      Math.floor(i / 100) % 10,
      Math.floor(i / 10) % 10,
      i % 10,
    ];
    combinations.push(digits);
  }

  combinationsCache.set("all", combinations);
  return combinations;
}

function calculateSlotBySlotFeedback(guess, secret) {
  const result = [];
  const correctPositions = new Set();

  // First pass: identify all correct positions
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) {
      result[i] = "correct";
      correctPositions.add(i);
    }
  }

  // Second pass: handle incorrect positions with new enhanced rules
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

function filterSolutionsSlotBySlot(possibleSolutions, guess, slotFeedback) {
  return possibleSolutions.filter((solution) => {
    const actualFeedback = calculateSlotBySlotFeedback(guess, solution);
    return actualFeedback.every((feedback, i) => feedback === slotFeedback[i]);
  });
}

function calculateGuessScore(guess, possibleSolutions) {
  if (possibleSolutions.length <= 1) return 0;

  // Create cache key
  const cacheKey = `${guess.join("")}-${
    possibleSolutions.length
  }-${possibleSolutions[0].join("")}`;
  if (scoreCache.has(cacheKey)) {
    return scoreCache.get(cacheKey);
  }

  const feedbackGroups = new Map();

  for (const solution of possibleSolutions) {
    const slotFeedback = calculateSlotBySlotFeedback(guess, solution);
    const key = slotFeedback.join("-");
    feedbackGroups.set(key, (feedbackGroups.get(key) || 0) + 1);
  }

  let score;

  // For small sets, prioritize information gain over worst-case
  if (possibleSolutions.length <= 10) {
    const totalSolutions = possibleSolutions.length;
    let entropy = 0;

    for (const groupSize of Array.from(feedbackGroups.values())) {
      const probability = groupSize / totalSolutions;
      entropy -= probability * Math.log2(probability);
    }

    // Convert entropy to a comparable score (higher entropy = lower score = better)
    const maxEntropy = Math.log2(totalSolutions);
    score = Math.round(((maxEntropy - entropy) / maxEntropy) * 10);
  } else {
    // Return the worst-case scenario (largest group size) for larger sets
    score = Math.max(...Array.from(feedbackGroups.values()));

    // Feedback pruning: bonus for moves that confirm duplicates early
    for (const feedbackKey of Array.from(feedbackGroups.keys())) {
      if (feedbackKey.includes("correct-correct")) {
        score *= 0.8; // 20% bonus for locking duplicates early
        break;
      }
    }
  }

  scoreCache.set(cacheKey, score);
  return score;
}

function getBestNextGuess(possibleSolutions, guessCount, debug = false) {
  if (debug)
    console.log(
      `  Getting best guess for ${possibleSolutions.length} possibilities`
    );

  if (possibleSolutions.length === 0) return null;
  if (possibleSolutions.length === 1) return possibleSolutions[0];

  // Endgame optimization: prefer duplicate-heavy solutions when ≤3 remain
  if (possibleSolutions.length <= 3) {
    const duplicatePreferredSolution = possibleSolutions.sort(
      (a, b) => new Set(b).size - new Set(a).size // Prefer solutions with more duplicates
    )[0];
    return duplicatePreferredSolution;
  }

  const candidateGuesses = new Set();

  // Add all possible solutions as candidates (but limit for performance)
  const maxSolutions = Math.min(possibleSolutions.length, 50);
  for (let i = 0; i < maxSolutions; i++) {
    candidateGuesses.add(possibleSolutions[i].join(","));
  }

  // Add strategic first moves if this is the first guess
  if (guessCount === 0) {
    // Optimized first guess for enhanced feedback rules
    candidateGuesses.add([1, 1, 2, 3].join(","));
  }

  // For small sets, add information-maximizing guesses (enhanced for new feedback rules)
  if (possibleSolutions.length <= 10) {
    const digitFrequency = new Map();
    possibleSolutions.forEach((solution) => {
      solution.forEach((digit) => {
        digitFrequency.set(digit, (digitFrequency.get(digit) || 0) + 1);
      });
    });

    const candidateDigits = Array.from(digitFrequency.keys()).sort(
      (a, b) => digitFrequency.get(a) - digitFrequency.get(b)
    );

    const allDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const unknownDigits = allDigits.filter((d) => !digitFrequency.has(d));

    // Strategy 1: Test unique digits from candidates
    if (candidateDigits.length >= 4) {
      candidateGuesses.add(
        [
          candidateDigits[0],
          candidateDigits[1],
          candidateDigits[2],
          candidateDigits[3],
        ].join(",")
      );
    }

    // Strategy 2: Test unknown digits for elimination
    if (unknownDigits.length >= 4) {
      candidateGuesses.add(
        [
          unknownDigits[0],
          unknownDigits[1],
          unknownDigits[2],
          unknownDigits[3],
        ].join(",")
      );
    }
  }

  // If we have many possibilities, add fewer strategic guesses for speed
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
    ];

    strategicGuesses.forEach((guess) => {
      candidateGuesses.add(guess.join(","));
    });
  }

  let bestGuess = null;
  let bestScore = Infinity;

  if (debug)
    console.log(`  Evaluating ${candidateGuesses.size} candidate guesses`);

  for (const candidateStr of Array.from(candidateGuesses)) {
    const candidate = candidateStr.split(",").map(Number);
    const score = calculateGuessScore(candidate, possibleSolutions);

    if (score < bestScore) {
      bestScore = score;
      bestGuess = candidate;
    }
  }

  if (debug)
    console.log(`  Best guess: ${bestGuess.join("")} (score: ${bestScore})`);
  return bestGuess;
}

// Main simulation function with detailed logging
function simulateGame(secret, debug = false) {
  if (debug) console.log(`\nSimulating game for secret: ${secret.join("")}`);

  let possibleSolutions = generateAllCombinations();
  const moves = [];
  let moveCount = 0;

  while (true) {
    moveCount++;

    if (debug)
      console.log(
        `Move ${moveCount}: ${possibleSolutions.length} possibilities remaining`
      );

    // Safety check for infinite loops
    if (moveCount > 10) {
      if (debug)
        console.log(`  ERROR: Too many moves (${moveCount}), aborting`);
      return {
        moves,
        success: false,
        totalMoves: moveCount,
        error: "too_many_moves",
      };
    }

    // Get best guess
    const guess = getBestNextGuess(possibleSolutions, moves.length, debug);
    if (!guess) {
      if (debug) console.log(`  ERROR: No valid guess found`);
      return {
        moves,
        success: false,
        totalMoves: moveCount,
        error: "no_guess",
      };
    }

    // Calculate feedback
    const feedback = calculateSlotBySlotFeedback(guess, secret);
    moves.push({ guess, feedback });

    if (debug)
      console.log(`  Guess: ${guess.join("")}, Feedback: ${feedback.join("")}`);

    // Check if won
    if (feedback.every((f) => f === "correct")) {
      if (debug) console.log(`  SUCCESS: Solved in ${moveCount} moves!`);
      return { moves, success: true, totalMoves: moveCount };
    }

    // Filter solutions
    const prevCount = possibleSolutions.length;
    possibleSolutions = filterSolutionsSlotBySlot(
      possibleSolutions,
      guess,
      feedback
    );

    if (debug)
      console.log(
        `  Filtered: ${prevCount} -> ${possibleSolutions.length} possibilities`
      );

    // Check for empty solution set
    if (possibleSolutions.length === 0) {
      if (debug) console.log(`  ERROR: No possible solutions remain`);
      return {
        moves,
        success: false,
        totalMoves: moveCount,
        error: "no_solutions",
      };
    }
  }
}

// Run analysis with options for different batch sizes
function runAnalysis(options = {}) {
  const {
    maxCases = 1000, // Default to 1000 instead of 10000 for speed
    startFrom = 0,
    debug = false,
    logInterval = 100,
  } = options;

  console.log("Starting optimized algorithm analysis...");
  console.log(
    `Testing ${maxCases} cases from ${startFrom} to ${startFrom + maxCases - 1}`
  );

  const results = [];
  const moveDistribution = {};
  let totalMoves = 0;
  let successCount = 0;
  let errorCount = 0;

  const startTime = Date.now();

  for (let i = startFrom; i < startFrom + maxCases; i++) {
    // Generate secret code
    const secret = [
      Math.floor(i / 1000) % 10,
      Math.floor(i / 100) % 10,
      Math.floor(i / 10) % 10,
      i % 10,
    ];

    // Simulate game
    const result = simulateGame(secret, debug && i < startFrom + 5); // Debug first 5 games

    if (result.success) {
      successCount++;
      totalMoves += result.totalMoves;

      // Track move distribution
      const moves = result.totalMoves;
      moveDistribution[moves] = (moveDistribution[moves] || 0) + 1;
    } else {
      errorCount++;
      if (debug) console.log(`Error for ${secret.join("")}: ${result.error}`);
    }

    results.push({
      secret: secret.join(""),
      moves: result.totalMoves,
      success: result.success,
      error: result.error || null,
      guesses: result.moves.map((m) => ({
        guess: m.guess.join(""),
        feedback: m.feedback,
      })),
    });

    // Progress update
    if ((i - startFrom + 1) % logInterval === 0) {
      const progress = ((i - startFrom + 1) / maxCases) * 100;
      const elapsed = (Date.now() - startTime) / 1000;
      const avgTime = elapsed / (i - startFrom + 1);
      const eta = avgTime * (maxCases - (i - startFrom + 1));

      console.log(
        `Progress: ${i - startFrom + 1}/${maxCases} (${progress.toFixed(
          1
        )}%) - ETA: ${eta.toFixed(1)}s`
      );
      console.log(
        `  Success: ${successCount}, Errors: ${errorCount}, Avg moves: ${
          successCount > 0 ? (totalMoves / successCount).toFixed(2) : "N/A"
        }`
      );
    }
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  // Calculate statistics
  const averageMoves = successCount > 0 ? totalMoves / successCount : 0;
  const successRate = (successCount / maxCases) * 100;

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    duration: duration,
    totalCases: maxCases,
    successCount: successCount,
    errorCount: errorCount,
    successRate: successRate,
    averageMoves: averageMoves,
    moveDistribution: moveDistribution,
    statistics: {
      oneMove: moveDistribution[1] || 0,
      twoMoves: moveDistribution[2] || 0,
      threeMoves: moveDistribution[3] || 0,
      fourMoves: moveDistribution[4] || 0,
      fiveMoves: moveDistribution[5] || 0,
      sixMoves: moveDistribution[6] || 0,
      sevenMoves: moveDistribution[7] || 0,
      eightPlusMoves: Object.keys(moveDistribution)
        .filter((k) => parseInt(k) >= 8)
        .reduce((sum, k) => sum + moveDistribution[k], 0),
      fourOrLessCount:
        (moveDistribution[1] || 0) +
        (moveDistribution[2] || 0) +
        (moveDistribution[3] || 0) +
        (moveDistribution[4] || 0),
      fiveOrLessCount:
        (moveDistribution[1] || 0) +
        (moveDistribution[2] || 0) +
        (moveDistribution[3] || 0) +
        (moveDistribution[4] || 0) +
        (moveDistribution[5] || 0),
    },
  };

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("ALGORITHM ANALYSIS COMPLETE");
  console.log("=".repeat(60));
  console.log(`Total cases tested: ${report.totalCases}`);
  console.log(`Success rate: ${report.successRate.toFixed(2)}%`);
  console.log(`Error rate: ${((errorCount / maxCases) * 100).toFixed(2)}%`);
  console.log(`Average moves: ${report.averageMoves.toFixed(2)}`);
  console.log(`Analysis duration: ${report.duration.toFixed(2)} seconds`);
  console.log(`Speed: ${(maxCases / duration).toFixed(1)} cases/second`);
  console.log("\nMove Distribution:");
  console.log(
    `1 move:  ${report.statistics.oneMove} cases (${(
      (report.statistics.oneMove / maxCases) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `2 moves: ${report.statistics.twoMoves} cases (${(
      (report.statistics.twoMoves / maxCases) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `3 moves: ${report.statistics.threeMoves} cases (${(
      (report.statistics.threeMoves / maxCases) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `4 moves: ${report.statistics.fourMoves} cases (${(
      (report.statistics.fourMoves / maxCases) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `5 moves: ${report.statistics.fiveMoves} cases (${(
      (report.statistics.fiveMoves / maxCases) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `6 moves: ${report.statistics.sixMoves} cases (${(
      (report.statistics.sixMoves / maxCases) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `7 moves: ${report.statistics.sevenMoves} cases (${(
      (report.statistics.sevenMoves / maxCases) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `8+ moves: ${report.statistics.eightPlusMoves} cases (${(
      (report.statistics.eightPlusMoves / maxCases) *
      100
    ).toFixed(2)}%)`
  );

  console.log(
    `\n4-move or less solutions: ${report.statistics.fourOrLessCount} cases (${(
      (report.statistics.fourOrLessCount / maxCases) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `5-move or less solutions: ${report.statistics.fiveOrLessCount} cases (${(
      (report.statistics.fiveOrLessCount / maxCases) *
      100
    ).toFixed(2)}%)`
  );

  // Save detailed results
  const filename = `analysis-results-${startFrom}-${
    startFrom + maxCases - 1
  }.json`;
  fs.writeFileSync(filename, JSON.stringify({ report, results }, null, 2));
  console.log(`\nDetailed results saved to '${filename}'`);

  return report;
}

// Run specific tests
function runQuickTest() {
  console.log("Running quick test on first 100 cases...");
  return runAnalysis({ maxCases: 100, debug: false, logInterval: 25 });
}

function runMediumTest() {
  console.log("Running medium test on first 1000 cases...");
  return runAnalysis({ maxCases: 1000, debug: false, logInterval: 100 });
}

function runFullTest() {
  console.log("Running full test on all 10000 cases...");
  return runAnalysis({ maxCases: 10000, debug: false, logInterval: 1000 });
}

// Run based on command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  const testType = args[0] || "quick";

  switch (testType) {
    case "quick":
      runQuickTest();
      break;
    case "medium":
      runMediumTest();
      break;
    case "full":
      runFullTest();
      break;
    case "debug":
      runAnalysis({ maxCases: 10, debug: true, logInterval: 1 });
      break;
    default:
      console.log(
        "Usage: node algorithm-analysis.js [quick|medium|full|debug]"
      );
      console.log("  quick:  Test 100 cases");
      console.log("  medium: Test 1000 cases");
      console.log("  full:   Test all 10000 cases");
      console.log("  debug:  Test 10 cases with detailed logging");
  }
}

module.exports = {
  runAnalysis,
  simulateGame,
  runQuickTest,
  runMediumTest,
  runFullTest,
};
