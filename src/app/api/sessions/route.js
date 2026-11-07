import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Session } from '@/models/Session';
import { Event } from '@/models/Event';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const frustratedOnly = searchParams.get('frustratedOnly') === 'true';

    await connectToDatabase();

    // Self-healing check for sessions missing frustration counters
    const hasLegacySessions = await Session.exists({
      $or: [
        { eventCount: { $exists: false } },
        { rageClickCount: { $exists: false } },
      ],
    });

    if (hasLegacySessions) {
      const legacySessions = await Session.find(
        {
          $or: [
            { eventCount: { $exists: false } },
            { rageClickCount: { $exists: false } },
          ],
        },
        { sessionId: 1, createdAt: 1 }
      ).lean();

      const legacyIds = legacySessions.map((s) => s.sessionId);

      const eventStats = await Event.aggregate([
        { $match: { sessionId: { $in: legacyIds } } },
        {
          $group: {
            _id: '$sessionId',
            count: { $sum: 1 },
            rageCount: {
              $sum: { $cond: [{ $eq: ['$eventType', 'rage_click'] }, 1, 0] },
            },
            deadCount: {
              $sum: { $cond: [{ $eq: ['$eventType', 'dead_click'] }, 1, 0] },
            },
            lastActiveAt: { $max: '$timestamp' },
          },
        },
      ]);

      const statsMap = new Map(eventStats.map((item) => [item._id, item]));

      const bulkOps = legacySessions.map((legacy) => {
        const stat = statsMap.get(legacy.sessionId);
        const rageClickCount = stat ? stat.rageCount : 0;
        const deadClickCount = stat ? stat.deadCount : 0;
        return {
          updateOne: {
            filter: { sessionId: legacy.sessionId },
            update: {
              $set: {
                eventCount: stat ? stat.count : 0,
                rageClickCount,
                deadClickCount,
                isFrustrated: rageClickCount > 0 || deadClickCount > 0,
                lastActiveAt: stat ? stat.lastActiveAt : legacy.createdAt,
              },
            },
          },
        };
      });

      if (bulkOps.length > 0) {
        await Session.bulkWrite(bulkOps);
      }
    }

    const filter = frustratedOnly ? { isFrustrated: true } : {};

    const sessions = await Session.find(filter, {
      _id: 0,
      sessionId: 1,
      createdAt: 1,
      lastActiveAt: 1,
      eventCount: 1,
      rageClickCount: 1,
      deadClickCount: 1,
      isFrustrated: 1,
    })
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
