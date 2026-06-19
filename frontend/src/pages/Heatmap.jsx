import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { MapPin, Search, RefreshCw, LayoutTemplate } from 'lucide-react';

export default function Heatmap() {
  const [url, setUrl] = useState('http://localhost:3000/');
  const [clicks, setClicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHeatmap = async (targetUrl) => {
    if (!targetUrl) return;
    try {
      setLoading(true);
      const encodedUrl = encodeURIComponent(targetUrl);
      const response = await fetch(`${API_BASE_URL}/events/heatmap?url=${encodedUrl}`);
      if (!response.ok) {
        throw new Error('Failed to fetch heatmap data');
      }
      const data = await response.json();
      setClicks(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap(url);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchHeatmap(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Click Heatmap
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Visualize spatial click density coordinates across tracked target URLs.
        </p>
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
            placeholder="Enter tracked URL (e.g. http://localhost:3000/)"
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
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span>Active URL: <span className="text-slate-900">{url}</span></span>
          </div>
          <div>
            <span>Coordinates Plotted: <span className="text-blue-600 font-bold">{clicks.length}</span></span>
          </div>
        </div>

        <div className="relative w-full min-h-[800px] bg-slate-500 rounded-xl border border-dashed border-slate-700 overflow-hidden">
          {clicks.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <LayoutTemplate className="h-12 w-12 text-slate-500 mb-3" />
              <p className="text-slate-300 text-sm font-medium">No recorded clicks for this URL</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Ensure the tracker script matches this URL and you clicked within the page window.
              </p>
            </div>
          ) : (
            <>
              {clicks.map((click, index) => (
                <div
                  key={index}
                  style={{
                    left: click.x,
                    top: click.y
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
                >
                  <div className="relative flex items-center justify-center">
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>

                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                      <div className="bg-white border border-slate-200 text-slate-800 text-[10px] font-mono rounded px-2 py-1 shadow-sm whitespace-nowrap">
                        X: {click.x}px, Y: {click.y}px
                      </div>
                      <div className="w-1.5 h-1.5 bg-white border-r border-b border-slate-200 rotate-45 -mt-1"></div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
