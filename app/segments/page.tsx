"use client";
import React, { useEffect, useState, useMemo } from "react";
import PolylineMap from "../components/PolylineMap";
import dynamic from "next/dynamic";

const LeafletSegmentMap = dynamic(() => import("../components/LeafletSegmentMap"), { ssr: false });
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, Area, ReferenceLine } from "recharts";

function formatDate(date: string) {
  return date.slice(0, 10);
}

function formatElapsedTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function SegmentsPage() {
  // Styling constants
  const cardClass = "bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 mb-8 border border-gray-100 dark:border-gray-800";
  const statClass = "inline-block px-3 py-1 bg-orange-50 dark:bg-gray-800 text-orange-600 dark:text-orange-400 rounded-full text-xs font-semibold mr-2 mb-2";

  const [sortByTimeAsc, setSortByTimeAsc] = useState<boolean | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [segmentInput, setSegmentInput] = useState<string>("");
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

  // Find the selected segment object
  const selectedSegment = useMemo(() => {
    return uniqueSegments.find(seg => String(seg.id) === selectedSegmentId) || null;
  }, [uniqueSegments, selectedSegmentId]);

  // Efforts for selected segment
  const efforts = useMemo(() => {
    return segments.filter((e) => String(e.segment?.id) === selectedSegmentId);
  }, [segments, selectedSegmentId]);

  // Calculate percentiles for each effort
  const effortsWithPercentile = useMemo(() => {
    if (efforts.length === 0) return [];
    // Lower elapsed_time is better
    const sorted = [...efforts].sort((a, b) => a.elapsed_time - b.elapsed_time);
    let effortsSorted = [...efforts];
    if (sortByTimeAsc !== null) {
      effortsSorted = [...efforts].sort((a, b) => sortByTimeAsc ? a.elapsed_time - b.elapsed_time : b.elapsed_time - a.elapsed_time);
    }
    return effortsSorted.map(effort => {
      const betterCount = sorted.filter(other => other.elapsed_time < effort.elapsed_time).length;
      const percentile = 100 * (betterCount / (sorted.length - 1 || 1));
      return { ...effort, percentile: Math.round(percentile) };
    });
  }, [efforts, sortByTimeAsc]);

  // Most recent effort
  const mostRecentEffort = useMemo(() => {
    if (efforts.length === 0) return null;
    return [...efforts].sort((a, b) => new Date(b.start_date_local || b.start_date).getTime() - new Date(a.start_date_local || a.start_date).getTime())[0];
  }, [efforts]);
  const mostRecentPercentile = mostRecentEffort ? effortsWithPercentile.find(e => e.id === mostRecentEffort.id)?.percentile : null;

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
      <div className={cardClass + " max-w-2xl mx-auto"}>
        <label htmlFor="segment-picker" className="block mb-2 font-semibold text-lg text-gray-800 dark:text-gray-100">Pick a segment</label>
        <div className="relative mb-2">
          <input
            id="segment-picker"
            className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg pr-10 text-base bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
            list="segments-list"
            placeholder="Search segments..."
            value={segmentInput}
            onChange={e => {
              setSegmentInput(e.target.value);
              const match = uniqueSegments.find(seg => (seg.name + (seg.city ? ` (${seg.city})` : "")) === e.target.value);
              if (match) {
                setSelectedSegmentId(String(match.id));
              } else {
                setSelectedSegmentId("");
              }
            }}
            onBlur={() => {
              const match = uniqueSegments.find(seg => (seg.name + (seg.city ? ` (${seg.city})` : "")) === segmentInput);
              if (!match) {
                setSelectedSegmentId("");
                setSegmentInput("");
              }
            }}
            autoComplete="off"
          />
          {segmentInput && (
            <button
              type="button"
              aria-label="Clear segment search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl focus:outline-none"
              onClick={() => {
                setSegmentInput("");
                setSelectedSegmentId("");
              }}
            >
              ×
            </button>
          )}
        </div>
        <datalist id="segments-list">
          {uniqueSegments.map((seg: any) => (
            <option key={seg.id} value={seg.name + (seg.city ? ` (${seg.city})` : "")}>{seg.name} ({seg.city || seg.state || seg.country || ''})</option>
          ))}
        </datalist>
      </div>
      {selectedSegmentId && efforts.length > 0 && (
        <div className={cardClass + " max-w-4xl mx-auto"}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{selectedSegment.name}</div>
              <div className="space-x-2">
                <span className="inline-block px-3 py-1 bg-orange-50 dark:bg-gray-800 text-orange-600 dark:text-orange-400 rounded-full text-xs font-semibold mr-2 mb-2"><b>Distance:</b> {(selectedSegment.distance / 1000).toFixed(2)} km</span>
                {efforts.length > 0 && (
                  <span className="inline-block px-3 py-1 bg-orange-50 dark:bg-gray-800 text-orange-600 dark:text-orange-400 rounded-full text-xs font-semibold mr-2 mb-2"><b>Total Efforts:</b> {efforts.length}</span>
                )}
              </div>
            </div>
            {mostRecentEffort && pr && mostRecentEffort.id !== pr.id && (
              <div className="flex-1 text-right">
                <span className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full text-xs font-semibold">
                  <b>Most Recent:</b> {formatElapsedTime(mostRecentEffort.elapsed_time)}, <b>Percentile:</b> {mostRecentPercentile}th
                </span>
              </div>
            )}
          </div>
          {selectedSegment.map?.polyline && (
            <div className="mb-6">
              <span className="block text-xs text-gray-500 mb-2">Segment map preview (interactive):</span>
              <LeafletSegmentMap polyline={selectedSegment.map.polyline} />
            </div>
          )}
          <div className="mb-10 border-2 border-orange-200 dark:border-orange-900 rounded-xl shadow-lg bg-white dark:bg-gray-900 p-4">
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={chartData} margin={{ left: 32, right: 32, top: 32, bottom: 64 }}>
                <defs>
                  <linearGradient id="elapsedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3}/>
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tickFormatter={(_date: string, idx: number) => {
                    const n = chartData.length > 30 ? 7 : chartData.length > 12 ? 3 : 1;
                    return idx % n === 0 ? _date : '';
                  }}
                  tick={{ fill: '#888', fontSize: 13 }}
                  axisLine={{ stroke: '#ffa500', strokeWidth: 2 }}
                />
                <YAxis yAxisId="left" label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', fill: '#8884d8' }} tick={{ fill: '#8884d8' }} axisLine={{ stroke: '#8884d8' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Speed (km/h)', angle: 90, position: 'insideRight', fill: '#82ca9d' }} tick={{ fill: '#82ca9d' }} axisLine={{ stroke: '#82ca9d' }} />
                <Tooltip formatter={(value: any, name: string) => name === 'Elapsed Time (s)' ? formatElapsedTime(value as number) : value} />
                <Legend verticalAlign="top" height={40} iconType="circle"/>
                {/* Area under lines for visual pop */}
                <Area yAxisId="left" type="monotone" dataKey="elapsed_time" stroke={"#8884d8"} fillOpacity={0.2} fill="url(#elapsedGradient)" name="Elapsed Time (s)" />
                <Area yAxisId="right" type="monotone" dataKey="speed" stroke={"#82ca9d"} fillOpacity={0.2} fill="url(#speedGradient)" name="Speed (km/h)" />
                <Line yAxisId="left" type="monotone" dataKey="elapsed_time" stroke="#8884d8" name="Elapsed Time (s)" dot={{ r: 4, fill: '#8884d8', stroke: '#fff', strokeWidth: 1.5 }} strokeWidth={3}/>
                <Line yAxisId="right" type="monotone" dataKey="speed" stroke="#82ca9d" name="Speed (km/h)" dot={{ r: 4, fill: '#82ca9d', stroke: '#fff', strokeWidth: 1.5 }} strokeWidth={3}/>
                {/* Reference line for PR */}
                {pr && <ReferenceLine yAxisId="left" y={pr.elapsed_time} stroke="#ffa500" strokeDasharray="6 2" label={{ value: 'PR', fill: '#ffa500', position: 'top', fontWeight: 700 }} />}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              <b>Best time:</b> {pr && selectedSegment ? `${formatElapsedTime(pr.elapsed_time)} @ ${(selectedSegment.distance / pr.elapsed_time * 3.6).toFixed(2)} km/h on ${formatDate(pr.start_date_local || pr.start_date)}` : 'N/A'}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">All Efforts</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white dark:bg-gray-800 border rounded">
                <thead>
                  <tr>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1 cursor-pointer select-none" onClick={() => setSortByTimeAsc(sortByTimeAsc === null ? true : !sortByTimeAsc)}>
                      Elapsed Time (min:s)
                      {sortByTimeAsc === true && <span title="Ascending"> ▲</span>}
                      {sortByTimeAsc === false && <span title="Descending"> ▼</span>}
                    </th>
                    <th className="px-2 py-1">Percentile</th>
                    <th className="px-2 py-1">Speed (km/h)</th>
                    <th className="px-2 py-1">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {effortsWithPercentile.map((e, i) => (
                    <tr key={e.id} className={pr && e.id === pr.id ? "bg-green-100 dark:bg-green-900" : mostRecentEffort && e.id === mostRecentEffort.id ? "bg-blue-50 dark:bg-blue-900" : ""}>
                      <td className="px-2 py-1">{formatDate(e.start_date_local || e.start_date)}</td>
                      <td className="px-2 py-1">{formatElapsedTime(e.elapsed_time)}</td>
                      <td className="px-2 py-1">{e.percentile !== undefined ? `${e.percentile}th` : ""}</td>
                      <td className="px-2 py-1">{e.segment?.distance && e.elapsed_time ? (e.segment.distance / e.elapsed_time * 3.6).toFixed(2) : ""}</td>
                      <td className="px-2 py-1">
                        <a href={`https://www.strava.com/activities/${e.activity?.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {selectedSegmentId && efforts.length === 0 && (
        <div className="mt-8 text-red-600">No efforts found for this segment.</div>
      )}
      {loading && <div className="mt-8">Loading segment data...</div>}
    </main>
  );
}
