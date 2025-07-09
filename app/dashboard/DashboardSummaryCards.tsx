interface SummaryProps {
  summary: {
    mileage: number;
    avgPower: number;
    elevation: number;
  };
}

export default function DashboardSummaryCards({ summary }: SummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col items-center">
        <span className="text-gray-500">Total Mileage</span>
        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.mileage} km</span>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col items-center">
        <span className="text-gray-500">Avg Power</span>
        <span className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.avgPower} W</span>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col items-center">
        <span className="text-gray-500">Elevation Gain</span>
        <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{summary.elevation} m</span>
      </div>
    </div>
  );
}
