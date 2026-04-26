import { notFound } from 'next/navigation'
import RouteMapE2eClient from './route-map-e2e-client'

/**
 * Dev / CI-only fixtures for Playwright (polyline + Leaflet smoke).
 * Disabled in production builds so encoded routes are not exposed publicly.
 */
export default function E2eRouteMapFixturePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
  return <RouteMapE2eClient />
}
