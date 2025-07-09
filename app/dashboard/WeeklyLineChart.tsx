"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface WeeklyLineChartProps {
  data: Array<{ week: string; [athlete: string]: number | string }>;
}

export default function WeeklyLineChart({ data }: WeeklyLineChartProps) {
  const athleteKeys = Object.keys(data[0] || {}).filter(k => k !== 'week');
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Weekly Progress</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="week" />
          <YAxis />
          <Tooltip />
          <Legend />
          {athleteKeys.map((athlete, idx) => (
            <Line key={athlete} type="monotone" dataKey={athlete} stroke={['#2563eb', '#16a34a', '#f59e42'][idx % 3]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
