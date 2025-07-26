import { serverlessTrigger } from '@/lib/triggers/serverless-trigger'

export async function POST(req) {
  return serverlessTrigger(req)
}

export async function GET(req) {
  return serverlessTrigger(req)
} 