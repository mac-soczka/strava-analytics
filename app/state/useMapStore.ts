'use client'

import { create } from 'zustand'

const DEFAULT_TILE_URL_TEMPLATE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

type MapState = {
  tileUrlTemplate: string
  // eslint-disable-next-line no-unused-vars
  setTileUrlTemplate: (tileUrlTemplate: string) => void
}

export const useMapStore = create<MapState>((set) => ({
  tileUrlTemplate: DEFAULT_TILE_URL_TEMPLATE,
  setTileUrlTemplate: (tileUrlTemplate) => set({ tileUrlTemplate }),
}))

