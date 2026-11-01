import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Event } from "@/models/Event";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Covered query served from { url: 1, eventType: 1, x: 1, y: 1, xPct: 1, yPct: 1 }
    const clicks = await Event.find(
      { url, eventType: "click" },
      { x: 1, y: 1, xPct: 1, yPct: 1, _id: 0 },
    )
      .limit(5000)
      .lean();

    return NextResponse.json(clicks, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
