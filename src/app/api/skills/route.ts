// API Route: GET /api/skills
// Returns available skills and their descriptions

import { NextResponse } from 'next/server';
import skillRegistry from '@/lib/skills/registry';

export async function GET() {
  return NextResponse.json({
    skills: skillRegistry.list(),
  });
}
