import mongoose from 'mongoose';

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

const eventSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: ['page_view', 'click', 'rage_click', 'dead_click'],
  },
  url: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  x: {
    type: Number,
  },
  y: {
    type: Number,
  },
  xPct: {
    type: Number,
  },
  yPct: {
    type: Number,
  },
  viewportWidth: {
    type: Number,
  },
  viewportHeight: {
    type: Number,
  },
  targetSelector: {
    type: String,
  },
  clickCount: {
    type: Number,
  },
});

// Compound index for heatmap queries including eventType and targetSelector
eventSchema.index({
  url: 1,
  eventType: 1,
  x: 1,
  y: 1,
  xPct: 1,
  yPct: 1,
  targetSelector: 1,
});

// Compound index for chronological session timeline queries
eventSchema.index({ sessionId: 1, timestamp: 1 });

// TTL index to automatically expire raw telemetry events older than 30 days
eventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: THIRTY_DAYS_IN_SECONDS }
);

export const Event =
  mongoose.models.Event || mongoose.model('Event', eventSchema);
