# User Analytics Platform (Serverless Next.js Architecture)

A full-stack serverless user analytics platform engineered to track real-time client-side interactions (page views and spatial click coordinates) and aggregate telemetry data into a business intelligence dashboard.

---

## Tech Stack

- **Architecture:** Unified Next.js (App Router) Serverless Application
- **Ingestion Layer:** Vanilla JavaScript IIFE (`public/tracker.js`) with `keepalive` support
- **Serverless API Layer:** Next.js Route Handlers (`src/app/api/...`)
- **Database Layer:** MongoDB with Global Cached Mongoose Connection Pooling (`src/lib/mongodb.js`)
- **Visualization Interface:** React 19, Tailwind CSS v4, Lucide Icons

---

## Directory Structure

- `public/tracker.js` — Client Ingestion Script (Telemetry Pixel)
- `public/tracker/index.html` — Integrated Telemetry Demo Environment
- `src/lib/mongodb.js` — Global Cached MongoDB Connection Singleton
- `src/models/` — Mongoose Schemas (`Session.js`, `Event.js`)
- `src/app/api/` — Serverless API Route Handlers (`events`, `heatmap`, `sessions`, `health`)
- `src/app/` — Next.js App Router Dashboard Pages (`page.jsx`, `sessions/[sessionId]/page.jsx`, `heatmap/page.jsx`)

---

## Local Setup & Execution

1. **Install Dependencies:**
   Run `npm install` at the repository root.

2. **Configure Environment (`.env.local`):**
   Define `MONGO_URI=mongodb://127.0.0.1:27017/user_analytics` inside `.env.local`.

3. **Start Development Server:**
   Run `npm run dev` and open `http://localhost:3000` for the dashboard or `http://localhost:3000/tracker/index.html` for the telemetry demo page.
