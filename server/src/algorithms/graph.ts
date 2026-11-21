/**
 * Feature 1: prerequisite graph logic, written by hand (no graph libraries).
 *
 * Graph: movieId -> ids of that movie's prerequisites ("watch these first").
 * A movie with no prerequisites may be missing from the map or map to [].
 */
export type Graph = Map<number, number[]>;

/**
 * Would setting prerequisites(movieId) = newPrereqIds create a cycle?
 *
 * A cycle appears exactly when movieId can be reached from one of the new
 * prerequisites by following prerequisite edges (or a new prerequisite *is*
 * movieId). movieId's current edges are ignored: they are being replaced,
 * and the search stops as soon as it reaches movieId anyway.
 *
 * Iterative DFS with a visited set: O(V + E).
 */
export function wouldCreateCycle(graph: Graph, movieId: number, newPrereqIds: number[]): boolean {
  const visited = new Set<number>();
  const stack = [...newPrereqIds];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === movieId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const prereq of graph.get(id) ?? []) {
      if (!visited.has(prereq)) stack.push(prereq);
    }
  }
  return false;
}

/**
 * What deleting `movieId` does to the movies that depend on it: each dependent
 * takes over the deleted movie's prerequisites, so the watch order is kept.
 * Returns dependentId -> its new prerequisite list (existing ones first, in order,
 * then inherited ones not already listed). Movies that don't depend on `movieId`
 * are not in the result.
 *
 * This can't create a cycle: each new link D -> P replaces the path
 * D -> movieId -> P that already existed.
 */
export function bridgeOnDelete(graph: Graph, movieId: number): Map<number, number[]> {
  const inherited = graph.get(movieId) ?? [];
  const result = new Map<number, number[]>();
  for (const [id, prereqs] of graph) {
    if (id === movieId || !prereqs.includes(movieId)) continue;
    const kept = prereqs.filter((p) => p !== movieId);
    const added = inherited.filter((p) => p !== id && !kept.includes(p));
    result.set(id, [...kept, ...added]);
  }
  return result;
}

/**
 * Every movie the target depends on (directly or not), each exactly once,
 * ordered so each movie comes after all of its prerequisites. Target excluded.
 *
 * DFS post-order: a movie is added only after all of its prerequisites have
 * been added, which is exactly the order we need. The visited set makes each
 * movie appear once even when several movies share it. The DFS uses an explicit
 * stack, so long chains can't overflow the call stack.
 * O(V + E) over the movies reachable from the target.
 */
export function rewatchOrder(graph: Graph, targetId: number): number[] {
  const order: number[] = [];
  // The target counts as visited so it is never added, even in malformed data.
  const visited = new Set<number>([targetId]);

  for (const start of graph.get(targetId) ?? []) {
    if (visited.has(start)) continue;
    visited.add(start);

    // Each frame is [movieId, index of the next prerequisite to look at].
    const stack: [number, number][] = [[start, 0]];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const [id, next] = frame;
      const prereqs = graph.get(id) ?? [];

      if (next < prereqs.length) {
        frame[1] = next + 1;
        const child = prereqs[next];
        if (!visited.has(child)) {
          visited.add(child);
          stack.push([child, 0]);
        }
      } else {
        // All prerequisites of `id` are already in `order`.
        stack.pop();
        order.push(id);
      }
    }
  }
  return order;
}
