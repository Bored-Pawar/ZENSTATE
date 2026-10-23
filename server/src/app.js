import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { router } from "./routes/api.js";
import { errorHandler } from "./middleware/errorHandler.js";
export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "64kb" }));
app.get("/api/health", (_req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    data: {
      status:
        mongoose.connection.readyState === 1 ? "ready" : "database unavailable",
    },
  }),
);
app.use("/api", router);
app.use((_req, res) =>
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } }),
);
app.use(errorHandler);
