// API route: /api/segments
// Returns all segment efforts, or filters by ?segment_id=xxx

import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const SEGMENTS_DIR = path.join(process.cwd(), 'data', 'segments');

async function loadAllSegments() {
  const files = await fs.readdir(SEGMENTS_DIR);
  let allEfforts = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(SEGMENTS_DIR, file), 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        allEfforts = allEfforts.concat(data);
      }
    } catch (err) {
      // ignore corrupt files
    }
  }
  return allEfforts;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const segmentId = searchParams.get('segment_id');
  const allEfforts = await loadAllSegments();
  if (segmentId) {
    const filtered = allEfforts.filter(e => String(e.segment?.id) === String(segmentId));
    return NextResponse.json(filtered);
  }
  return NextResponse.json(allEfforts);
}
