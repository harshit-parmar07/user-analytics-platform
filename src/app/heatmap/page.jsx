'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Search,
  RefreshCw,
  LayoutTemplate,
  Flame,
  Crosshair,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';

function resolveClickPosition(click, width, height) {
  const hasPct =
    typeof click.xPct === 'number' &&
    typeof click.yPct === 'number' &&
    !Number.isNaN(click.xPct) &&
    !Number.isNaN(click.yPct);

  const prefix =
    click.eventType === 'rage_click'
      ? '[RAGE] '
      : click.eventType === 'dead_click'
      ? '[DEAD] '
      : '';
  const selectorSuffix = click.targetSelector ? ' on ' + click.targetSelector : '';

  if (hasPct) {
    return {
      px: (click.xPct / 100) * width,
      py: (click.yPct / 100) * height,
      leftStyle: click.xPct + '%',
      topStyle: click.yPct + '%',
      label:
        prefix +
        click.xPct.toFixed(1) +
        '%, ' +
        click.yPct.toFixed(1) +
        '%' +
        selectorSuffix,
    };
  }

  const fallbackXPct = Math.min(100, Math.max(0, ((click.x || 0) / width) * 100));
  const fallbackYPct = Math.min(100, Math.max(0, ((click.y || 0) / height) * 100));

  return {
    px: click.x || 0,
    py: click.y || 0,
    leftStyle: fallbackXPct + '%',
    topStyle: fallbackYPct + '%',
    label: prefix + (click.x || 0) + 'px, ' + (click.y || 0) + 'px' + selectorSuffix,
  };
}

export default function HeatmapPage() {
  const [url, setUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const [clicks, setClicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('both');
  const [eventFilter, setEventFilter] = useState('all');
  const [showBackdrop, setShowBackdrop] = useState(true);
  const [radius, setRadius] = useState(40);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const fetchHeatmap = async (targetUrl) => {
    if (!targetUrl) return;
    try {
      setLoading(true);
      const encodedUrl = encodeURIComponent(targetUrl);
      const response = await fetch('/api/events/heatmap?url=' + encodedUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch heatmap data');
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
      typeof window !== 'undefined'
        ? window.location.origin + '/tracker/index.html'
        : 'http://localhost:3000/tracker/index.html';
    setUrl(defaultUrl);
    setActiveUrl(defaultUrl);
    fetchHeatmap(defaultUrl);
  }, []);

  const filteredClicks = clicks.filter((c) => {
    if (eventFilter === 'frustration') {
      return c.eventType === 'rage_click' || c.eventType === 'dead_click';
    }
    return true;
  });

  const drawThermalCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 800;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (filteredClicks.length === 0 || viewMode === 'pins') return;

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = width;
    shadowCanvas.height = height;
    const shadowCtx = shadowCanvas.getContext('2d');
    if (!shadowCtx) return;

    filteredClicks.forEach((click) => {
      const { px, py } = resolveClickPosition(click, width, height);
      const weight =
        click.eventType === 'rage_click'
          ? 0.85
          : click.eventType === 'dead_click'
          ? 0.6
          : 0.35;
      const grad = shadowCtx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, 'rgba(0, 0, 0, ' + weight + ')');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      shadowCtx.fillStyle = grad;
      shadowCtx.beginPath();
      shadowCtx.arc(px, py, radius, 0, Math.PI * 2);
      shadowCtx.fill();
    });

    const paletteCanvas = document.createElement('canvas');
    paletteCanvas.width = 256;
    paletteCanvas.height = 1;
    const paletteCtx = paletteCanvas.getContext('2d');
    const paletteGrad = paletteCtx.createLinearGradient(0, 0, 256, 0);
    paletteGrad.addColorStop(0.0, '#3b82f6');
    paletteGrad.addColorStop(0.25, '#06b6d4');
    paletteGrad.addColorStop(0.5, '#10b981');
    paletteGrad.addColorStop(0.75, '#facc15');
    paletteGrad.addColorStop(1.0, '#ef4444');
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
  }, [filteredClicks, viewMode, radius]);

  useEffect(() => {
    drawThermalCanvas();
    const handleResize = () => drawThermalCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawThermalCanvas]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchHeatmap(url);
  };

  const containerWidth = containerRef.current ? containerRef.current.clientWidth : 1000;
  const containerHeight = containerRef.current ? containerRef.current.clientHeight : 800;

  const rageTotal = clicks.filter((c) => c.eventType === 'rage_click').length;
  const deadTotal = clicks.filter((c) => c.eventType === 'dead_click').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Click &amp; Frustration Heatmap
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualize normalized click density and pinpoint Rage &amp; Dead Click hotspots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setEventFilter('all')}
              className={
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ' +
                (eventFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900')
              }
            >
              All Signals ({clicks.length})
            </button>
            <button
              type="button"
              onClick={() => setEventFilter('frustration')}
              className={
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ' +
                (eventFilter === 'frustration'
                  ? 'bg-red-600 text-white'
                  : 'text-red-600 hover:bg-red-50')
              }
            >
              <Flame className="h-3.5 w-3.5" />
              Frustration Only ({rageTotal + deadTotal})
            </button>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('thermal')}
              className={
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ' +
                (viewMode === 'thermal'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900')
              }
            >
              <Flame className="h-3.5 w-3.5" />
              Thermal
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pins')}
              className={
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ' +
                (viewMode === 'pins'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900')
              }
            >
              <Crosshair className="h-3.5 w-3.5" />
              Pins
            </button>
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ' +
                (viewMode === 'both'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900')
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span>
                Active URL: <span className="text-slate-900">{activeUrl || url}</span>
              </span>
            </div>
            {rageTotal > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-sans font-semibold">
                <Flame className="h-3 w-3 text-red-500" />
                {rageTotal} Rage
              </span>
            )}
            {deadTotal > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-sans font-semibold">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                {deadTotal} Dead
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6">
            {viewMode !== 'pins' && (
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
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <span>Click</span>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 ml-2"></span>
              <span>Dead</span>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600 ml-2"></span>
              <span>Rage</span>
            </div>

            <div>
              <span>
                Plotted:{' '}
                <span className="text-blue-600 font-bold">{filteredClicks.length}</span>
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

          {(viewMode === 'pins' || viewMode === 'both') &&
            filteredClicks.map((click, index) => {
              const pos = resolveClickPosition(click, containerWidth, containerHeight);
              const isRage = click.eventType === 'rage_click';
              const isDead = click.eventType === 'dead_click';
              const pinClass = isRage
                ? 'h-4 w-4 bg-red-600 ring-2 ring-white animate-pulse'
                : isDead
                ? 'h-3.5 w-3.5 bg-amber-500 ring-2 ring-white'
                : 'h-3 w-3 bg-emerald-500 ring-2 ring-white';

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
                    <span className={'relative inline-flex rounded-full shadow-sm ' + pinClass}></span>

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

          {filteredClicks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900/75 backdrop-blur-xs z-30">
              <LayoutTemplate className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-white text-sm font-semibold">
                No matching signals for this URL
              </p>
              <p className="text-xs text-slate-300 mt-1 max-w-sm">
                Open the Tracker Demo site and test the red Unresponsive Checkout button or static Promo Badge.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
