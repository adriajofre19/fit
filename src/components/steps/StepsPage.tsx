import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { saveDailySteps } from '../../lib/steps';
import { todayISO, formatDate } from '../../lib/dates';
import { loadingClass, pageSubtitleClass, tabActiveClass, tabInactiveClass } from '../../lib/ui-classes';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LineChart } from '../charts/LineChart';
import type { DailyLog } from '../../types/database';
import { subDays, parseISO } from 'date-fns';

type Range = 'week' | 'month' | 'all';

export function StepsPage() {
  const [steps, setSteps] = useState('');
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [range, setRange] = useState<Range>('month');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const today = todayISO();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [todayRes, allRes] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('log_date', today).maybeSingle(),
      supabase
        .from('daily_logs')
        .select('*')
        .gt('steps_count', 0)
        .order('log_date', { ascending: true }),
    ]);

    if (todayRes.data) {
      setTodayLog(todayRes.data);
      if (todayRes.data.steps_count > 0) {
        setSteps(String(todayRes.data.steps_count));
      }
    } else {
      setTodayLog(null);
      setSteps('');
    }

    setLogs(allRes.data ?? []);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const value = parseInt(steps, 10);
    if (isNaN(value) || value < 0) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    await saveDailySteps(supabase, user.id, today, value);
    setSaving(false);
    await loadData();
  }

  const filteredLogs = filterByRange(logs, range);
  const chartData = filteredLogs.map((l) => ({
    date: l.log_date,
    label: formatDate(l.log_date, 'd/M'),
    value: l.steps_count,
  }));

  const weekDelta = computeDelta(logs, 7);
  const dayDelta = computeDayDelta(logs);

  if (loading) {
    return <div className={loadingClass}>Cargando...</div>;
  }

  const hasTodaySteps = (todayLog?.steps_count ?? 0) > 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">🚶 Pasos diarios</h1>
        <p className={pageSubtitleClass}>Registra cuántos pasos has dado hoy</p>
      </header>

      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label={`Pasos de hoy (${formatDate(today, 'd MMM')})`}
            type="number"
            min="0"
            step="1"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="10000"
            required
          />
          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? 'Guardando...' : hasTodaySteps ? 'Actualizar pasos' : 'Registrar pasos'}
          </Button>
        </form>
      </Card>

      {(weekDelta != null || dayDelta != null) && (
        <div className="grid grid-cols-2 gap-3">
          {dayDelta != null && (
            <Card className="text-center !py-4">
              <div className="text-xs text-muted-foreground">vs. ayer</div>
              <div className="text-xl font-semibold tabular-nums mt-1">
                {dayDelta > 0 ? '+' : ''}{dayDelta.toLocaleString()}
              </div>
            </Card>
          )}
          {weekDelta != null && (
            <Card className="text-center !py-4">
              <div className="text-xs text-muted-foreground">esta semana</div>
              <div className="text-xl font-semibold tabular-nums mt-1">
                {weekDelta > 0 ? '+' : ''}{weekDelta.toLocaleString()}
              </div>
            </Card>
          )}
        </div>
      )}

      <Card>
        <div className="flex gap-1 mb-4 p-1 bg-muted rounded-lg w-fit">
          {(['week', 'month', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                range === r ? tabActiveClass : tabInactiveClass,
              )}
            >
              {r === 'week' ? 'Semana' : r === 'month' ? 'Mes' : 'Todo'}
            </button>
          ))}
        </div>
        <LineChart data={chartData} unit="" color="#52525b" />
      </Card>
    </div>
  );
}

function filterByRange(logs: DailyLog[], range: Range): DailyLog[] {
  if (range === 'all') return logs;
  const days = range === 'week' ? 7 : 30;
  const cutoff = subDays(new Date(), days);
  return logs.filter((l) => parseISO(l.log_date) >= cutoff);
}

function computeDelta(logs: DailyLog[], days: number): number | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const latest = sorted[sorted.length - 1];
  const cutoff = subDays(parseISO(latest.log_date), days);
  const earlier = sorted.filter((l) => parseISO(l.log_date) <= cutoff);
  if (earlier.length === 0) return null;
  const ref = earlier[earlier.length - 1];
  return latest.steps_count - ref.steps_count;
}

function computeDayDelta(logs: DailyLog[]): number | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (prev.log_date >= latest.log_date) return null;
  return latest.steps_count - prev.steps_count;
}
