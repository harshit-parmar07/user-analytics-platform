import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Session } from '@/models/Session';
import { Event } from '@/models/Event';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      sessionId,
      eventType,
      url,
      timestamp,
      x,
      y,
      xPct,
      yPct,
      viewportWidth,
      viewportHeight,
      targetSelector,
      clickCount,
    } = body;

    if (!sessionId || !eventType || !url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    await connectToDatabase();

    const eventTimestamp = timestamp ? new Date(timestamp) : new Date();
    const isRage = eventType === 'rage_click';
    const isDead = eventType === 'dead_click';
    const isFrustrationEvent = isRage || isDead;

    const sessionUpdate = {
      $setOnInsert: {
        sessionId,
        createdAt: eventTimestamp,
        ...(isFrustrationEvent ? {} : { isFrustrated: false }),
      },
      $max: {
        lastActiveAt: eventTimestamp,
      },
      $inc: {
        eventCount: 1,
        rageClickCount: isRage ? 1 : 0,
        deadClickCount: isDead ? 1 : 0,
      },
      ...(isFrustrationEvent ? { $set: { isFrustrated: true } } : {}),
    };

    const [, event] = await Promise.all([
      Session.updateOne({ sessionId }, sessionUpdate, {
        upsert: true,
        setDefaultsOnInsert: false,
      }),
      Event.create({
        sessionId,
        eventType,
        url,
        timestamp: eventTimestamp,
        x,
        y,
        xPct,
        yPct,
        viewportWidth,
        viewportHeight,
        targetSelector,
        clickCount,
      }),
    ]);

    return NextResponse.json(event, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
