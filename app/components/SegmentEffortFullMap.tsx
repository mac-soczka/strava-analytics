'use client'

import dynamic from 'next/dynamic'

const LeafletSegmentMap = dynamic(() => import('@/app/components/LeafletSegmentMap'), {
  ssr: false,
  loading: () => null,
})

type Props = {
  polyline: string
  testId?: string
  className?: string
}

export default function SegmentEffortFullMap({
  polyline,
  testId,
  className = 'w-full h-72 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shadow-sm',
}: Props) {
  return <LeafletSegmentMap polyline={polyline} testId={testId} className={className} />
}
