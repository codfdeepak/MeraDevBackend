const mongoose = require("mongoose");

const EVENT_TYPES = [
  "page_view",
  "click",
  "api_call",
  "form_submit",
  "error",
  "session_start",
  "custom",
];

const EVENT_STATUSES = ["info", "pending", "success", "failed"];

const analyticsEventSchema = new mongoose.Schema(
  {
    sourceApp: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "MeraDevFrontend",
    },
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      default: "custom",
    },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: "info",
    },
    path: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    action: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    label: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    sessionId: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    visitorId: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    region: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    timezone: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    referrer: {
      type: String,
      trim: true,
      maxlength: 320,
      default: "",
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
  },
  { timestamps: true },
);

analyticsEventSchema.index({ occurredAt: -1 });
analyticsEventSchema.index({ eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ path: 1, occurredAt: -1 });
analyticsEventSchema.index({ sourceApp: 1, occurredAt: -1 });
analyticsEventSchema.index({ country: 1, occurredAt: -1 });
analyticsEventSchema.index({ city: 1, occurredAt: -1 });

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);
