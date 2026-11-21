import { describe, expect, it } from "vitest";
import { bridgeOnDelete, rewatchOrder, wouldCreateCycle, type Graph } from "../src/algorithms/graph.js";
import { quoteBooking } from "../src/algorithms/booking.js";

// Sample data from the brief
const IRON_MAN = 1, FIRST_AVENGER = 2, AVENGERS = 3, CIVIL_WAR = 4,
  RAGNAROK = 5, INFINITY_WAR = 6, ENDGAME = 7, DOOMSDAY = 8;

const sample = (): Graph =>
  new Map([
    [IRON_MAN, []],
    [FIRST_AVENGER, []],
    [AVENGERS, [IRON_MAN, FIRST_AVENGER]],
    [CIVIL_WAR, [AVENGERS]],
    [RAGNAROK, []],
    [INFINITY_WAR, [CIVIL_WAR, RAGNAROK]],
    [ENDGAME, [INFINITY_WAR]],
    [DOOMSDAY, [ENDGAME]],
  ]);

/** Every movie appears once, the target is absent, and each movie comes after its prerequisites. */
function expectValidOrder(graph: Graph, target: number, order: number[]) {
  expect(new Set(order).size).toBe(order.length);
  expect(order).not.toContain(target);
  const pos = new Map(order.map((id, i) => [id, i]));
  for (const id of order) {
    for (const p of graph.get(id) ?? []) {
      expect(pos.has(p)).toBe(true);
      expect(pos.get(p)!).toBeLessThan(pos.get(id)!);
    }
  }
}

describe("rewatchOrder", () => {
  it("Doomsday → all 7 other movies in a valid order", () => {
    const g = sample();
    const order = rewatchOrder(g, DOOMSDAY);
    expect(order).toHaveLength(7);
    expect(new Set(order)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    expectValidOrder(g, DOOMSDAY, order);
  });

  it("Civil War → Iron Man and First Avenger (either order), then The Avengers", () => {
    const order = rewatchOrder(sample(), CIVIL_WAR);
    expect(order).toHaveLength(3);
    expect(new Set(order.slice(0, 2))).toEqual(new Set([IRON_MAN, FIRST_AVENGER]));
    expect(order[2]).toBe(AVENGERS);
  });

  it("Ragnarok → empty list", () => {
    expect(rewatchOrder(sample(), RAGNAROK)).toEqual([]);
  });

  it("lists a shared prerequisite only once (diamond)", () => {
    const g: Graph = new Map([[1, []], [2, [1]], [3, [1]], [4, [2, 3]]]);
    const order = rewatchOrder(g, 4);
    expect(order).toHaveLength(3);
    expectValidOrder(g, 4, order);
  });

  it("handles a target missing from the map", () => {
    expect(rewatchOrder(new Map(), 99)).toEqual([]);
  });
});

describe("wouldCreateCycle", () => {
  it("Endgame as a prerequisite of Iron Man → cycle", () => {
    expect(wouldCreateCycle(sample(), IRON_MAN, [ENDGAME])).toBe(true);
  });

  it("a movie as its own prerequisite → cycle", () => {
    expect(wouldCreateCycle(sample(), RAGNAROK, [RAGNAROK])).toBe(true);
  });

  it("valid new edge → no cycle", () => {
    expect(wouldCreateCycle(sample(), RAGNAROK, [IRON_MAN])).toBe(false);
  });

  it("replacing edges with the same ones → no cycle", () => {
    expect(wouldCreateCycle(sample(), AVENGERS, [IRON_MAN, FIRST_AVENGER])).toBe(false);
  });

  it("brand-new movie (not in graph yet) → no cycle", () => {
    expect(wouldCreateCycle(sample(), 100, [DOOMSDAY, IRON_MAN])).toBe(false);
  });

  it("empty prerequisite list → no cycle", () => {
    expect(wouldCreateCycle(sample(), DOOMSDAY, [])).toBe(false);
  });
});

describe("bridgeOnDelete", () => {
  it("dependents inherit the deleted movie's prerequisites (delete The Avengers)", () => {
    const result = bridgeOnDelete(sample(), AVENGERS);
    expect(result).toEqual(new Map([[CIVIL_WAR, [IRON_MAN, FIRST_AVENGER]]]));
  });

  it("keeps the rewatch order of every dependent intact", () => {
    const g = sample();
    const before = rewatchOrder(g, DOOMSDAY).filter((id) => id !== CIVIL_WAR);
    for (const [id, prereqs] of bridgeOnDelete(g, CIVIL_WAR)) g.set(id, prereqs);
    g.delete(CIVIL_WAR);
    const after = rewatchOrder(g, DOOMSDAY);
    expect(new Set(after)).toEqual(new Set(before));
    expectValidOrder(g, DOOMSDAY, after);
  });

  it("keeps existing prerequisites first and skips exact duplicates", () => {
    // 4 needs [1, 3]; 3 needs [1, 2]. Deleting 3 gives 4 -> [1, 2], not [1, 1, 2].
    const g: Graph = new Map([[1, []], [2, []], [3, [1, 2]], [4, [1, 3]]]);
    expect(bridgeOnDelete(g, 3)).toEqual(new Map([[4, [1, 2]]]));
  });

  it("a movie with no prerequisites just disappears from its dependents' lists", () => {
    expect(bridgeOnDelete(sample(), RAGNAROK)).toEqual(new Map([[INFINITY_WAR, [CIVIL_WAR]]]));
  });

  it("a movie nobody depends on changes nothing", () => {
    expect(bridgeOnDelete(sample(), DOOMSDAY).size).toBe(0);
  });
});

describe("quoteBooking", () => {
  it("[1,3,4] / 6 → 2 bundles: 3 × 2", () => {
    expect(quoteBooking([1, 3, 4], 6)).toEqual([{ size: 3, count: 2 }]);
  });

  it("[2,5] / 11 → 4 bundles: 5 × 1, 2 × 3", () => {
    expect(quoteBooking([2, 5], 11)).toEqual([
      { size: 5, count: 1 },
      { size: 2, count: 3 },
    ]);
  });

  it("[6,9,20] / 44 → 4 bundles: 20 × 1, 9 × 2, 6 × 1 (greedy would fail)", () => {
    expect(quoteBooking([6, 9, 20], 44)).toEqual([
      { size: 20, count: 1 },
      { size: 9, count: 2 },
      { size: 6, count: 1 },
    ]);
  });

  it("[4,6] / 7 → not possible", () => {
    expect(quoteBooking([4, 6], 7)).toBeNull();
  });

  it("unsorted sizes still work", () => {
    expect(quoteBooking([5, 2], 11)).toEqual([
      { size: 5, count: 1 },
      { size: 2, count: 3 },
    ]);
  });

  it("group smaller than every bundle → not possible", () => {
    expect(quoteBooking([5], 3)).toBeNull();
  });

  it("max inputs (10 sizes, group 10,000) are fast and correct", () => {
    const sizes = [7, 13, 29, 61, 127, 251, 331, 409, 457, 499];
    const start = performance.now();
    const result = quoteBooking(sizes, 10_000);
    expect(performance.now() - start).toBeLessThan(200);
    expect(result).not.toBeNull();
    expect(result!.reduce((s, l) => s + l.size * l.count, 0)).toBe(10_000);
  });
});
