"use client";
import React from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";

// Helper to get YYYY-MM-DD from date string
function toDay(dateStr: string) {
  return dateStr.slice(0, 10);
}

type Activity = {
  id: number;
  start_date_local: string;
  distance: number;
};

type Props = {
  activities: Activity[];
};

export default function CalendarHeatmapStrava({ activities }: Props) {
  // Aggregate by day
  const dayMap: { [day: string]: { count: number; distance: number } } = {};
  activities.forEach((a) => {
    const day = toDay(a.start_date_local);
    if (!dayMap[day]) dayMap[day] = { count: 0, distance: 0 };
    dayMap[day].count += 1;
    dayMap[day].distance += a.distance;
  });
  const values = Object.entries(dayMap).map(([date, { count, distance }]) => ({
    date,
    count,
    distance: +(distance / 1000).toFixed(1), // km
  }));
  // Group values by year
  const valuesByYear: { [year: string]: typeof values } = {};
  values.forEach((v) => {
    const year = v.date.slice(0, 4);
    if (!valuesByYear[year]) valuesByYear[year] = [];
    valuesByYear[year].push(v);
  });
  const years = Object.keys(valuesByYear).sort();

  return (
    <div className="my-8">
      <h2 className="text-xl font-semibold mb-4">Activity Calendar Heatmap</h2>
      {years.map((year) => (
        <div key={year} className="mb-10">
          <h3 className="text-lg font-bold mb-2">{year}</h3>
          <CalendarHeatmap
            startDate={`${year}-01-01`}
            endDate={`${year}-12-31`}
            values={valuesByYear[year]}
            classForValue={(v) => {
              if (!v) return "color-empty";
              if (v.count >= 5) return "color-github-4";
              if (v.count >= 3) return "color-github-3";
              if (v.count >= 2) return "color-github-2";
              if (v.count >= 1) return "color-github-1";
              return "color-empty";
            }}
            tooltipDataAttrs={(v: unknown) => {
              const value = v as { date?: string; count?: number; distance?: number } | null;
              if (!value || !value.date) return { "data-tip": "No activity" };
              return {
                "data-tip": `${value.date}: ${value.count} activit${value.count === 1 ? "y" : "ies"} (${value.distance} km)`
              };
            }}
            showWeekdayLabels
          />
        </div>
      ))}
      <style>{`
        .react-calendar-heatmap .color-empty { fill: #ebedf0; }
        .react-calendar-heatmap .color-github-1 { fill: #c6e48b; }
        .react-calendar-heatmap .color-github-2 { fill: #7bc96f; }
        .react-calendar-heatmap .color-github-3 { fill: #239a3b; }
        .react-calendar-heatmap .color-github-4 { fill: #196127; }
      `}</style>
    </div>
  );
}
