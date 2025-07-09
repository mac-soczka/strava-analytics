interface LeaderboardTableProps {
  data: Array<{ name: string; mileage: number; power: number; elevation: number }>;
}

export default function LeaderboardTable({ data }: LeaderboardTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
      <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="py-2 px-4">Athlete</th>
            <th className="py-2 px-4">Mileage</th>
            <th className="py-2 px-4">Avg Power</th>
            <th className="py-2 px-4">Elevation</th>
          </tr>
        </thead>
        <tbody>
          {data.map((athlete) => (
            <tr key={athlete.name} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
              <td className="py-2 px-4 font-medium">{athlete.name}</td>
              <td className="py-2 px-4">{athlete.mileage} km</td>
              <td className="py-2 px-4">{athlete.power} W</td>
              <td className="py-2 px-4">{athlete.elevation} m</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
