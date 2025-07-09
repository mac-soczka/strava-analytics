import DashboardSummaryCards from "./DashboardSummaryCards";
import WeeklyLineChart from "./WeeklyLineChart";
import LeaderboardTable from "./LeaderboardTable";
import ActivitiesCharts from "../components/ActivitiesCharts";
import CalendarHeatmapStrava from "../components/CalendarHeatmapStrava";
import fs from "fs";
import path from "path";

export default function DashboardPage() {
  // Read activities.json at build time
  const activitiesPath = path.join(process.cwd(), "data", "activities.json");
  const activities = fs.existsSync(activitiesPath)
    ? JSON.parse(fs.readFileSync(activitiesPath, "utf8"))
    : [];

  // Mock data
  const summary = {
    mileage: 876,
    avgPower: 212,
    elevation: 11034,
  };
  const weeklyData = [
    { week: "2025-06-10", Alice: 120, Bob: 100, Carol: 80 },
    { week: "2025-06-17", Alice: 140, Bob: 130, Carol: 110 },
    { week: "2025-06-24", Alice: 160, Bob: 120, Carol: 140 },
    { week: "2025-07-01", Alice: 180, Bob: 150, Carol: 160 },
  ];
  const leaderboard = [
    { name: "Alice", mileage: 600, power: 220, elevation: 4000 },
    { name: "Bob", mileage: 500, power: 210, elevation: 3500 },
    { name: "Carol", mileage: 400, power: 200, elevation: 3000 },
  ];

  return (
    <main className="flex min-h-screen flex-col p-8 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-6">🚴‍♂️ Team Dashboard</h1>
      <CalendarHeatmapStrava activities={activities} />
      <ActivitiesCharts activities={activities} />
      <DashboardSummaryCards summary={summary} />

      <section>
        <LeaderboardTable data={leaderboard} />
      </section>
    </main>
  );
}
