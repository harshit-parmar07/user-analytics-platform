import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    required: true,
    enum: ['page_view', 'click']
  },
  url: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  x: {
    type: Number
  },
  y: {
    type: Number
  }
});

export const Event = mongoose.model('Event', eventSchema);
