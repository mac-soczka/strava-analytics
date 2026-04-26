'use client'

import dynamic from 'next/dynamic'
import PolylineMap from '@/app/components/PolylineMap'

const LeafletSegmentMap = dynamic(() => import('@/app/components/LeafletSegmentMap'), { ssr: false })

/** Same golden encoding as `tests/integration/polyline-geometry.test.ts`. */
const FIXTURE_POLYLINE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'

export default function RouteMapE2eClient() {
  return (
    <div className="p-8 space-y-8 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">E2E route map fixtures</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Development-only page for Playwright. No auth or Strava.
      </p>
      <section data-testid="fixture-section-thumb">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">SVG thumbnail</h2>
        <PolylineMap polyline={FIXTURE_POLYLINE} />
      </section>
      <section data-testid="fixture-section-leaflet">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Leaflet</h2>
        <LeafletSegmentMap polyline={FIXTURE_POLYLINE} />
      </section>
      <section data-testid="fixture-section-null-polyline">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Empty polyline</h2>
        <p data-testid="no-route-label" className="text-gray-500">
          No map below (component returns null — page should not crash).
        </p>
        <PolylineMap polyline="" />
      </section>
    </div>
  )
}
