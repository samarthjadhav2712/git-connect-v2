require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes/route");
const pool = require("./config/db");


const app = express();
const BASE_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT_RETRIES = 20;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

// ── API Routes ────────────────────────────────────────────────
app.use("/api", routes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────
const startServer = async (port, retriesLeft = MAX_PORT_RETRIES) => {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to Neon DB");
    client.release();
  } catch (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`GIT Connect API running on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Retrying on ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
};

startServer(BASE_PORT);
