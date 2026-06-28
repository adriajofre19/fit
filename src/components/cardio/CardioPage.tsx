import { useEffect, useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { todayISO, formatDate, formatPace, formatDuration, getThreeDayWindow, toISODate } from '../../lib/dates';
import type { PlanDragPayload } from '../../lib/schedule';
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
import { Modal } from '../ui/Modal';
import { LineChart } from '../charts/LineChart';
import { ThreeDayPlanGrid, type DayPlanEntry } from '../schedule/ThreeDayPlanGrid';
import { TemplateChipLibrary } from '../schedule/TemplateChipLibrary';
import type { CardioSession, CardioDayPlan } from '../../types/database';
import { startOfWeek, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';

type CardioWorkoutType = keyof typeof CARDIO_WORKOUT_LABELS;
type Tab = 'schedule' | 'log' | 'history' | 'charts';

// TODO: integración Strava OAuth + webhook de actividades
// Conectar aquí el flujo OAuth y el handler de webhook para upsert con source='strava'

const CARDIO_TYPES = Object.keys(CARDIO_WORKOUT_LABELS) as CardioWorkoutType[];

export function CardioPage() {
  const [tab, setTab] = useState<Tab>('schedule');
  const [viewStart, setViewStart] = useState(() => subDays(new Date(), 1));
  const [cardioPlans, setCardioPlans] = useState<CardioDayPlan[]>([]);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  const [type, setType] = useState<CardioWorkoutType>('long_run');
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [filterType, setFilterType] = useState<CardioWorkoutType | 'all'>('all');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickAddType, setQuickAddType] = useState<CardioWorkoutType>('long_run');

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

  const plansByDate = useMemo(() => {
    const map = new Map<string, DayPlanEntry>();
    for (const plan of cardioPlans) {
      map.set(plan.plan_date, {
        id: plan.id,
        plan_date: plan.plan_date,
        name: plan.name,
        completed: completedDates.has(plan.plan_date),
      });
    }
    return map;
  }, [cardioPlans, completedDates]);

  const cardioChips = useMemo(
    () =>
      CARDIO_TYPES.map((t) => ({
        id: t,
        label: CARDIO_WORKOUT_LABELS[t],
        dragPayload: {
          kind: 'cardio-template' as const,
          plannedType: t,
          name: CARDIO_WORKOUT_LABELS[t],
        },
      })),
    [],
  );

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [viewStart]);

  useEffect(() => {
    if (tab === 'log') {
      const plan = cardioPlans.find((p) => p.plan_date === sessionDate);
      if (plan) setType(plan.planned_type as CardioWorkoutType);
    }
  }, [tab, sessionDate, cardioPlans]);

  async function loadSessions() {
    setLoading(true);
    const { data } = await supabase
      .from('cardio_sessions')
      .select('*')
      .neq('type', 'daily_steps')
      .order('session_date', { ascending: false })
      .limit(100);
    setSessions(data ?? []);
    await loadSchedule();
    setLoading(false);
  }

  async function loadSchedule() {
    const days = getThreeDayWindow(viewStart);
    const from = toISODate(days[0]);
    const to = toISODate(days[2]);

    const [plansRes, sessionsRes] = await Promise.all([
      supabase.from('cardio_day_plans').select('*').gte('plan_date', from).lte('plan_date', to),
      supabase
        .from('cardio_sessions')
        .select('session_date')
        .neq('type', 'daily_steps')
        .gte('session_date', from)
        .lte('session_date', to),
    ]);

    setCardioPlans(plansRes.data ?? []);
    setCompletedDates(new Set((sessionsRes.data ?? []).map((s) => s.session_date)));
  }

  async function upsertPlan(date: string, plannedType: CardioWorkoutType, name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = cardioPlans.find((p) => p.plan_date === date);
    if (existing) {
      await supabase
        .from('cardio_day_plans')
        .update({ planned_type: plannedType, name })
        .eq('id', existing.id);
    } else {
      await supabase.from('cardio_day_plans').insert({
        user_id: user.id,
        plan_date: date,
        planned_type: plannedType,
        name,
      });
    }
    await loadSchedule();
  }

  async function movePlan(planId: string, toDate: string) {
    const moving = cardioPlans.find((p) => p.id === planId);
    if (!moving || moving.plan_date === toDate) return;

    const atTarget = cardioPlans.find((p) => p.plan_date === toDate);
    if (atTarget) {
      await supabase.from('cardio_day_plans').delete().eq('id', atTarget.id);
    }
    await supabase.from('cardio_day_plans').update({ plan_date: toDate }).eq('id', planId);
    await loadSchedule();
  }

  async function handlePlanDrop(payload: PlanDragPayload, date: string) {
    if (payload.kind === 'cardio-template') {
      await upsertPlan(date, payload.plannedType as CardioWorkoutType, payload.name);
    } else if (payload.kind === 'plan') {
      await movePlan(payload.planId, date);
    }
  }

  async function removePlan(planId: string) {
    await supabase.from('cardio_day_plans').delete().eq('id', planId);
    await loadSchedule();
  }

  function openLogDay(date: string) {
    setSessionDate(date);
    setTab('log');
  }

  async function confirmQuickAdd() {
    if (!quickAddDate) return;
    await upsertPlan(quickAddDate, quickAddType, CARDIO_WORKOUT_LABELS[quickAddType]);
    setQuickAddDate(null);
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
      session_date: sessionDate,
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
  const isTodaySession = sessionDate === todayISO();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'schedule', label: 'Horario' },
    { id: 'log', label: 'Registrar' },
    { id: 'history', label: 'Historial' },
    { id: 'charts', label: 'Gráficas' },
  ];

  if (loading) return <div className={loadingClass}>Cargando...</div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">🏃 Entrenos cardio</h1>
        <p className={pageSubtitleClass}>Planifica y registra running, series e intervalos</p>
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

      {tab === 'schedule' && (
        <div className="space-y-4">
          <TemplateChipLibrary
            title="Tipos de entreno"
            hint="Arrastra un tipo al día que quieras entrenar"
            chips={cardioChips}
          />
          <ThreeDayPlanGrid
            viewStart={viewStart}
            onViewStartChange={setViewStart}
            plansByDate={plansByDate}
            slotLabel="Cardio"
            emptyHint="Arrastra un entreno aquí"
            onDrop={handlePlanDrop}
            onRemove={removePlan}
            onQuickAdd={(date) => {
              setQuickAddDate(date);
              setQuickAddType('long_run');
            }}
            onOpenDay={openLogDay}
          />
        </div>
      )}

      {tab === 'log' && (
        <div className="space-y-4">
          <Card className="!py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Fecha del entreno</p>
                <p className="font-medium">{formatDate(sessionDate)}</p>
              </div>
              {!isTodaySession && (
                <Button variant="outline" size="sm" onClick={() => setSessionDate(todayISO())}>
                  Ir a hoy
                </Button>
              )}
            </div>
          </Card>

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
              <button
                type="button"
                className="w-full text-left"
                onClick={() => openLogDay(s.session_date)}
              >
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
              </button>
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

      <Modal
        open={Boolean(quickAddDate)}
        onClose={() => setQuickAddDate(null)}
        title={quickAddDate ? `Planificar ${formatDate(quickAddDate)}` : 'Planificar'}
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-foreground">Tipo de entreno</label>
          <select
            value={quickAddType}
            onChange={(e) => setQuickAddType(e.target.value as CardioWorkoutType)}
            className={selectClass}
          >
            {Object.entries(CARDIO_WORKOUT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Button size="lg" className="w-full" onClick={confirmQuickAdd}>
            Añadir al horario
          </Button>
        </div>
      </Modal>
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
