"use client";
import React from "react";
import PolylineMap from "./PolylineMap";

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, "0")).join(":");
}

type Activity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  type: string;
  start_date_local: string;
  map?: { summary_polyline?: string };
};

type Props = {
  activities: Activity[];
};

export default function ActivitiesTable({ activities }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg shadow">
      <table className="min-w-full bg-white dark:bg-gray-900">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Distance</th>
            <th className="px-4 py-2 text-left">Time</th>
            <th className="px-4 py-2 text-left">Elev Gain</th>
            <th className="px-4 py-2 text-left">Type</th>
            <th className="px-4 py-2 text-left">Map</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr key={a.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-2 whitespace-nowrap">{new Date(a.start_date_local).toLocaleDateString()}</td>
              <td className="px-4 py-2">{a.name}</td>
              <td className="px-4 py-2">{(a.distance / 1000).toFixed(1)} km</td>
              <td className="px-4 py-2">{formatTime(a.moving_time)}</td>
              <td className="px-4 py-2">{a.total_elevation_gain} m</td>
              <td className="px-4 py-2">{a.type}</td>
              <td className="px-4 py-2">
                {a.map?.summary_polyline ? (
                  <PolylineMap polyline={a.map.summary_polyline} />
                ) : (
                  <span className="text-gray-400">No Map</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {activities.length === 0 && (
        <div className="mt-8 text-center text-gray-500">No activities found.</div>
      )}
    </div>
  );
}
