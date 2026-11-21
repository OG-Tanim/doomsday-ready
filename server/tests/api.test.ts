import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "../src/index.js";

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe("movies API", () => {
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    const add = async (title: string, prerequisiteIds: number[] = []) => {
      const r = await call("POST", "/movies", { title, releaseYear: 2010, runtimeMinutes: 100, prerequisiteIds });
      expect(r.status).toBe(201);
      ids[title] = r.body.id;
    };
    await add("Iron Man");
    await add("The First Avenger");
    await add("The Avengers", [ids["Iron Man"], ids["The First Avenger"]]);
    await add("Civil War", [ids["The Avengers"]]);
  });

  it("returns the rewatch order with counts and remaining runtime", async () => {
    await call("PATCH", `/movies/${ids["Iron Man"]}`, { watched: true });
    const r = await call("GET", `/movies/${ids["Civil War"]}/rewatch-order`);
    expect(r.status).toBe(200);
    expect(r.body.movies.map((m: { title: string }) => m.title).at(-1)).toBe("The Avengers");
    expect(r.body).toMatchObject({ total: 3, watchedCount: 1, unwatchedRuntimeMinutes: 200 });
  });

  it("rejects a cycle with 409 and leaves the movie unchanged", async () => {
    const r = await call("PATCH", `/movies/${ids["Iron Man"]}`, { prerequisiteIds: [ids["Civil War"]] });
    expect(r).toMatchObject({ status: 409, body: { error: "CIRCULAR_DEPENDENCY" } });
    const list = await call("GET", "/movies");
    expect(list.body.find((m: { id: number }) => m.id === ids["Iron Man"]).prerequisiteIds).toEqual([]);
  });

  it("treats titles as duplicates ignoring case, including non-ASCII letters", async () => {
    expect((await call("POST", "/movies", { title: "iron man", releaseYear: 2010, runtimeMinutes: 90 })).status).toBe(409);
    expect((await call("POST", "/movies", { title: "Élan", releaseYear: 2010, runtimeMinutes: 90 })).status).toBe(201);
    const dup = await call("POST", "/movies", { title: "élan", releaseYear: 2010, runtimeMinutes: 90 });
    expect(dup).toMatchObject({ status: 409, body: { error: "DUPLICATE_TITLE" } });
  });

  it("caps the prerequisite list length", async () => {
    const many = Array.from({ length: 501 }, (_, i) => i + 1);
    const r = await call("PATCH", `/movies/${ids["Iron Man"]}`, { prerequisiteIds: many });
    expect(r).toMatchObject({ status: 400, body: { error: "VALIDATION_ERROR" } });
  });
});

describe("cinemas API", () => {
  it("quotes the fewest bundles, or not possible", async () => {
    const c = await call("POST", "/cinemas", { name: "Grand", bundleSizes: [6, 9, 20] });
    expect(c.status).toBe(201);
    const ok = await call("GET", `/cinemas/${c.body.id}/booking?groupSize=44`);
    expect(ok.body).toMatchObject({ possible: true, totalBundles: 4 });
    const no = await call("GET", `/cinemas/${c.body.id}/booking?groupSize=7`);
    expect(no).toMatchObject({ status: 200, body: { possible: false } });
  });

  it("treats cinema names as duplicates ignoring case, including non-ASCII letters", async () => {
    expect((await call("POST", "/cinemas", { name: "Ödeon", bundleSizes: [2] })).status).toBe(201);
    const dup = await call("POST", "/cinemas", { name: "ödeon", bundleSizes: [3] });
    expect(dup).toMatchObject({ status: 409, body: { error: "DUPLICATE_NAME" } });
  });
});

describe("request body errors", () => {
  it("returns 400 for malformed JSON", async () => {
    const r = await call("POST", "/movies", "{not json");
    expect(r).toMatchObject({ status: 400, body: { error: "VALIDATION_ERROR" } });
  });

  it("returns 413 for an oversized body instead of 500", async () => {
    const r = await call("POST", "/movies", { title: "x".repeat(200_000) });
    expect(r).toMatchObject({ status: 413, body: { error: "PAYLOAD_TOO_LARGE" } });
  });

  it("returns 415 for an unsupported content encoding instead of 500", async () => {
    const r = await call("POST", "/movies", "{}", { "Content-Encoding": "br-unknown" });
    expect(r.status).toBe(415);
    expect(r.body.error).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /movies/:id", () => {
  const ids: Record<string, number> = {};
  const add = async (title: string, prerequisiteIds: number[] = []) => {
    const r = await call("POST", "/movies", { title, releaseYear: 2015, runtimeMinutes: 100, prerequisiteIds });
    expect(r.status).toBe(201);
    ids[title] = r.body.id;
  };

  beforeAll(async () => {
    await add("Del A");
    await add("Del B");
    await add("Del Mid", [ids["Del A"], ids["Del B"]]);
    await add("Del Top", [ids["Del Mid"]]);
  });

  it("rewires dependents to the deleted movie's prerequisites and reports them", async () => {
    const r = await call("DELETE", `/movies/${ids["Del Mid"]}`);
    expect(r.status).toBe(200);
    expect(r.body.deletedId).toBe(ids["Del Mid"]);
    expect(r.body.updatedMovies).toHaveLength(1);
    expect(r.body.updatedMovies[0]).toMatchObject({ id: ids["Del Top"], prerequisiteIds: [ids["Del A"], ids["Del B"]] });

    const order = await call("GET", `/movies/${ids["Del Top"]}/rewatch-order`);
    expect(order.body.movies.map((m: { id: number }) => m.id).sort()).toEqual([ids["Del A"], ids["Del B"]].sort());

    const list = await call("GET", "/movies");
    expect(list.body.some((m: { id: number }) => m.id === ids["Del Mid"])).toBe(false);
  });

  it("frees the title for reuse", async () => {
    expect((await call("POST", "/movies", { title: "del mid", releaseYear: 2015, runtimeMinutes: 90 })).status).toBe(201);
  });

  it("returns 404 for a missing movie and 400 for a bad id", async () => {
    expect((await call("DELETE", `/movies/${ids["Del Mid"]}`)).body.error).toBe("NOT_FOUND");
    expect((await call("DELETE", "/movies/abc")).status).toBe(400);
  });
});
