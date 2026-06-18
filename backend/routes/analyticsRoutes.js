import express from 'express';
import {
  trackEvent,
  getSessions,
  getSessionEvents,
  getHeatmapData
} from '../controllers/analyticsController.js';

const router = express.Router();

router.post('/events', trackEvent);
router.get('/sessions', getSessions);
router.get('/sessions/:sessionId/events', getSessionEvents);
router.get('/events/heatmap', getHeatmapData);

export default router;
