'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './leaflet-style.css'
import { MapContainer, TileLayer, Polyline } from 'react-leaflet'
import { useMap } from 'react-leaflet/hooks'
import type { LatLngBoundsExpression, PathOptions } from 'leaflet'
import { decodeActivityPolyline } from '@/lib/geo/polyline'
import { useMapStore } from '@/app/state/useMapStore'
import PolylineMap from '@/app/components/PolylineMap'

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

class MapRenderBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  override componentDidUpdate(prevProps: { children: React.ReactNode }) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false })
    }
  }

  override render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export default function LeafletSegmentMap({
  polyline,
  tileUrlTemplate,
  pathOptions = { color: '#f87171', weight: 5, opacity: 0.9 },
  testId = 'route-map-leaflet',
  className = 'w-full h-64 rounded overflow-hidden border shadow mb-4',
}: LeafletSegmentMapProps) {
  const storeTileUrlTemplate = useMapStore((s) => s.tileUrlTemplate)
  const effectiveTileUrlTemplate = tileUrlTemplate ?? storeTileUrlTemplate
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [isMapReadyToMount, setIsMapReadyToMount] = useState(false)
  const [isLeafletReady, setIsLeafletReady] = useState(false)

  const geometry = decodeActivityPolyline(polyline)

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return

    let rafId: number | null = null
    const updateReadyState = () => {
      const connected = element.isConnected
      const hasSize = element.clientWidth > 0 && element.clientHeight > 0
      setIsMapReadyToMount(connected && hasSize)
    }

    updateReadyState()
    rafId = window.requestAnimationFrame(updateReadyState)

    const resizeObserver = new ResizeObserver(() => updateReadyState())
    resizeObserver.observe(element)

    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      setIsMapReadyToMount(false)
    }
  }, [polyline, className])

  useEffect(() => {
    if (!isMapReadyToMount) setIsLeafletReady(false)
  }, [isMapReadyToMount])

  if (!geometry) return null

  const { latlngs, bounds } = geometry
  const center = latlngs[Math.floor(latlngs.length / 2)]
  const leafletBounds: LatLngBoundsExpression = [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ]

  const fallback = (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
      <PolylineMap polyline={polyline} />
    </div>
  )

  return (
    <div ref={wrapperRef} className={className} data-testid={testId}>
      {isMapReadyToMount ? (
        <MapRenderBoundary fallback={fallback}>
          <MapContainer
            center={center as [number, number]}
            zoom={13}
            scrollWheelZoom={false}
            style={{ width: '100%', height: '100%' }}
            whenReady={() => setIsLeafletReady(true)}
          >
            {isLeafletReady ? (
              <>
                <TileLayer url={effectiveTileUrlTemplate} />
                <FitBounds bounds={leafletBounds} />
                <Polyline positions={latlngs} pathOptions={pathOptions} />
              </>
            ) : null}
          </MapContainer>
        </MapRenderBoundary>
      ) : null}
    </div>
  )
}
