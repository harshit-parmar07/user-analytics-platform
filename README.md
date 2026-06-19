# CausalFunnel - User Analytics Application

This repository contains a full-stack User Analytics Application built to track user interactions on web pages (such as page views and clicks) and provide a dashboard for analyzing this data through session logs and spatial heatmaps.

## Tech Stack

* **Architecture:** MERN Monorepo (MongoDB, Express, React, Node.js)
* **Frontend Dashboard:** React (Vite) with Tailwind CSS v4
* **Backend API:** Node.js with Express and Mongoose
* **Client Tracker:** Vanilla JS IIFE (Immediately Invoked Function Expression)

## Setup Instructions

Follow these steps to run the application locally.

### 1. Prerequisites
Ensure you have Node.js and MongoDB installed on your system.

### 2. Install Dependencies
You need to install dependencies for both the frontend and backend workspaces.
```bash
# From the root directory:

# Install Backend dependencies
cd backend
npm install

# Install Frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Variables
You need to set up environment variables for both the backend and frontend.

**Backend (`backend/.env`)**
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/user_analytics
```

**Frontend (`frontend/.env`)**
Create a `.env` file in the `frontend/` directory (if required by your config, e.g., using Vite conventions):
```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Run the Application
Start the backend and frontend servers.

**Start the Backend:**
```bash
cd backend
npm start
# or npm run dev
```

**Start the Frontend:**
```bash
cd frontend
npm run dev
```

**Test the Tracker:**
To test the tracking functionality, open `tracker/index.html` in your browser. Ensure the backend is running on port 5000, as the script expects the API to be available there.

## Assumptions and Engineering Trade-offs

### 1. Schema Design: Separated Event and Session Schemas
Instead of embedding all event data within a single Session document, we deliberately separated `Event` and `Session` into two distinct MongoDB collections. 

**Why?**
MongoDB has a strict 16MB document size limit. If we embedded events inside a session document, a long-lived user session with thousands of clicks and interactions would inevitably cause the document to hit this limit, leading to application crashes and data loss. By separating them and linking via `sessionId`, we ensure infinite scalability for individual sessions while keeping document sizes small and write operations extremely fast.

### 2. Tracker Portability: Vanilla JS IIFE with Dynamic Attributes
The tracking script (`tracker/tracker.js`) is written as a Vanilla JavaScript Immediately Invoked Function Expression (IIFE) rather than a bundled React/NPM module.

**Why?**
A tracking script must be lightweight, universally compatible, and isolated from the host page's environment. Using an IIFE ensures that our script does not pollute the global namespace or conflict with the client's existing JavaScript. Furthermore, we implemented dynamic configuration via the `data-api-url` attribute (`<script src="tracker.js" data-api-url="..."></script>`). This makes the script completely portable and environment-agnostic; clients can point the tracker to staging or production environments simply by changing the HTML attribute, without needing to recompile or modify the core tracker code.
