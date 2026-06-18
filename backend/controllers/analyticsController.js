import { Session } from '../models/Session.js';
import { Event } from '../models/Event.js';

export const trackEvent = async (req, res) => {
  try {
    const { sessionId, eventType, url, timestamp, x, y } = req.body;

    if (!sessionId || !eventType || !url) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let session = await Session.findOne({ sessionId });
    if (!session) {
      session = new Session({ sessionId, createdAt: timestamp || new Date() });
      await session.save();
    }

    const event = new Event({
      sessionId,
      eventType,
      url,
      timestamp: timestamp || new Date(),
      x,
      y
    });
    await event.save();

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSessions = async (req, res) => {
  try {
    const sessions = await Session.aggregate([
      {
        $lookup: {
          from: 'events',
          localField: 'sessionId',
          foreignField: 'sessionId',
          as: 'events'
        }
      },
      {
        $project: {
          sessionId: 1,
          createdAt: 1,
          eventCount: { $size: '$events' }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSessionEvents = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const events = await Event.find({ sessionId }).sort({ timestamp: 1 });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHeatmapData = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const clicks = await Event.find(
      { url, eventType: 'click' },
      { x: 1, y: 1, _id: 0 }
    );

    res.status(200).json(clicks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
