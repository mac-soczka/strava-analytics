import React from "react";
import ActivitiesTable from "../components/ActivitiesTable";
import path from "path";
import fs from "fs";

// Server Component: read activities.json at build time
const activitiesPath = path.join(process.cwd(), "data", "activities.json");
const activities = fs.existsSync(activitiesPath)
  ? JSON.parse(fs.readFileSync(activitiesPath, "utf8"))
  : [];

export default function ActivitiesPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Strava Activities</h1>
      <ActivitiesTable activities={activities} />
    </div>
  );
}
