declare module '@mapbox/polyline' {
  /**
   * Decodes a polyline string into an array of coordinates
   * @param encoded - The encoded polyline string
   * @param precision - The precision factor (default: 5)
   * @returns Array of [latitude, longitude] coordinates
   */
  export function decode(encoded: string, precision?: number): Array<[number, number]>;

  /**
   * Encodes an array of coordinates into a polyline string
   * @param coordinates - Array of [latitude, longitude] coordinates
   * @param precision - The precision factor (default: 5)
   * @returns The encoded polyline string
   */
  export function encode(coordinates: Array<[number, number]>, precision?: number): string;
} 