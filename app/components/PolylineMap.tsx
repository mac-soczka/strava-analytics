"use client";
import React from "react";
import { decode } from "@mapbox/polyline";

// We'll use a simple SVG for the mini map preview
function getPolylinePoints(polyline: string, width = 120, height = 60, padding = 8) {
  const points = decode(polyline);
  if (!points.length) return "";
  // Normalize to fit SVG
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(([lat, lng]) => {
    minX = Math.min(minX, lng);
    minY = Math.min(minY, lat);
    maxX = Math.max(maxX, lng);
    maxY = Math.max(maxY, lat);
  });
  const scaleX = (width - 2 * padding) / (maxX - minX || 1);
  const scaleY = (height - 2 * padding) / (maxY - minY || 1);
  return points.map(([lat, lng]) => {
    const x = padding + (lng - minX) * scaleX;
    const y = height - (padding + (lat - minY) * scaleY); // invert y for SVG
    return `${x},${y}`;
  }).join(" ");
}

export default function PolylineMap({ polyline }: { polyline: string }) {
  const points = getPolylinePoints(polyline);
  if (!points) return null;
  return (
    <svg width={120} height={60} viewBox="0 0 120 60" className="rounded bg-gray-100 border shadow">
      <polyline
        points={points}
        fill="none"
        stroke="#f87171"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
