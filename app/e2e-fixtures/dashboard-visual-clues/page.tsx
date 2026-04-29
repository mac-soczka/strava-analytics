import { notFound } from 'next/navigation'
import DashboardVisualCluesE2eClient from './dashboard-visual-clues-e2e-client'

export default function DashboardVisualCluesFixturePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <DashboardVisualCluesE2eClient />
}
