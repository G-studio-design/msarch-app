// src/app/api/settings/attendance/route.ts
import { NextResponse } from 'next/server';
import { updateAttendanceSettings, type AttendanceSettings } from '@/services/settings-service';

export async function POST(request: Request) {
    try {
        const newSettings: AttendanceSettings = await request.json();
        const updatedSettings = await updateAttendanceSettings(newSettings);
        return NextResponse.json(updatedSettings);
    } catch (error: any) {
        console.error('[API/Settings/Attendance] Error:', error);
        return NextResponse.json({ error: 'Failed to update attendance settings.' }, { status: 500 });
    }
}
