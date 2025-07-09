"use client";
import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line
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

// Helper to get ISO week string (YYYY-Www)
function getISOWeek(dateStr: string) {
  const date = new Date(dateStr);
  // Set to nearest Thursday: current date + 4 - current day number
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
}

function getDistancePerWeek(activities: Activity[]) {
  const weekMap: { [week: string]: number } = {};
  activities.forEach((a) => {
    const week = getISOWeek(a.start_date_local);
    weekMap[week] = (weekMap[week] || 0) + a.distance;
  });
  return Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, distance]) => ({
      week,
      distance: +(distance / 1000).toFixed(1),
    }));
}

export default function ActivitiesCharts({ activities }: Props) {
  const monthly = getDistancePerMonth(activities);
  const weekly = getDistancePerWeek(activities);
  return (
    <div className="my-8">
      <h2 className="text-xl font-semibold mb-4">Distance per Month</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={monthly} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis label={{ value: 'km', angle: -90, position: 'insideLeft', offset: 8 }} />
          <Tooltip formatter={(v) => `${v} km`} />
          <Legend />
          <Bar dataKey="distance" fill="#60a5fa" name="Distance (km)" />
        </BarChart>
      </ResponsiveContainer>
      <h2 className="text-xl font-semibold mb-4 mt-12">Weekly Progress</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={weekly} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" angle={-35} textAnchor="end" dy={10} height={60} />
          <YAxis label={{ value: 'km', angle: -90, position: 'insideLeft', offset: 8 }} />
          <Tooltip formatter={(v) => `${v} km`} />
          <Legend />
          <Line type="monotone" dataKey="distance" stroke="#f59e42" strokeWidth={3} dot={true} name="Distance (km)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
