"use client";
import React from "react";
import { decode } from "@mapbox/polyline";

// We'll use a simple SVG for the mini map preview
function getPolylinePoints(polyline: string, width = 120, height = 60, padding = 8) {
  const points = decode(polyline);
  if (!points.length) return "";
  // Find bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(([lat, lng]) => {
    minX = Math.min(minX, lng);
    minY = Math.min(minY, lat);
    maxX = Math.max(maxX, lng);
    maxY = Math.max(maxY, lat);
  });
  // Maintain aspect ratio
  const dataWidth = maxX - minX || 1;
  const dataHeight = maxY - minY || 1;
  const scale = Math.min((width - 2 * padding) / dataWidth, (height - 2 * padding) / dataHeight);
  // Centering offsets
  const xOffset = (width - scale * dataWidth) / 2;
  const yOffset = (height - scale * dataHeight) / 2;
  return points.map(([lat, lng]) => {
    const x = xOffset + (lng - minX) * scale;
    const y = height - (yOffset + (lat - minY) * scale); // invert y for SVG
    return `${x},${y}`;
  }).join(" ");
}

type PolylineMapProps = {
  polyline: string;
  href?: string;
};

export default function PolylineMap({ polyline, href }: PolylineMapProps) {
  const points = getPolylinePoints(polyline);
  if (!points) return null;
  const svg = (
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
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" title="View on Strava">{svg}</a>
  ) : svg;
}
