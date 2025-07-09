"use client";
import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Activity = {
  id: number;
  distance: number;
  start_date_local: string;
};

type Props = {
  activities: Activity[];
};

// Group activities by month and sum distance
function getDistancePerMonth(activities: Activity[]) {
  const monthMap: { [month: string]: number } = {};
  activities.forEach((a) => {
    const month = a.start_date_local.slice(0, 7); // YYYY-MM
    monthMap[month] = (monthMap[month] || 0) + a.distance;
  });
  // Sort by month ascending
  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, distance]) => ({
      month,
      distance: +(distance / 1000).toFixed(1), // km
    }));
}

export default function ActivitiesCharts({ activities }: Props) {
  const data = getDistancePerMonth(activities);
  return (
    <div className="my-8">
      <h2 className="text-xl font-semibold mb-4">Distance per Month</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis label={{ value: 'km', angle: -90, position: 'insideLeft', offset: 8 }} />
          <Tooltip formatter={(v) => `${v} km`} />
          <Legend />
          <Bar dataKey="distance" fill="#60a5fa" name="Distance (km)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
