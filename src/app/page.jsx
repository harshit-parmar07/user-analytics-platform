"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Activity,
  MousePointerClick,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

function SessionTableRow({ session, formatDate, router }) {
  return (
    <tr
      onClick={() => router.push("/sessions/" + session.sessionId)}
      className="hover:bg-slate-50 transition-colors cursor-pointer group"
    >
      <td className="px-6 py-4 font-mono text-xs text-blue-600 group-hover:text-blue-700">
        {session.sessionId}
      </td>
      <td className="px-6 py-4 text-slate-600 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          {formatDate(session.createdAt)}
        </div>
      </td>
      <td className="px-6 py-4 text-slate-600 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          {formatDate(session.lastActiveAt || session.createdAt)}
        </div>
      </td>
      <td className="px-6 py-4 text-slate-600">
        <div className="flex items-center gap-2">
          <MousePointerClick className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-xs bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 text-slate-700">
            {session.eventCount ?? 0} events
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all inline-block" />
      </td>
    </tr>
  );
}

export default function SessionsListPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/sessions");
      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }
      const data = await response.json();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            User Sessions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor real-time interactive user analytics session events.
          </p>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </button>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm mt-4 font-medium">
            Retrieving active sessions...
          </p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center text-sm font-medium">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 rounded-2xl text-center">
          <Clock className="h-12 w-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">
            No sessions yet
          </h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            Telemetry events will populate here once a user visits the tracked
            page.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-4">
                    Session Identifier
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Started At
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Last Active
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Total Recorded Events
                  </th>
                  <th scope="col" className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sessions.map((session) => (
                  <SessionTableRow
                    key={session.sessionId}
                    session={session}
                    formatDate={formatDate}
                    router={router}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
