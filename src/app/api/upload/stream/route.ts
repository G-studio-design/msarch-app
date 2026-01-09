// src/app/api/upload/stream/route.ts
// This endpoint is no longer used for streaming and is deprecated.
// The new reliable upload logic is handled by /api/upload-file.
// This file will be deleted in a future step.

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Return an error indicating this endpoint is deprecated.
  return NextResponse.json(
    { message: 'This streaming upload endpoint is deprecated. Please use the FormData-based endpoint at /api/upload-file.' },
    { status: 410 } // 410 Gone
  );
}
