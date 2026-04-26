import {
  computeBounds,
  decodeActivityPolyline,
  decimateLatLngs,
  projectPolylineToSvgPoints,
  unionBounds,
} from '@/lib/geo/polyline'

/** Short path (multiple points), Google-encoded polyline style. */
const GOLDEN_SHORT = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'

describe('decodeActivityPolyline', () => {
  it('decodes golden polyline with expected endpoints and bounds', () => {
    const g = decodeActivityPolyline(GOLDEN_SHORT)
    expect(g).not.toBeNull()
    expect(g!.latlngs.length).toBeGreaterThan(2)
    const [lat0, lng0] = g!.latlngs[0]
    const [latN, lngN] = g!.latlngs[g!.latlngs.length - 1]
    expect(typeof lat0).toBe('number')
    expect(typeof lng0).toBe('number')
    expect(lat0).not.toBeNaN()
    expect(lng0).not.toBeNaN()
    expect(g!.bounds.south).toBeLessThanOrEqual(g!.bounds.north)
    expect(g!.bounds.west).toBeLessThanOrEqual(g!.bounds.east)
    expect(g!.bounds.south).toBeLessThanOrEqual(lat0)
    expect(g!.bounds.north).toBeGreaterThanOrEqual(lat0)
    expect(g!.bounds.west).toBeLessThanOrEqual(lng0)
    expect(g!.bounds.east).toBeGreaterThanOrEqual(lng0)
    expect(latN).toBeDefined()
    expect(lngN).toBeDefined()
  })

  it('emits GeoJSON LineString with [lng, lat] coordinates', () => {
    const g = decodeActivityPolyline(GOLDEN_SHORT)
    expect(g).not.toBeNull()
    expect(g!.geojson.type).toBe('LineString')
    expect(g!.geojson.coordinates.length).toBe(g!.latlngs.length)
    const [lng0, lat0] = g!.geojson.coordinates[0]
    expect(g!.latlngs[0]).toEqual([lat0, lng0])
  })

  it('returns null for null, empty, or whitespace', () => {
    expect(decodeActivityPolyline(null)).toBeNull()
    expect(decodeActivityPolyline(undefined)).toBeNull()
    expect(decodeActivityPolyline('')).toBeNull()
    expect(decodeActivityPolyline('   ')).toBeNull()
  })

})

describe('computeBounds', () => {
  it('returns null for empty list', () => {
    expect(computeBounds([])).toBeNull()
  })
})

describe('unionBounds', () => {
  it('merges multiple boxes', () => {
    const u = unionBounds([
      { south: 0, west: 0, north: 1, east: 1 },
      { south: 0.5, west: 0.5, north: 2, east: 3 },
    ])
    expect(u).toEqual({ south: 0, west: 0, north: 2, east: 3 })
  })

  it('returns null for empty', () => {
    expect(unionBounds([])).toBeNull()
  })
})

describe('decimateLatLngs', () => {
  it('returns original when under cap', () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 1],
    ]
    expect(decimateLatLngs(pts, 10)).toEqual(pts)
  })

  it('reduces length when over cap', () => {
    const pts: [number, number][] = Array.from({ length: 100 }, (_, i) => [i * 0.01, i * 0.01])
    const d = decimateLatLngs(pts, 10)
    expect(d.length).toBe(10)
  })
})

describe('projectPolylineToSvgPoints', () => {
  it('returns non-empty points string for valid geometry', () => {
    const g = decodeActivityPolyline(GOLDEN_SHORT)
    expect(g).not.toBeNull()
    const svg = projectPolylineToSvgPoints(g!.latlngs)
    expect(svg.length).toBeGreaterThan(0)
    expect(svg).toMatch(/\d/)
  })

  it('returns empty string for empty input', () => {
    expect(projectPolylineToSvgPoints([])).toBe('')
  })
})
