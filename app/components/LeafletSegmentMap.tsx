'use client'

import React, { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import './leaflet-style.css'
import { MapContainer, TileLayer, Polyline } from 'react-leaflet'
import { useMap } from 'react-leaflet/hooks'
import type { LatLngBoundsExpression, PathOptions } from 'leaflet'
import { decodeActivityPolyline } from '@/lib/geo/polyline'

const DEFAULT_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(bounds, { padding: [16, 16], maxZoom: 15 })
  }, [map, bounds])
  return null
}

export interface LeafletSegmentMapProps {
  polyline: string
  /** Raster tile URL template, e.g. OSM or MapTiler raster. */
  tileUrlTemplate?: string
  pathOptions?: PathOptions
  /** `data-testid` on the outer map wrapper. */
  testId?: string
  className?: string
}

export default function LeafletSegmentMap({
  polyline,
  tileUrlTemplate = DEFAULT_TILE,
  pathOptions = { color: '#f87171', weight: 5, opacity: 0.9 },
  testId = 'route-map-leaflet',
  className = 'w-full h-64 rounded overflow-hidden border shadow mb-4',
}: LeafletSegmentMapProps) {
  const geometry = decodeActivityPolyline(polyline)
  if (!geometry) return null

  const { latlngs, bounds } = geometry
  const center = latlngs[Math.floor(latlngs.length / 2)]
  const leafletBounds: LatLngBoundsExpression = [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ]

  return (
    <div className={className} data-testid={testId}>
      <MapContainer
        center={center as [number, number]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer url={tileUrlTemplate} />
        <FitBounds bounds={leafletBounds} />
        <Polyline positions={latlngs} pathOptions={pathOptions} />
      </MapContainer>
    </div>
  )
}
