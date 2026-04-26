import { decode } from '@mapbox/polyline'

/** Axis-aligned bounds in WGS84 (lat/lng). */
export type RouteBounds = {
  south: number
  west: number
  north: number
  east: number
}

/** GeoJSON LineString: coordinates are [lng, lat] per RFC 7946. */
export type RouteLineString = {
  type: 'LineString'
  coordinates: [number, number][]
}

/** Decoded route suitable for Leaflet (lat, lng), GeoJSON exporters, and bounds fitting. */
export type RouteGeometry = {
  latlngs: [number, number][]
  bounds: RouteBounds
  geojson: RouteLineString
}

export function computeBounds(latlngs: [number, number][]): RouteBounds | null {
  if (!latlngs.length) return null
  let south = Infinity
  let west = Infinity
  let north = -Infinity
  let east = -Infinity
  for (const [lat, lng] of latlngs) {
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    west = Math.min(west, lng)
    east = Math.max(east, lng)
  }
  return { south, west, north, east }
}

/**
 * Decode a Strava/Google encoded polyline from DB or API.
 * Returns null for missing, empty, or invalid input.
 */
export function decodeActivityPolyline(encoded: string | null | undefined): RouteGeometry | null {
  if (encoded == null || typeof encoded !== 'string' || encoded.trim() === '') {
    return null
  }
  let latlngs: [number, number][]
  try {
    const decoded = decode(encoded) as [number, number][]
    if (!decoded.length) return null
    latlngs = decoded.map((p) => [Number(p[0]), Number(p[1])])
  } catch {
    return null
  }
  const bounds = computeBounds(latlngs)
  if (!bounds) return null
  const coordinates = latlngs.map(([lat, lng]) => [lng, lat] as [number, number])
  const geojson: RouteLineString = {
    type: 'LineString',
    coordinates,
  }
  return { latlngs, bounds, geojson }
}

/** Union bounds for multi-route maps (Phase 3). */
export function unionBounds(boxes: RouteBounds[]): RouteBounds | null {
  if (!boxes.length) return null
  let south = Infinity
  let west = Infinity
  let north = -Infinity
  let east = -Infinity
  for (const b of boxes) {
    south = Math.min(south, b.south)
    west = Math.min(west, b.west)
    north = Math.max(north, b.north)
    east = Math.max(east, b.east)
  }
  return { south, west, north, east }
}

/**
 * Evenly sample points for long routes (cheap alternative to Douglas–Peucker).
 */
export function decimateLatLngs(latlngs: [number, number][], maxPoints: number): [number, number][] {
  if (maxPoints < 2 || latlngs.length <= maxPoints) return latlngs
  const step = (latlngs.length - 1) / (maxPoints - 1)
  const out: [number, number][] = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(latlngs.length - 1, Math.round(i * step))
    out.push(latlngs[idx])
  }
  return out
}

/**
 * Project WGS84 lat/lngs into SVG `points` for a fixed viewBox (north-up).
 */
export function projectPolylineToSvgPoints(
  latlngs: [number, number][],
  width = 120,
  height = 60,
  padding = 8
): string {
  if (!latlngs.length) return ''
  const b = computeBounds(latlngs)
  if (!b) return ''
  const { west: minLng, south: minLat, east: maxLng, north: maxLat } = b
  const dataWidth = maxLng - minLng || 1
  const dataHeight = maxLat - minLat || 1
  const scale = Math.min(
    (width - 2 * padding) / dataWidth,
    (height - 2 * padding) / dataHeight
  )
  const xOffset = (width - scale * dataWidth) / 2
  const yOffset = (height - scale * dataHeight) / 2
  return latlngs
    .map(([lat, lng]) => {
      const x = xOffset + (lng - minLng) * scale
      const y = height - (yOffset + (lat - minLat) * scale)
      return `${x},${y}`
    })
    .join(' ')
}
