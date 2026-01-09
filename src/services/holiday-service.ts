// src/services/holiday-service.ts
'use server';

import * as path from 'path';
import { readDb } from '@/lib/database-utils';

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd());
const DB_PATH = path.join(DB_BASE_PATH, 'database', 'holidays.json');

export interface HolidayEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: "National Holiday" | "Religious Holiday" | "Company Event" | "Other";
  description?: string;
}

export async function getAllHolidays(): Promise<HolidayEntry[]> {
  const holidays = await readDb<HolidayEntry[]>(DB_PATH, []);
  return holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
