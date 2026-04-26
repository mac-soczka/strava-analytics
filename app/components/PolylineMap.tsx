'use client'

import React from 'react'
import { decodeActivityPolyline, projectPolylineToSvgPoints } from '@/lib/geo/polyline'

type PolylineMapProps = {
  polyline: string
  href?: string
}

export default function PolylineMap({ polyline, href }: PolylineMapProps) {
  const geometry = decodeActivityPolyline(polyline)
  if (!geometry) return null
  const points = projectPolylineToSvgPoints(geometry.latlngs)
  if (!points) return null

  const svg = (
    <svg
      data-testid="activity-route-map-thumb"
      width={120}
      height={60}
      viewBox="0 0 120 60"
      className="rounded bg-gray-100 border shadow"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#f87171"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" title="View on Strava">
      {svg}
    </a>
  ) : (
    svg
  )
}
