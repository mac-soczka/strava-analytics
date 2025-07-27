import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-8">
      <main className="flex flex-col items-center gap-8 max-w-xl w-full">
        <Image
          src="/cycling-coach.svg"
          alt="StravaHeatmap Dashboard"
          width={120}
          height={120}
          className="mb-4"
        />
        <h1 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-2">
          StravaHeatmap
        </h1>
        <p className="text-lg text-center text-gray-700 dark:text-gray-300 mb-6">
          Visualize, compare, and celebrate your team&apos;s Strava performance. Built for athletes and teams who want to go beyond the basics.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <a
            href="/api/auth/login"
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-lg shadow transition-colors text-center"
          >
            Login with Strava
          </a>
          <Link
            href="/activities"
            className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Activities
          </Link>
          <Link
            href="/segments"
            className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Segments
          </Link>
          <Link
            href="/dashboard"
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-semibold py-3 px-8 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-center"
          >
            View Dashboard
          </Link>
        </div>
      </main>
      <footer className="mt-16 text-gray-400 text-xs text-center">
        Powered by Next.js · Not affiliated with Strava
      </footer>
    </div>
  );
}
