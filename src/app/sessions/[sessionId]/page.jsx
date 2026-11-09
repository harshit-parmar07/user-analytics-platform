'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  Eye,
  MousePointer,
  RefreshCw,
  Layers,
  Monitor,
  Flame,
  AlertTriangle,
  Code,
  ShieldCheck,
  Type,
} from 'lucide-react';

function getEventConfig(eventType) {
  if (eventType === 'rage_click') {
    return {
      label: 'Rage Click Detected',
      badgeColor: 'border-red-500 text-red-600 bg-red-50 shadow-sm',
      labelColor: 'text-red-600',
      cardBg: 'bg-red-50/50 border border-red-200 rounded-xl p-4',
      Icon: Flame,
    };
  }
  if (eventType === 'dead_click') {
    return {
      label: 'Dead Click (No DOM/URL Response)',
      badgeColor: 'border-amber-500 text-amber-600 bg-amber-50 shadow-sm',
      labelColor: 'text-amber-600',
      cardBg: 'bg-amber-50/50 border border-amber-200 rounded-xl p-4',
      Icon: AlertTriangle,
    };
  }
  if (eventType === 'page_view') {
    return {
      label: 'Page View',
      badgeColor: 'border-blue-500 text-blue-600 bg-white shadow-sm',
      labelColor: 'text-blue-600',
      cardBg: '',
      Icon: Eye,
    };
  }
  return {
    label: 'Click Interaction',
    badgeColor: 'border-emerald-500 text-emerald-600 bg-white shadow-sm',
    labelColor: 'text-emerald-600',
    cardBg: '',
    Icon: MousePointer,
  };
}

function TimelineEvent({ event, formatTime }) {
  const isPageView = event.eventType === 'page_view';
  const config = getEventConfig(event.eventType);
  const Icon = config.Icon;

  return (
    <div className="relative pl-8 sm:pl-10 group">
      <div
        className={
          'absolute -left-[17px] top-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 ' +
          config.badgeColor
        }
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className={config.cardBg}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={'text-xs font-bold uppercase tracking-wider ' + config.labelColor}>
                {config.label}
              </span>
              {event.eventType === 'rage_click' && event.clickCount && (
                <span className="text-[11px] font-mono font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
                  {event.clickCount} rapid clicks &lt;1s
                </span>
              )}
              {event.isRedacted && (
                <span className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  PII Masked
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-slate-900 break-all mt-0.5">
              {event.url}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-1 sm:mt-0 whitespace-nowrap bg-white border border-slate-200 px-2.5 py-1 rounded-md">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {formatTime(event.timestamp)}
          </div>
        </div>

        {!isPageView && event.x !== undefined && event.y !== undefined && (
          <div className="mt-3 space-y-2">
            <div className="inline-flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-600">
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

            {(event.targetSelector || event.targetText) && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                {event.targetSelector && (
                  <div className="flex items-center gap-1.5 font-mono text-slate-700 break-all">
                    <Code className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span>{event.targetSelector}</span>
                  </div>
                )}
                {event.targetText && (
                  <div className="flex items-center gap-1.5 text-slate-600 sm:ml-auto font-sans">
                    <Type className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span
                      className={
                        event.isRedacted
                          ? 'font-mono text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded'
                          : 'italic text-slate-700'
                      }
                    >
                      &ldquo;{event.targetText}&rdquo;
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
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
      const response = await fetch('/api/sessions/' + sessionId + '/events');
      if (!response.ok) {
        throw new Error('Failed to fetch session events');
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
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      dateStyle: 'long',
    });
  };

  const rageCount = events.filter((e) => e.eventType === 'rage_click').length;
  const deadCount = events.filter((e) => e.eventType === 'dead_click').length;
  const redactedCount = events.filter((e) => e.isRedacted).length;

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
            {rageCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">
                <Flame className="h-3.5 w-3.5 text-red-500" />
                {rageCount} Rage {rageCount === 1 ? 'Click' : 'Clicks'}
              </span>
            )}
            {deadCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                {deadCount} Dead {deadCount === 1 ? 'Click' : 'Clicks'}
              </span>
            )}
            {redactedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {redactedCount} PII Masked
              </span>
            )}
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
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </button>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm mt-4 font-medium">Loading session timeline...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center text-sm font-medium">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 rounded-2xl text-center">
          <Layers className="h-12 w-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No events found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            This session was created, but no telemetry events have been recorded.
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
