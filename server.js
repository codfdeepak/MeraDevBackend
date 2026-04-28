// Load env without the noisy banner from dotenv v17+
require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./src/config/db");
const { ensureUserRoles } = require("./src/utils/ensureUserRoles");

const authRoutes = require("./src/routes/auth.routes");
const profileRoutes = require("./src/routes/profile.routes");
const serviceRoutes = require("./src/routes/service.routes");
const consultationRoutes = require("./src/routes/consultation.routes");
const heroRoutes = require("./src/routes/hero.routes");
const projectRoutes = require("./src/routes/project.routes");
const analyticsRoutes = require("./src/routes/analytics.routes");

const app = express();

const normalizeOrigin = (value = "") =>
  value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/$/, "");
const configuredOrigins = `${process.env.ALLOWED_ORIGINS || ""},${process.env.WEBSITE_URL || ""}`
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

const allowAllOrigins = configuredOrigins.includes("*");
const allowedOrigins = new Set([
  ...defaultAllowedOrigins.map(normalizeOrigin),
  ...configuredOrigins.filter((origin) => origin !== "*"),
]);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedRequestOrigin = normalizeOrigin(origin);
    if (allowAllOrigins || allowedOrigins.has(normalizedRequestOrigin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
// Allow slightly larger JSON payloads to support gallery/base64 uploads from admin
app.use(express.json({ limit: '15mb' }));

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Backend is live " });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/hero", heroRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/analytics", analyticsRoutes);

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    await ensureUserRoles();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
};

start();
