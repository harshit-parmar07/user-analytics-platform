import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Session } from "@/models/Session";
import { Event } from "@/models/Event";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    // Self-healing check: backfill any legacy sessions created before denormalization
    const hasLegacySessions = await Session.exists({
      eventCount: { $exists: false },
    });

    if (hasLegacySessions) {
      const legacySessions = await Session.find(
        { eventCount: { $exists: false } },
        { sessionId: 1, createdAt: 1 },
      ).lean();

      const legacyIds = legacySessions.map((s) => s.sessionId);

      const eventStats = await Event.aggregate([
        { $match: { sessionId: { $in: legacyIds } } },
        {
          $group: {
            _id: "$sessionId",
            count: { $sum: 1 },
            lastActiveAt: { $max: "$timestamp" },
          },
        },
      ]);

      const statsMap = new Map(eventStats.map((item) => [item._id, item]));

      const bulkOps = legacySessions.map((legacy) => {
        const stat = statsMap.get(legacy.sessionId);
        return {
          updateOne: {
            filter: { sessionId: legacy.sessionId },
            update: {
              $set: {
                eventCount: stat ? stat.count : 0,
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

    // Fast indexed read using { lastActiveAt: -1, createdAt: -1 } without $lookup
    const sessions = await Session.find(
      {},
      {
        _id: 0,
        sessionId: 1,
        createdAt: 1,
        lastActiveAt: 1,
        eventCount: 1,
      },
    )
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
