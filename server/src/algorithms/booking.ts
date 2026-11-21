/**
 * Feature 2: booking quote, written by hand (no optimisation libraries).
 */
export type BundleLine = { size: number; count: number };

/**
 * Fewest bundles whose sizes sum to exactly groupSize (each size can be used
 * any number of times). This is the "minimum coin change" problem.
 *
 * Greedy (always take the biggest bundle that fits) is wrong here:
 * for sizes 6, 9, 20 and a group of 44 it takes 20 + 20 and gets stuck,
 * while the answer is 20 + 9 + 9 + 6.
 *
 * Dynamic programming over seat counts:
 *   fewest[0] = 0
 *   fewest[s] = 1 + min(fewest[s - b]) over bundle sizes b <= s
 * lastBundle[s] remembers which b gave that minimum, so we can walk back from
 * groupSize to 0 and count the bundles used.
 *
 * Time O(groupSize × sizes) ≤ 10,000 × 10; memory O(groupSize).
 * Ties: sizes are tried largest first and only a strictly better count
 * replaces the current choice, so among equally short answers the one whose
 * last step uses the largest bundle wins. Any minimal answer is valid.
 *
 * Returns lines sorted by size, largest first; null if no exact sum exists.
 */
export function quoteBooking(sizes: number[], groupSize: number): BundleLine[] | null {
  const sorted = [...new Set(sizes)].filter((b) => b > 0).sort((a, b) => b - a);
  if (groupSize === 0) return [];
  if (sorted.length === 0 || groupSize < 0) return null;

  const UNREACHABLE = Number.POSITIVE_INFINITY;
  const fewest = new Array<number>(groupSize + 1).fill(UNREACHABLE);
  const lastBundle = new Array<number>(groupSize + 1).fill(0);
  fewest[0] = 0;

  for (let seats = 1; seats <= groupSize; seats++) {
    for (const b of sorted) {
      if (b > seats) continue;
      const candidate = fewest[seats - b] + 1;
      if (candidate < fewest[seats]) {
        fewest[seats] = candidate;
        lastBundle[seats] = b;
      }
    }
  }

  if (fewest[groupSize] === UNREACHABLE) return null;

  const counts = new Map<number, number>();
  for (let seats = groupSize; seats > 0; seats -= lastBundle[seats]) {
    const b = lastBundle[seats];
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.size - a.size);
}
