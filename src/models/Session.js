import mongoose from 'mongoose';

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  lastActiveAt: {
    type: Date,
    required: true,
  },
  eventCount: {
    type: Number,
    required: true,
    default: 0,
  },
  rageClickCount: {
    type: Number,
    required: true,
    default: 0,
  },
  deadClickCount: {
    type: Number,
    required: true,
    default: 0,
  },
  isFrustrated: {
    type: Boolean,
    required: true,
    default: false,
  },
});

// Compound index for fast sorting on the Sessions dashboard
sessionSchema.index({ lastActiveAt: -1, createdAt: -1 });

// Compound index for filtering Frustrated Sessions in O(1) index scan
sessionSchema.index({ isFrustrated: 1, lastActiveAt: -1 });

// TTL index to automatically purge inactive sessions after 30 days
sessionSchema.index(
  { lastActiveAt: 1 },
  { expireAfterSeconds: THIRTY_DAYS_IN_SECONDS }
);

export const Session =
  mongoose.models.Session || mongoose.model('Session', sessionSchema);
