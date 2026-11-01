# Autonomous Agent Execution Plan: Phase 3 — Heatmap Accuracy & Thermal Canvas Visualization

You are an autonomous coding agent running in Antigravity IDE. Apply the following heatmap accuracy and visualization upgrades to the Next.js Serverless User Analytics Platform:

1. **Capture Document-Relative & Normalized Coordinates (`public/tracker.js`):** Replace viewport-only `clientX`/`clientY` with scroll-aware document coordinates (`pageX`, `pageY`), normalized relative percentages (`xPct`, `yPct`), and viewport dimensions (`viewportWidth`, `viewportHeight`) so desktop and mobile clicks align accurately.
2. **Extend Schema & Covered Index (`src/models/Event.js` & API Routes):** Persist `xPct`, `yPct`, `viewportWidth`, and `viewportHeight` on `Event` documents and include `xPct` and `yPct` in the compound covered index `{ url: 1, eventType: 1, x: 1, y: 1, xPct: 1, yPct: 1 }`.
3. **HTML5 `<canvas>` Thermal Density Overlay + Live `<iframe>` Backdrop (`src/app/heatmap/page.jsx`):** Replace the grey placeholder box and individual DOM dot nodes with a live sandboxed `<iframe>` preview of the tracked URL overlaid with a hardware-accelerated HTML5 `<canvas>` thermal heatmap (Blue -> Cyan -> Green -> Yellow -> Red) and a toggleable Precision Pins view.

Do not ask for confirmation. Overwrite the files below with the exact contents provided and run the verification build at the end.

---

## Step 1: Upgrade Client Telemetry Script (`public/tracker.js`)

Overwrite `public/tracker.js` to capture scroll-aware document coordinates (`pageX`/`pageY`), normalized relative percentages (`xPct`/`yPct`), and viewport metadata:

```javascript
(() => {
  const getSessionId = () => {
    let id = localStorage.getItem("tracking_session_id");
    if (!id) {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
      ) {
        id = crypto.randomUUID();
      } else {
        id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      }
      localStorage.setItem("tracking_session_id", id);
    }
    return id;
  };

  const script = document.currentScript;
  const apiUrl =
    (script && script.getAttribute("data-api-url")) || "/api/events";
  const sessionId = getSessionId();

  const sendEvent = (eventType, additionalData = {}) => {
    const payload = {
      sessionId,
      eventType,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  };

  sendEvent("page_view");

  window.addEventListener("click", (event) => {
    const docEl = document.documentElement;
    const body = document.body;

    const scrollLeft = window.scrollX || docEl.scrollLeft || 0;
    const scrollTop = window.scrollY || docEl.scrollTop || 0;

    const pageX =
      event.pageX !== undefined ? event.pageX : event.clientX + scrollLeft;
    const pageY =
      event.pageY !== undefined ? event.pageY : event.clientY + scrollTop;

    const viewportWidth = window.innerWidth || docEl.clientWidth || 1;
    const viewportHeight = window.innerHeight || docEl.clientHeight || 1;

    const docWidth = Math.max(
      body ? body.scrollWidth : 0,
      docEl ? docEl.scrollWidth : 0,
      viewportWidth,
      1,
    );
    const docHeight = Math.max(
      body ? body.scrollHeight : 0,
      docEl ? docEl.scrollHeight : 0,
      viewportHeight,
      1,
    );

    const xPct = Number(
      Math.min(100, Math.max(0, (pageX / docWidth) * 100)).toFixed(2),
    );
    const yPct = Number(
      Math.min(100, Math.max(0, (pageY / docHeight) * 100)).toFixed(2),
    );

    sendEvent("click", {
      x: Math.round(pageX),
      y: Math.round(pageY),
      xPct,
      yPct,
      viewportWidth: Math.round(viewportWidth),
      viewportHeight: Math.round(viewportHeight),
    });
  });
})();
```

---

## Step 2: Update `Event` Schema & API Route Handlers

### 2.1 Overwrite `src/models/Event.js`

Write the following exact content to `src/models/Event.js`:

```javascript
import mongoose from "mongoose";

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

const eventSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: ["page_view", "click"],
  },
  url: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  x: {
    type: Number,
  },
  y: {
    type: Number,
  },
  xPct: {
    type: Number,
  },
  yPct: {
    type: Number,
  },
  viewportWidth: {
    type: Number,
  },
  viewportHeight: {
    type: Number,
  },
});

// Compound index enabling Covered Queries for both pixel and percentage coordinates
eventSchema.index({ url: 1, eventType: 1, x: 1, y: 1, xPct: 1, yPct: 1 });

// Compound index for chronological session timeline queries
eventSchema.index({ sessionId: 1, timestamp: 1 });

// TTL index to automatically expire raw telemetry events older than 30 days
eventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: THIRTY_DAYS_IN_SECONDS },
);

export const Event =
  mongoose.models.Event || mongoose.model("Event", eventSchema);
```

### 2.2 Overwrite `src/app/api/events/route.js`

Write the following exact content to `src/app/api/events/route.js`:

```javascript
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Session } from "@/models/Session";
import { Event } from "@/models/Event";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
    } = body;

    if (!sessionId || !eventType || !url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders },
      );
    }

    await connectToDatabase();

    const eventTimestamp = timestamp ? new Date(timestamp) : new Date();

    const [, event] = await Promise.all([
      Session.updateOne(
        { sessionId },
        {
          $setOnInsert: {
            sessionId,
            createdAt: eventTimestamp,
          },
          $max: { lastActiveAt: eventTimestamp },
          $inc: {
            eventCount: 1,
          },
        },
        {
          upsert: true,
          setDefaultsOnInsert: false,
        },
      ),
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
      }),
    ]);

    return NextResponse.json(event, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
```

### 2.3 Overwrite `src/app/api/events/heatmap/route.js`

Write the following exact content to `src/app/api/events/heatmap/route.js`:

```javascript
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
```

### 2.4 Overwrite `src/app/api/sessions/[sessionId]/events/route.js`

Write the following exact content to `src/app/api/sessions/[sessionId]/events/route.js`:

```javascript
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Event } from "@/models/Event";

export const dynamic = "force-dynamic";

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
      },
    )
      .sort({ timestamp: 1 })
      .limit(1000)
      .lean();

    return NextResponse.json(events, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Step 3: Upgrade Frontend Heatmap & Session Timeline Views

### 3.1 Overwrite `src/app/heatmap/page.jsx`

Write the following exact content to `src/app/heatmap/page.jsx` to implement the HTML5 `<canvas>` thermal density renderer, live sandboxed `<iframe>` backdrop, and view mode controls:

```jsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin,
  Search,
  RefreshCw,
  LayoutTemplate,
  Flame,
  Crosshair,
  Eye,
  EyeOff,
} from "lucide-react";

function resolveClickPosition(click, width, height) {
  const hasPct =
    typeof click.xPct === "number" &&
    typeof click.yPct === "number" &&
    !Number.isNaN(click.xPct) &&
    !Number.isNaN(click.yPct);

  if (hasPct) {
    return {
      px: (click.xPct / 100) * width,
      py: (click.yPct / 100) * height,
      leftStyle: click.xPct + "%",
      topStyle: click.yPct + "%",
      label:
        click.xPct.toFixed(1) +
        "%, " +
        click.yPct.toFixed(1) +
        "% (" +
        click.x +
        "px, " +
        click.y +
        "px)",
    };
  }

  const fallbackXPct = Math.min(
    100,
    Math.max(0, ((click.x || 0) / width) * 100),
  );
  const fallbackYPct = Math.min(
    100,
    Math.max(0, ((click.y || 0) / height) * 100),
  );

  return {
    px: click.x || 0,
    py: click.y || 0,
    leftStyle: fallbackXPct + "%",
    topStyle: fallbackYPct + "%",
    label: (click.x || 0) + "px, " + (click.y || 0) + "px",
  };
}

export default function HeatmapPage() {
  const [url, setUrl] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [clicks, setClicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("thermal");
  const [showBackdrop, setShowBackdrop] = useState(true);
  const [radius, setRadius] = useState(40);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const fetchHeatmap = async (targetUrl) => {
    if (!targetUrl) return;
    try {
      setLoading(true);
      const encodedUrl = encodeURIComponent(targetUrl);
      const response = await fetch("/api/events/heatmap?url=" + encodedUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch heatmap data");
      }
      const data = await response.json();
      setClicks(data);
      setActiveUrl(targetUrl);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const defaultUrl =
      typeof window !== "undefined"
        ? window.location.origin + "/tracker/index.html"
        : "http://localhost:3000/tracker/index.html";
    setUrl(defaultUrl);
    setActiveUrl(defaultUrl);
    fetchHeatmap(defaultUrl);
  }, []);

  const drawThermalCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 800;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (clicks.length === 0 || viewMode === "pins") return;

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = width;
    shadowCanvas.height = height;
    const shadowCtx = shadowCanvas.getContext("2d");
    if (!shadowCtx) return;

    clicks.forEach((click) => {
      const { px, py } = resolveClickPosition(click, width, height);
      const grad = shadowCtx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.35)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      shadowCtx.fillStyle = grad;
      shadowCtx.beginPath();
      shadowCtx.arc(px, py, radius, 0, Math.PI * 2);
      shadowCtx.fill();
    });

    const paletteCanvas = document.createElement("canvas");
    paletteCanvas.width = 256;
    paletteCanvas.height = 1;
    const paletteCtx = paletteCanvas.getContext("2d");
    const paletteGrad = paletteCtx.createLinearGradient(0, 0, 256, 0);
    paletteGrad.addColorStop(0.0, "#3b82f6");
    paletteGrad.addColorStop(0.25, "#06b6d4");
    paletteGrad.addColorStop(0.5, "#10b981");
    paletteGrad.addColorStop(0.75, "#facc15");
    paletteGrad.addColorStop(1.0, "#ef4444");
    paletteCtx.fillStyle = paletteGrad;
    paletteCtx.fillRect(0, 0, 256, 1);
    const paletteData = paletteCtx.getImageData(0, 0, 256, 1).data;

    const imgData = shadowCtx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    for (let i = 3; i < pixels.length; i += 4) {
      const alpha = pixels[i];
      if (alpha > 0) {
        const offset = alpha * 4;
        pixels[i - 3] = paletteData[offset];
        pixels[i - 2] = paletteData[offset + 1];
        pixels[i - 1] = paletteData[offset + 2];
        pixels[i] = Math.min(225, Math.max(45, Math.round(alpha * 0.9)));
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [clicks, viewMode, radius]);

  useEffect(() => {
    drawThermalCanvas();
    const handleResize = () => drawThermalCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawThermalCanvas]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchHeatmap(url);
  };

  const containerWidth = containerRef.current
    ? containerRef.current.clientWidth
    : 1000;
  const containerHeight = containerRef.current
    ? containerRef.current.clientHeight
    : 800;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Click Heatmap
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualize normalized spatial click density across responsive
            viewports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("thermal")}
              className={
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer " +
                (viewMode === "thermal"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              <Flame className="h-3.5 w-3.5" />
              Thermal
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pins")}
              className={
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer " +
                (viewMode === "pins"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              <Crosshair className="h-3.5 w-3.5" />
              Precision Pins
            </button>
            <button
              type="button"
              onClick={() => setViewMode("both")}
              className={
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer " +
                (viewMode === "both"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Both
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowBackdrop((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-sm cursor-pointer transition-all"
          >
            {showBackdrop ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                Hide Live Page
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-blue-600" />
                Show Live Page
              </>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LayoutTemplate className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter tracked URL (e.g. http://localhost:3000/tracker/index.html)"
            required
            className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all shadow-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-medium rounded-xl text-sm transition-all cursor-pointer shadow-sm"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Analyze URL
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center text-sm font-medium">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span>
              Active URL:{" "}
              <span className="text-slate-900">{activeUrl || url}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            {viewMode !== "pins" && (
              <div className="flex items-center gap-2">
                <span>Radius:</span>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-24 accent-blue-600 cursor-pointer"
                />
                <span className="text-slate-800">{radius}px</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span>Low</span>
              <div className="h-2.5 w-24 rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 via-yellow-400 to-red-500" />
              <span>High</span>
            </div>

            <div>
              <span>
                Coordinates Plotted:{" "}
                <span className="text-blue-600 font-bold">{clicks.length}</span>
              </span>
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative w-full h-[800px] bg-slate-900 rounded-xl border border-slate-300 overflow-hidden"
        >
          {showBackdrop && activeUrl && (
            <iframe
              src={activeUrl}
              title="Tracked Target Preview"
              sandbox="allow-same-origin"
              className="absolute inset-0 w-full h-full bg-white pointer-events-none select-none opacity-90"
            />
          )}

          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          />

          {(viewMode === "pins" || viewMode === "both") &&
            clicks.map((click, index) => {
              const pos = resolveClickPosition(
                click,
                containerWidth,
                containerHeight,
              );
              return (
                <div
                  key={index}
                  style={{
                    left: pos.leftStyle,
                    top: pos.topStyle,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-auto z-20"
                >
                  <div className="relative flex items-center justify-center">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-white shadow-sm"></span>

                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                      <div className="bg-slate-900 text-white text-[10px] font-mono rounded px-2 py-1 shadow-md whitespace-nowrap">
                        {pos.label}
                      </div>
                      <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1"></div>
                    </div>
                  </div>
                </div>
              );
            })}

          {clicks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900/75 backdrop-blur-xs z-30">
              <LayoutTemplate className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-white text-sm font-semibold">
                No recorded clicks for this URL
              </p>
              <p className="text-xs text-slate-300 mt-1 max-w-sm">
                Open the Tracker Site from the navigation bar and click around
                to populate spatial telemetry.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 3.2 Overwrite `src/app/sessions/[sessionId]/page.jsx`

Write the following exact content to `src/app/sessions/[sessionId]/page.jsx` to display the normalized relative percentages (`xPct`, `yPct`) and viewport dimensions alongside raw pixel coordinates:

```jsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Eye,
  MousePointer,
  RefreshCw,
  Layers,
  Monitor,
} from "lucide-react";

function TimelineEvent({ event, formatTime }) {
  const isPageView = event.eventType === "page_view";
  const badgeColor = isPageView
    ? "border-blue-500 text-blue-600 shadow-sm"
    : "border-emerald-500 text-emerald-600 shadow-sm";
  const labelColor = isPageView ? "text-blue-600" : "text-emerald-600";

  return (
    <div className="relative pl-8 sm:pl-10 group">
      <div
        className={
          "absolute -left-[17px] top-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all duration-200 " +
          badgeColor
        }
      >
        {isPageView ? (
          <Eye className="h-4 w-4" />
        ) : (
          <MousePointer className="h-3.5 w-3.5" />
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div>
          <span
            className={
              "text-xs font-bold uppercase tracking-wider " + labelColor
            }
          >
            {isPageView ? "Page View" : "Click Interaction"}
          </span>
          <h4 className="text-sm font-semibold text-slate-900 break-all mt-0.5">
            {event.url}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-1 sm:mt-0 whitespace-nowrap bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          {formatTime(event.timestamp)}
        </div>
      </div>

      {!isPageView && event.x !== undefined && event.y !== undefined && (
        <div className="mt-3 inline-flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-600">
          <div>
            <span className="text-emerald-600 font-bold">X:</span> {event.x}px
            {event.xPct !== undefined && (
              <span className="text-slate-400"> ({event.xPct}%)</span>
            )}
          </div>
          <div className="h-3 w-px bg-slate-200"></div>
          <div>
            <span className="text-emerald-600 font-bold">Y:</span> {event.y}px
            {event.yPct !== undefined && (
              <span className="text-slate-400"> ({event.yPct}%)</span>
            )}
          </div>
          {event.viewportWidth && event.viewportHeight && (
            <>
              <div className="h-3 w-px bg-slate-200"></div>
              <div className="flex items-center gap-1 text-slate-500">
                <Monitor className="h-3 w-3 text-slate-400" />
                <span>
                  {event.viewportWidth}x{event.viewportHeight}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const response = await fetch("/api/sessions/" + sessionId + "/events");
      if (!response.ok) {
        throw new Error("Failed to fetch session events");
      }
      const data = await response.json();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      dateStyle: "long",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 font-medium transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Sessions
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Session Details
            </h1>
            <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
              {sessionId}
            </span>
          </div>
          {events.length > 0 && (
            <p className="text-xs text-slate-500">
              Started on {formatDate(events[0].timestamp)}
            </p>
          )}
        </div>

        <button
          onClick={fetchEvents}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 self-start sm:self-center shadow-sm"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </button>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm mt-4 font-medium">
            Loading session timeline...
          </p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center text-sm font-medium">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 rounded-2xl text-center">
          <Layers className="h-12 w-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">
            No events found
          </h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            This session was created, but no telemetry events have been
            recorded.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="relative border-l-2 border-slate-200 ml-3 sm:ml-4 space-y-8 py-2">
            {events.map((event, index) => (
              <TimelineEvent
                key={event._id || index}
                event={event}
                formatTime={formatTime}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Step 4: Verify Production Build

Run the production build to confirm there are no syntax or compilation errors:

```bash
npm run build
```
