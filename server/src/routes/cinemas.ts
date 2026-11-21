import { Router } from "express";
import { db } from "../db.js";
import { ApiError } from "../errors.js";
import { quoteBooking } from "../algorithms/booking.js";
import { asObject, distinctIntArray, intInRange, nonEmptyString, positiveIntParam } from "../validation.js";

export type Cinema = { id: number; name: string; bundleSizes: number[] };

const GROUP_MIN = 1;
const GROUP_MAX = 10_000;

function loadAllCinemas(): Cinema[] {
  const rows = db.prepare("SELECT id, name FROM cinemas ORDER BY name").all() as { id: number; name: string }[];
  const sizes = db
    .prepare("SELECT cinema_id, size FROM cinema_bundle_sizes ORDER BY cinema_id, size")
    .all() as { cinema_id: number; size: number }[];
  const byCinema = new Map<number, number[]>();
  for (const s of sizes) {
    if (!byCinema.has(s.cinema_id)) byCinema.set(s.cinema_id, []);
    byCinema.get(s.cinema_id)!.push(s.size);
  }
  return rows.map((r) => ({ ...r, bundleSizes: byCinema.get(r.id) ?? [] }));
}

function loadCinema(id: number): Cinema {
  const row = db.prepare("SELECT id, name FROM cinemas WHERE id = ?").get(id) as
    | { id: number; name: string }
    | undefined;
  if (!row) throw new ApiError(404, "NOT_FOUND", `Cinema ${id} not found`);
  const bundleSizes = db
    .prepare("SELECT size FROM cinema_bundle_sizes WHERE cinema_id = ? ORDER BY size")
    .pluck()
    .all(id) as number[];
  return { ...row, bundleSizes };
}

export const cinemasRouter = Router();

cinemasRouter.get("/", (_req, res) => {
  res.json(loadAllCinemas());
});

cinemasRouter.post("/", (req, res) => {
  const body = asObject(req.body);
  const name = nonEmptyString(body.name, "name");
  const bundleSizes = distinctIntArray(body.bundleSizes, "bundleSizes", { min: 1, max: 500, minLen: 1, maxLen: 10 });

  const id = db.transaction(() => {
    if (db.prepare("SELECT 1 FROM cinemas WHERE name = ?").get(name)) {
      throw new ApiError(409, "DUPLICATE_NAME", `A cinema named "${name}" already exists`);
    }
    const id = Number(db.prepare("INSERT INTO cinemas (name) VALUES (?)").run(name).lastInsertRowid);
    const insert = db.prepare("INSERT INTO cinema_bundle_sizes (cinema_id, size) VALUES (?, ?)");
    for (const size of bundleSizes) insert.run(id, size);
    return id;
  })();

  res.status(201).json(loadCinema(id));
});

cinemasRouter.get("/:id/booking", (req, res) => {
  const id = positiveIntParam(req.params.id, "id");
  const groupSize = intInRange(positiveIntParam(req.query.groupSize, "groupSize"), "groupSize", GROUP_MIN, GROUP_MAX);
  const cinema = loadCinema(id); // 404 if missing

  const bundles = quoteBooking(cinema.bundleSizes, groupSize);
  if (!bundles) {
    res.json({ cinema, groupSize, possible: false });
    return;
  }
  res.json({
    cinema,
    groupSize,
    possible: true,
    totalBundles: bundles.reduce((sum, b) => sum + b.count, 0),
    bundles,
  });
});
