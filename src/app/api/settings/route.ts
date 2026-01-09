// src/app/api/settings/route.ts
import { NextResponse } from 'next/server';
import { getAppSettings } from '@/services/settings-service';

export async function GET(request: Request) {
    try {
        const settings = await getAppSettings();
        return NextResponse.json(settings);
    } catch (error: any) {
        console.error('[API/Settings GET] Error:', error);
        return NextResponse.json({ message: "Failed to fetch app settings." }, { status: 500 });
    }
}
