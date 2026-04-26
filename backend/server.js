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

const app = express();

// ✅ FULL CORS CONFIG
app.use(
  cors({
    origin: [
      // process.env.WEBSITE_URL,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
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
