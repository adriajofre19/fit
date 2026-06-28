import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { todayISO, formatDate, formatPace, formatDuration } from '../../lib/dates';
import {
  loadingClass,
  pageSubtitleClass,
  selectClass,
  tabActiveClass,
  tabInactiveClass,
} from '../../lib/ui-classes';
import { cn } from '../../lib/utils';
import { CARDIO_WORKOUT_LABELS } from '../../lib/tasks';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LineChart } from '../charts/LineChart';
import type { CardioSession } from '../../types/database';
import { startOfWeek, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';

type CardioWorkoutType = keyof typeof CARDIO_WORKOUT_LABELS;
type Tab = 'log' | 'history' | 'charts';

// TODO: integración Strava OAuth + webhook de actividades
// Conectar aquí el flujo OAuth y el handler de webhook para upsert con source='strava'

export function CardioPage() {
  const [tab, setTab] = useState<Tab>('log');
  const [type, setType] = useState<CardioWorkoutType>('long_run');
  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [filterType, setFilterType] = useState<CardioWorkoutType | 'all'>('all');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [longRun, setLongRun] = useState({ distance_km: '', duration_min: '' });
  const [intervals, setIntervals] = useState({
    interval_count: '6',
    interval_distance_m: '400',
    from_interval: '1',
    to_interval: '6',
    rest_seconds: '90',
  });
  const [yoyo, setYoyo] = useState({ level: '', shuttles: '' });

  const supabase = createSupabaseBrowserClient();
  const today = todayISO();

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    const { data } = await supabase
      .from('cardio_sessions')
      .select('*')
      .neq('type', 'daily_steps')
      .order('session_date', { ascending: false })
      .limit(100);
    setSessions(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    let details: Record<string, number> = {};

    if (type === 'long_run') {
      const durationSeconds = Math.round(parseFloat(longRun.duration_min) * 60);
      const distance = parseFloat(longRun.distance_km);
      details = {
        distance_km: distance,
        duration_seconds: durationSeconds,
        avg_pace_seconds_per_km: durationSeconds / distance,
      };
    } else if (type === 'intervals') {
      details = {
        interval_count: Number(intervals.interval_count),
        interval_distance_m: Number(intervals.interval_distance_m),
        from_interval: Number(intervals.from_interval),
        to_interval: Number(intervals.to_interval),
        rest_seconds: Number(intervals.rest_seconds),
      };
    } else {
      details = { level: Number(yoyo.level), shuttles: Number(yoyo.shuttles) };
    }

    await supabase.from('cardio_sessions').insert({
      user_id: user.id,
      session_date: today,
      type,
      source: 'manual',
      details,
    });

    setSaving(false);
    await loadSessions();
  }

  const filtered =
    filterType === 'all' ? sessions : sessions.filter((s) => s.type === filterType);

  const weeklyDistance = computeWeeklyDistance(sessions);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'log', label: 'Registrar' },
    { id: 'history', label: 'Historial' },
    { id: 'charts', label: 'Gráficas' },
  ];

  if (loading) return <div className={loadingClass}>Cargando...</div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">🏃 Entrenos cardio</h1>
        <p className={pageSubtitleClass}>Running, series e intervalos</p>
      </header>

      <div className="flex gap-1 overflow-x-auto pb-1 p-1 bg-muted rounded-lg w-fit max-w-full">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.id ? tabActiveClass : tabInactiveClass,
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <div className="space-y-4">
          <Card>
            <label className="block text-sm font-medium text-foreground mb-2">Tipo de entreno</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CardioWorkoutType)}
              className={selectClass}
            >
              {Object.entries(CARDIO_WORKOUT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Card>

          {type === 'long_run' && (
            <Card className="space-y-4">
              <Input label="Distancia (km)" type="number" step="0.1" value={longRun.distance_km} onChange={(e) => setLongRun({ ...longRun, distance_km: e.target.value })} />
              <Input label="Duración (minutos)" type="number" value={longRun.duration_min} onChange={(e) => setLongRun({ ...longRun, duration_min: e.target.value })} />
            </Card>
          )}

          {type === 'intervals' && (
            <Card className="space-y-4">
              <Input label="Nº de series" type="number" value={intervals.interval_count} onChange={(e) => setIntervals({ ...intervals, interval_count: e.target.value })} />
              <Input label="Distancia por serie (m)" type="number" value={intervals.interval_distance_m} onChange={(e) => setIntervals({ ...intervals, interval_distance_m: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="De serie" type="number" value={intervals.from_interval} onChange={(e) => setIntervals({ ...intervals, from_interval: e.target.value })} />
                <Input label="A serie" type="number" value={intervals.to_interval} onChange={(e) => setIntervals({ ...intervals, to_interval: e.target.value })} />
              </div>
              <Input label="Descanso (seg)" type="number" value={intervals.rest_seconds} onChange={(e) => setIntervals({ ...intervals, rest_seconds: e.target.value })} />
            </Card>
          )}

          {type === 'yoyo_test' && (
            <Card className="space-y-4">
              <Input label="Nivel alcanzado" type="number" step="0.5" value={yoyo.level} onChange={(e) => setYoyo({ ...yoyo, level: e.target.value })} />
              <Input label="Shuttles completados" type="number" value={yoyo.shuttles} onChange={(e) => setYoyo({ ...yoyo, shuttles: e.target.value })} />
            </Card>
          )}

          <Button size="lg" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar entreno'}
          </Button>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as CardioWorkoutType | 'all')}
            className={selectClass}
          >
            <option value="all">Todos los tipos</option>
            {Object.entries(CARDIO_WORKOUT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {filtered.length === 0 && <p className="text-muted-foreground text-center py-8 text-sm">Sin entrenos</p>}
          {filtered.map((s) => (
            <Card key={s.id} className="!py-4">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-medium">{CARDIO_WORKOUT_LABELS[s.type as CardioWorkoutType]}</div>
                  <div className="text-sm text-muted-foreground">{formatDate(s.session_date)}</div>
                </div>
                {s.source === 'strava' && (
                  <span className="text-xs bg-secondary text-secondary-foreground border border-border px-2 py-0.5 rounded-full">Strava</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">{formatSessionSummary(s)}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'charts' && (
        <Card>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Distancia semanal (km)</h3>
          <LineChart data={weeklyDistance} unit=" km" />
        </Card>
      )}
    </div>
  );
}

function formatSessionSummary(s: CardioSession): string {
  const d = s.details as Record<string, number>;
  switch (s.type) {
    case 'long_run':
      return `${d.distance_km} km · ${formatDuration(d.duration_seconds)} · ${formatPace(d.avg_pace_seconds_per_km ?? 0)}`;
    case 'intervals':
      return `${d.interval_count}×${d.interval_distance_m}m · series ${d.from_interval}-${d.to_interval}`;
    case 'yoyo_test':
      return `Nivel ${d.level} · ${d.shuttles} shuttles`;
    default:
      return '';
  }
}

function computeWeeklyDistance(sessions: CardioSession[]) {
  const weekMap = new Map<string, number>();

  sessions
    .filter((s) => s.type === 'long_run')
    .forEach((s) => {
      const d = s.details as { distance_km?: number };
      const weekStart = startOfWeek(parseISO(s.session_date), { weekStartsOn: 1 });
      const key = format(weekStart, 'd MMM', { locale: es });
      weekMap.set(key, (weekMap.get(key) ?? 0) + (d.distance_km ?? 0));
    });

  return [...weekMap.entries()]
    .reverse()
    .slice(0, 12)
    .reverse()
    .map(([label, value]) => ({ date: label, label, value: Math.round(value * 10) / 10 }));
}
