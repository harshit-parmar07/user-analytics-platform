import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Session } from '@/models/Session';
import { Event } from '@/models/Event';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

function sanitizeElementText(rawText, clientRedacted = false) {
  if (!rawText || typeof rawText !== 'string') {
    return { text: '', isRedacted: Boolean(clientRedacted) };
  }

  let isRedacted = Boolean(clientRedacted);
  const scrubbed = rawText
    .slice(0, 80)
    .replace(EMAIL_REGEX, () => {
      isRedacted = true;
      return '[EMAIL_REDACTED]';
    })
    .replace(CARD_REGEX, () => {
      isRedacted = true;
      return '[CARD_REDACTED]';
    })
    .replace(PHONE_REGEX, () => {
      isRedacted = true;
      return '[PHONE_REDACTED]';
    });

  return { text: scrubbed, isRedacted };
}

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
      targetSelector: directTargetSelector,
      selector,
      targetTag,
      targetText,
      isRedacted,
      clickCount: directClickCount,
      rageClickCount,
    } = body;

    const targetSelector = directTargetSelector || selector;
    const clickCount = directClickCount || rageClickCount;

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

    const sanitized = sanitizeElementText(targetText, isRedacted);

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
        targetSelector: targetSelector ? String(targetSelector).slice(0, 160) : undefined,
        targetTag: targetTag ? String(targetTag).slice(0, 32) : undefined,
        targetText: sanitized.text || undefined,
        isRedacted: sanitized.isRedacted,
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
