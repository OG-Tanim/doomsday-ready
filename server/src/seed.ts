/**
 * Resets the database to the sample data from the brief.
 * Usage: npm run seed            (wipes and reseeds)
 *        node dist/seed.js --if-empty   (seeds only a fresh DB; used by Docker)
 * Runtimes/years are approximate; Doomsday's runtime is a placeholder.
 */
import { db } from "./db.js";

const movies: { title: string; year: number; runtime: number; prereqs: string[] }[] = [
  { title: "Iron Man", year: 2008, runtime: 126, prereqs: [] },
  { title: "Captain America: The First Avenger", year: 2011, runtime: 124, prereqs: [] },
  { title: "The Avengers", year: 2012, runtime: 143, prereqs: ["Iron Man", "Captain America: The First Avenger"] },
  { title: "Captain America: Civil War", year: 2016, runtime: 147, prereqs: ["The Avengers"] },
  { title: "Thor: Ragnarok", year: 2017, runtime: 130, prereqs: [] },
  { title: "Avengers: Infinity War", year: 2018, runtime: 149, prereqs: ["Captain America: Civil War", "Thor: Ragnarok"] },
  { title: "Avengers: Endgame", year: 2019, runtime: 181, prereqs: ["Avengers: Infinity War"] },
  { title: "Avengers: Doomsday", year: 2026, runtime: 150, prereqs: ["Avengers: Endgame"] },
];

// One cinema per row of the brief's booking table.
const cinemas: { name: string; sizes: number[] }[] = [
  { name: "Starlight Multiplex", sizes: [1, 3, 4] },
  { name: "Riverside Pictures", sizes: [2, 5] },
  { name: "Grand Odeon Hall", sizes: [6, 9, 20] },
  { name: "Corner Screen", sizes: [4, 6] },
];

const ifEmpty = process.argv.includes("--if-empty");
const hasData = db.prepare("SELECT (SELECT COUNT(*) FROM movies) + (SELECT COUNT(*) FROM cinemas)").pluck().get() as number;
if (ifEmpty && hasData > 0) {
  console.log("Database already has data; skipping seed.");
  process.exit(0);
}

db.transaction(() => {
  db.exec("DELETE FROM movie_prerequisites; DELETE FROM movies; DELETE FROM cinema_bundle_sizes; DELETE FROM cinemas;");
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('movies', 'cinemas');");

  const insertMovie = db.prepare("INSERT INTO movies (title, release_year, runtime_minutes) VALUES (?, ?, ?)");
  const ids = new Map<string, number>();
  for (const m of movies) ids.set(m.title, Number(insertMovie.run(m.title, m.year, m.runtime).lastInsertRowid));

  const insertPrereq = db.prepare("INSERT INTO movie_prerequisites (movie_id, prerequisite_id) VALUES (?, ?)");
  for (const m of movies) for (const p of m.prereqs) insertPrereq.run(ids.get(m.title), ids.get(p));

  const insertCinema = db.prepare("INSERT INTO cinemas (name) VALUES (?)");
  const insertSize = db.prepare("INSERT INTO cinema_bundle_sizes (cinema_id, size) VALUES (?, ?)");
  for (const c of cinemas) {
    const id = Number(insertCinema.run(c.name).lastInsertRowid);
    for (const s of c.sizes) insertSize.run(id, s);
  }
})();

console.log(`Seeded ${movies.length} movies and ${cinemas.length} cinemas.`);
