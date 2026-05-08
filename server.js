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

const buildOriginsWithProtocolVariants = (hostname) => [
  `https://${hostname}`,
  `http://${hostname}`,
];

const configuredOrigins =
  `${process.env.ALLOWED_ORIGINS || ""},${process.env.WEBSITE_URL || ""}`
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean)
    .filter((origin) => origin !== "*");

const localAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

const liveAllowedOrigins = [
  ...buildOriginsWithProtocolVariants("meradevtechnologies.com"),
  ...buildOriginsWithProtocolVariants("www.meradevtechnologies.com"),
  ...buildOriginsWithProtocolVariants("admin.meradevtechnologies.com"),
  ...buildOriginsWithProtocolVariants("www.admin.meradevtechnologies.com"),
];

const allowedOrigins = new Set([
  ...localAllowedOrigins.map(normalizeOrigin),
  ...liveAllowedOrigins.map(normalizeOrigin),
  ...configuredOrigins,
]);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedRequestOrigin = normalizeOrigin(origin);
    if (allowedOrigins.has(normalizedRequestOrigin)) {
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
app.use(express.json({ limit: "15mb" }));

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

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, _req, res, _next) => {
  if (err?.message?.startsWith("CORS blocked for origin:")) {
    res.status(403).json({ message: err.message });
    return;
  }

  console.error("Unhandled server error", err);
  res.status(500).json({ message: "Internal server error" });
});

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
