const express = require("express");
const { authMiddleware } = require("../config/auth");
const {
  collectFrontendEvent,
  getOwnerAnalyticsDashboard,
  getOwnerVisitorJourney,
} = require("../controllers/analytics.controller");

const router = express.Router();

// Public event ingestion from MeraDev frontend.
router.post("/events", collectFrontendEvent);

// Owner dashboard analytics summary.
router.get("/owner/dashboard", authMiddleware, getOwnerAnalyticsDashboard);
router.get("/owner/visitor-journey", authMiddleware, getOwnerVisitorJourney);

module.exports = router;
