import express from "express";
import { db } from "./db";
import { users } from "@shared/schema";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await db.select().from(users).limit(1);
    res.json({ status: "db ok", count: result.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(500).json({ status: "db error", error: message });
  }
});

const port = 5000;
console.log("Starting debug server...");
app.listen(port, "0.0.0.0", () => {
  console.log(`Debug server running on port ${port}`);
});