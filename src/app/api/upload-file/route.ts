// src/app/api/upload-file/route.ts
// This endpoint is no longer used for streaming and is deprecated.
// The new reliable upload logic is handled by /api/upload/stream.
// This file will be deleted in a future step.

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Return an error indicating this endpoint is deprecated.
  return NextResponse.json(
    { message: 'This FormData-based upload endpoint is deprecated. Please use the streaming endpoint at /api/upload/stream.' },
    { status: 410 } // 410 Gone
  );
}
