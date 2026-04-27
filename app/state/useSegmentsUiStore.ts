'use client'

import { create } from 'zustand'

type SegmentsUiState = {
  expandedSegmentId: number | null
  // eslint-disable-next-line no-unused-vars
  toggleExpandedSegmentId: (segmentId: number) => void
  collapseExpandedSegment: () => void
}

export const useSegmentsUiStore = create<SegmentsUiState>((set) => ({
  expandedSegmentId: null,
  toggleExpandedSegmentId: (segmentId) =>
    set((s) => ({ expandedSegmentId: s.expandedSegmentId === segmentId ? null : segmentId })),
  collapseExpandedSegment: () => set({ expandedSegmentId: null }),
}))

