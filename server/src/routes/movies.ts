import { Router } from "express";
import { db } from "../db.js";
import { ApiError } from "../errors.js";
import { rewatchOrder, wouldCreateCycle, type Graph } from "../algorithms/graph.js";
import {
  asObject,
  boolean,
  distinctIntArray,
  intInRange,
  nonEmptyString,
  positiveIntParam,
} from "../validation.js";

export type Movie = {
  id: number;
  title: string;
  releaseYear: number;
  runtimeMinutes: number;
  watched: boolean;
  prerequisiteIds: number[];
};

type MovieRow = {
  id: number;
  title: string;
  release_year: number;
  runtime_minutes: number;
  watched: number;
};

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;
/** Placeholder id for a movie that doesn't exist yet (ids start at 1). */
const NEW_MOVIE_ID = 0;
/** Upper bound on one movie's prerequisite list, to keep requests cheap. */
const MAX_PREREQUISITES = 500;

// ---------- data access ----------

function loadAllMovies(): Movie[] {
  const rows = db.prepare("SELECT * FROM movies ORDER BY release_year, id").all() as MovieRow[];
  const graph = loadGraph();
  return rows.map((r) => toMovie(r, graph.get(r.id) ?? []));
}

function loadMovie(id: number): Movie {
  const row = db.prepare("SELECT * FROM movies WHERE id = ?").get(id) as MovieRow | undefined;
  if (!row) throw new ApiError(404, "NOT_FOUND", `Movie ${id} not found`);
  const prereqs = db
    .prepare("SELECT prerequisite_id FROM movie_prerequisites WHERE movie_id = ? ORDER BY prerequisite_id")
    .pluck()
    .all(id) as number[];
  return toMovie(row, prereqs);
}

/** movieId -> prerequisite ids, for every movie in the DB. */
function loadGraph(): Graph {
  const graph: Graph = new Map();
  for (const id of db.prepare("SELECT id FROM movies").pluck().all() as number[]) graph.set(id, []);
  const edges = db
    .prepare("SELECT movie_id, prerequisite_id FROM movie_prerequisites ORDER BY movie_id, prerequisite_id")
    .all() as { movie_id: number; prerequisite_id: number }[];
  for (const e of edges) graph.get(e.movie_id)!.push(e.prerequisite_id);
  return graph;
}

function toMovie(r: MovieRow, prerequisiteIds: number[]): Movie {
  return {
    id: r.id,
    title: r.title,
    releaseYear: r.release_year,
    runtimeMinutes: r.runtime_minutes,
    watched: r.watched === 1,
    prerequisiteIds,
  };
}

function replacePrerequisites(movieId: number, prerequisiteIds: number[]) {
  db.prepare("DELETE FROM movie_prerequisites WHERE movie_id = ?").run(movieId);
  const insert = db.prepare("INSERT INTO movie_prerequisites (movie_id, prerequisite_id) VALUES (?, ?)");
  for (const p of prerequisiteIds) insert.run(movieId, p);
}

// ---------- checks ----------

function assertTitleFree(title: string, exceptId?: number) {
  const clash = db
    .prepare("SELECT id FROM movies WHERE name_key(title) = name_key(?) AND id IS NOT ?")
    .get(title, exceptId ?? null);
  if (clash) throw new ApiError(409, "DUPLICATE_TITLE", `A movie titled "${title}" already exists`);
}

/** Unknown ids → 400; anything that would loop back → 409. */
function assertPrerequisitesValid(graph: Graph, movieId: number, prerequisiteIds: number[]) {
  const unknown = prerequisiteIds.filter((p) => p !== movieId && !graph.has(p));
  if (unknown.length) {
    throw new ApiError(400, "VALIDATION_ERROR", `Unknown prerequisite id(s): ${unknown.join(", ")}`);
  }
  if (wouldCreateCycle(graph, movieId, prerequisiteIds)) {
    throw new ApiError(
      409,
      "CIRCULAR_DEPENDENCY",
      "These prerequisites would make the movie depend on itself",
    );
  }
}

const parsePrereqs = (v: unknown) =>
  distinctIntArray(v, "prerequisiteIds", { min: 1, max: Number.MAX_SAFE_INTEGER, maxLen: MAX_PREREQUISITES });

// ---------- routes ----------

export const moviesRouter = Router();

moviesRouter.get("/", (_req, res) => {
  res.json(loadAllMovies());
});

moviesRouter.post("/", (req, res) => {
  const body = asObject(req.body);
  const title = nonEmptyString(body.title, "title");
  const releaseYear = intInRange(body.releaseYear, "releaseYear", YEAR_MIN, YEAR_MAX);
  const runtimeMinutes = intInRange(body.runtimeMinutes, "runtimeMinutes", 1, 300);
  const watched = body.watched === undefined ? false : boolean(body.watched, "watched");
  const prerequisiteIds = body.prerequisiteIds === undefined ? [] : parsePrereqs(body.prerequisiteIds);

  const id = db.transaction(() => {
    assertTitleFree(title);
    assertPrerequisitesValid(loadGraph(), NEW_MOVIE_ID, prerequisiteIds);
    const { lastInsertRowid } = db
      .prepare("INSERT INTO movies (title, release_year, runtime_minutes, watched) VALUES (?, ?, ?, ?)")
      .run(title, releaseYear, runtimeMinutes, watched ? 1 : 0);
    replacePrerequisites(Number(lastInsertRowid), prerequisiteIds);
    return Number(lastInsertRowid);
  })();

  res.status(201).json(loadMovie(id));
});

moviesRouter.patch("/:id", (req, res) => {
  const id = positiveIntParam(req.params.id, "id");
  const body = asObject(req.body);
  const title = body.title === undefined ? undefined : nonEmptyString(body.title, "title");
  const releaseYear =
    body.releaseYear === undefined ? undefined : intInRange(body.releaseYear, "releaseYear", YEAR_MIN, YEAR_MAX);
  const runtimeMinutes =
    body.runtimeMinutes === undefined ? undefined : intInRange(body.runtimeMinutes, "runtimeMinutes", 1, 300);
  const watched = body.watched === undefined ? undefined : boolean(body.watched, "watched");
  const prerequisiteIds = body.prerequisiteIds === undefined ? undefined : parsePrereqs(body.prerequisiteIds);

  db.transaction(() => {
    const current = loadMovie(id); // 404 if missing
    if (title !== undefined) assertTitleFree(title, id);
    if (prerequisiteIds !== undefined) assertPrerequisitesValid(loadGraph(), id, prerequisiteIds);

    db.prepare(
      "UPDATE movies SET title = ?, release_year = ?, runtime_minutes = ?, watched = ? WHERE id = ?",
    ).run(
      title ?? current.title,
      releaseYear ?? current.releaseYear,
      runtimeMinutes ?? current.runtimeMinutes,
      (watched ?? current.watched) ? 1 : 0,
      id,
    );
    if (prerequisiteIds !== undefined) replacePrerequisites(id, prerequisiteIds);
  })();

  res.json(loadMovie(id));
});

moviesRouter.get("/:id/rewatch-order", (req, res) => {
  const id = positiveIntParam(req.params.id, "id");
  const target = loadMovie(id); // 404 if missing
  const byId = new Map(loadAllMovies().map((m) => [m.id, m]));
  const movies = rewatchOrder(loadGraph(), id).map((mid) => byId.get(mid)!);

  res.json({
    target,
    movies,
    total: movies.length,
    watchedCount: movies.filter((m) => m.watched).length,
    unwatchedRuntimeMinutes: movies.filter((m) => !m.watched).reduce((sum, m) => sum + m.runtimeMinutes, 0),
  });
});
