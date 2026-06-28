import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { todayISO, formatDate } from '../../lib/dates';
import { loadingClass, pageSubtitleClass, tabActiveClass, tabInactiveClass } from '../../lib/ui-classes';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LineChart } from '../charts/LineChart';
import type { WeightLog } from '../../types/database';
import { subDays, parseISO } from 'date-fns';

type Range = 'week' | 'month' | 'all';

export function WeightPage() {
  const [weight, setWeight] = useState('');
  const [todayLog, setTodayLog] = useState<WeightLog | null>(null);
  const [logs, setLogs] = useState<WeightLog[]>([]);
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
      supabase.from('weight_logs').select('*').eq('log_date', today).maybeSingle(),
      supabase.from('weight_logs').select('*').order('log_date', { ascending: true }),
    ]);

    if (todayRes.data) {
      setTodayLog(todayRes.data);
      setWeight(String(todayRes.data.weight_kg));
    }
    setLogs(allRes.data ?? []);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(weight);
    if (isNaN(value) || value <= 0) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const payload = { user_id: user.id, log_date: today, weight_kg: value };

    if (todayLog) {
      await supabase.from('weight_logs').update({ weight_kg: value }).eq('id', todayLog.id);
    } else {
      await supabase.from('weight_logs').insert(payload);
    }

    setSaving(false);
    await loadData();
  }

  const filteredLogs = filterByRange(logs, range);
  const chartData = filteredLogs.map((l) => ({
    date: l.log_date,
    label: formatDate(l.log_date, 'd/M'),
    value: Number(l.weight_kg),
  }));

  const weekDelta = computeDelta(logs, 7);
  const dayDelta = computeDayDelta(logs);

  if (loading) {
    return <div className={loadingClass}>Cargando...</div>;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">⚖️ Control de peso</h1>
        <p className={pageSubtitleClass}>Registra tu peso en ayunas cada mañana</p>
      </header>

      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label={`Peso de hoy (${formatDate(today, 'd MMM')})`}
            type="number"
            step="0.1"
            min="30"
            max="300"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="78.5"
            required
          />
          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? 'Guardando...' : todayLog ? 'Actualizar peso' : 'Registrar peso'}
          </Button>
        </form>
      </Card>

      {(weekDelta != null || dayDelta != null) && (
        <div className="grid grid-cols-2 gap-3">
          {dayDelta != null && (
            <Card className="text-center !py-4">
              <div className="text-xs text-muted-foreground">vs. ayer</div>
              <div className="text-xl font-semibold tabular-nums mt-1">
                {dayDelta > 0 ? '+' : ''}{dayDelta.toFixed(1)} kg
              </div>
            </Card>
          )}
          {weekDelta != null && (
            <Card className="text-center !py-4">
              <div className="text-xs text-muted-foreground">esta semana</div>
              <div className="text-xl font-semibold tabular-nums mt-1">
                {weekDelta > 0 ? '+' : ''}{weekDelta.toFixed(1)} kg
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
        <LineChart data={chartData} unit=" kg" />
      </Card>
    </div>
  );
}

function filterByRange(logs: WeightLog[], range: Range): WeightLog[] {
  if (range === 'all') return logs;
  const days = range === 'week' ? 7 : 30;
  const cutoff = subDays(new Date(), days);
  return logs.filter((l) => parseISO(l.log_date) >= cutoff);
}

function computeDelta(logs: WeightLog[], days: number): number | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const latest = sorted[sorted.length - 1];
  const cutoff = subDays(parseISO(latest.log_date), days);
  const earlier = sorted.filter((l) => parseISO(l.log_date) <= cutoff);
  if (earlier.length === 0) return null;
  const ref = earlier[earlier.length - 1];
  return Number(latest.weight_kg) - Number(ref.weight_kg);
}

function computeDayDelta(logs: WeightLog[]): number | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (prev.log_date >= latest.log_date) return null;
  return Number(latest.weight_kg) - Number(prev.weight_kg);
}
