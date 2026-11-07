import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Event } from '@/models/Event';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const { sessionId } = await context.params;

    await connectToDatabase();

    const events = await Event.find(
      { sessionId },
      {
        _id: 1,
        eventType: 1,
        url: 1,
        timestamp: 1,
        x: 1,
        y: 1,
        xPct: 1,
        yPct: 1,
        viewportWidth: 1,
        viewportHeight: 1,
        targetSelector: 1,
        clickCount: 1,
      }
    )
      .sort({ timestamp: 1 })
      .limit(1000)
      .lean();

    return NextResponse.json(events, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
