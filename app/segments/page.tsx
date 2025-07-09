"use client";
import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

function formatDate(date: string) {
  return date.slice(0, 10);
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<any[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/segments")
      .then((res) => res.json())
      .then((data) => {
        setSegments(data);
        setLoading(false);
      });
  }, []);

  // Get unique segments
  const uniqueSegments = useMemo(() => {
    const seen = new Map();
    for (const effort of segments) {
      const seg = effort.segment;
      if (seg && !seen.has(seg.id)) {
        seen.set(seg.id, seg);
      }
    }
    return Array.from(seen.values());
  }, [segments]);

  // Efforts for selected segment
  const efforts = useMemo(() => {
    return segments.filter((e) => String(e.segment?.id) === selectedSegmentId);
  }, [segments, selectedSegmentId]);

  // Chart data: sorted by date
  const chartData = useMemo(() => {
    return efforts
      .map((e) => ({
        date: formatDate(e.start_date_local || e.start_date),
        elapsed_time: e.elapsed_time,
        speed: e.segment?.distance && e.elapsed_time ? +(e.segment.distance / e.elapsed_time * 3.6).toFixed(2) : null, // km/h
        distance: e.segment?.distance ? +(e.segment.distance / 1000).toFixed(2) : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [efforts]);

  // Best effort (fastest time)
  const pr = useMemo(() => {
    return efforts.reduce((best, e) => (!best || e.elapsed_time < best.elapsed_time ? e : best), null);
  }, [efforts]);

  return (
    <main className="flex flex-col min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-6">Strava Segments</h1>
      <div className="mb-6">
        <label htmlFor="segment-picker" className="block mb-2 font-semibold">Pick a segment:</label>
        <input
          id="segment-picker"
          className="w-full p-2 border rounded mb-2"
          list="segments-list"
          placeholder="Search segments..."
          value={selectedSegmentId}
          onChange={e => setSelectedSegmentId(e.target.value)}
        />
        <datalist id="segments-list">
          {uniqueSegments.map((seg: any) => (
            <option key={seg.id} value={seg.id}>{seg.name} ({seg.city || seg.state || seg.country || ''})</option>
          ))}
        </datalist>
      </div>
      {selectedSegmentId && efforts.length > 0 && (
        <>
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-2">Progress for: {uniqueSegments.find(s => String(s.id) === selectedSegmentId)?.name}</h2>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ left: 16, right: 16, top: 16, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                <YAxis yAxisId="left" label={{ value: 'Time (s)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Speed (km/h)', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="elapsed_time" stroke="#8884d8" name="Elapsed Time (s)" />
                <Line yAxisId="right" type="monotone" dataKey="speed" stroke="#82ca9d" name="Speed (km/h)" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              <b>Best time:</b> {pr ? `${(pr.elapsed_time/60).toFixed(2)} min @ ${(pr.segment.distance/pr.elapsed_time*3.6).toFixed(2)} km/h on ${formatDate(pr.start_date_local || pr.start_date)}` : 'N/A'}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">All Efforts</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white dark:bg-gray-800 border rounded">
                <thead>
                  <tr>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Elapsed Time (s)</th>
                    <th className="px-2 py-1">Speed (km/h)</th>
                    <th className="px-2 py-1">Distance (km)</th>
                    <th className="px-2 py-1">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {efforts.map((e, i) => (
                    <tr key={e.id} className={pr && e.id === pr.id ? "bg-green-100 dark:bg-green-900" : ""}>
                      <td className="px-2 py-1">{formatDate(e.start_date_local || e.start_date)}</td>
                      <td className="px-2 py-1">{e.elapsed_time}</td>
                      <td className="px-2 py-1">{e.segment?.distance && e.elapsed_time ? (e.segment.distance / e.elapsed_time * 3.6).toFixed(2) : ""}</td>
                      <td className="px-2 py-1">{e.segment?.distance ? (e.segment.distance / 1000).toFixed(2) : ""}</td>
                      <td className="px-2 py-1">
                        <a href={`https://www.strava.com/activities/${e.activity?.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {selectedSegmentId && efforts.length === 0 && (
        <div className="mt-8 text-red-600">No efforts found for this segment.</div>
      )}
      {loading && <div className="mt-8">Loading segment data...</div>}
    </main>
  );
}
