import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDate(date: string | Date, pattern = 'd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: es });
}

export function getWeekDays(baseDate: Date): Date[] {
  const monday = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function getThreeDayWindow(startDate: Date): Date[] {
  return Array.from({ length: 3 }, (_, i) => addDays(startDate, i));
}

export function dayLabel(date: Date): string {
  return DAY_LABELS[(date.getDay() + 6) % 7];
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function formatPace(secondsPerKm: number): string {
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} min/km`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
