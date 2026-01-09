// src/app/api/attendance/check-in/route.ts
import { NextResponse } from 'next/server';
import { checkIn, type CheckInData } from '@/services/attendance-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const data: CheckInData = await request.json();

    if (!data.userId || !data.username || !data.displayName) {
        return NextResponse.json({ error: 'Missing user information.' }, { status: 400 });
    }
    
    // Geolocation must be passed from the client
    if (!data.location) {
        return NextResponse.json({ error: 'Location data is required for check-in.' }, { status: 400 });
    }

    const result = await checkIn(data);

    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.record, { status: 200 });

  } catch (error: any) {
    console.error('[API/CheckIn] Error:', error);
    return NextResponse.json({ error: 'An unexpected server error occurred during check-in.' }, { status: 500 });
  }
}
