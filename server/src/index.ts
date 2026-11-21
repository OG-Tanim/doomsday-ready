import express, { type ErrorRequestHandler } from "express";
import { ApiError } from "./errors.js";
import { moviesRouter } from "./routes/movies.js";
import { cinemasRouter } from "./routes/cinemas.js";

export const app = express();
app.use(express.json());

const api = express.Router();
api.get("/health", (_req, res) => {
  res.json({ ok: true });
});
api.use("/movies", moviesRouter);
api.use("/cinemas", cinemasRouter);
api.use((_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "No such endpoint")));
app.use("/api", api);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Body is not valid JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: "Something went wrong" });
};
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`API listening on http://localhost:${port}/api`));
}
