import DashboardSummaryCards from "./DashboardSummaryCards";
import WeeklyLineChart from "./WeeklyLineChart";
import LeaderboardTable from "./LeaderboardTable";

export default function DashboardPage() {
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
      <DashboardSummaryCards summary={summary} />
      <section className="my-8">
        <WeeklyLineChart data={weeklyData} />
      </section>
      <section>
        <LeaderboardTable data={leaderboard} />
      </section>
    </main>
  );
}
