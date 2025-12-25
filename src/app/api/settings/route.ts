
// src/app/api/settings/route.ts
import { NextResponse } from 'next/server';
import { getAppSettings } from '@/services/settings-service';
import { getAllHolidays } from '@/services/holiday-service';

export async function GET(request: Request) {
    try {
        // We can combine multiple data sources into one settings endpoint
        const [settings, holidays] = await Promise.all([
          getAppSettings(),
          getAllHolidays()
        ]);
        
        return NextResponse.json({ ...settings, holidays });
    } catch (error: any) {
        console.error('[API/Settings GET] Error:', error);
        return NextResponse.json({ message: "Failed to fetch app settings and holidays." }, { status: 500 });
    }
}
