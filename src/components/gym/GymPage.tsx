import { useEffect, useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { todayISO, formatDate, getScheduleLoadRange } from '../../lib/dates';
import { useIsMobile } from '../../lib/use-mobile';
import type { PlanDragPayload } from '../../lib/schedule';
import {
  inlineInputClass,
  loadingClass,
  pageSubtitleClass,
  selectClass,
  tabActiveClass,
  tabInactiveClass,
} from '../../lib/ui-classes';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { LineChart } from '../charts/LineChart';
import { ThreeDayPlanGrid, type DayPlanEntry } from '../schedule/ThreeDayPlanGrid';
import { TemplateChipLibrary } from '../schedule/TemplateChipLibrary';
import type {
  RoutineTemplate,
  WorkoutSession,
  GymDayPlan,
} from '../../types/database';

type Tab = 'schedule' | 'workout' | 'templates' | 'history' | 'progress';

interface SetInput {
  set_number: number;
  reps: number;
  weight_kg: number;
}

interface ExerciseInput {
  name: string;
  routine_exercise_id?: string;
  sets: SetInput[];
}

export function GymPage() {
  const [tab, setTab] = useState<Tab>('schedule');
  const [viewStart, setViewStart] = useState(() => subDays(new Date(), 1));
  const [gymPlans, setGymPlans] = useState<GymDayPlan[]>([]);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [workoutDate, setWorkoutDate] = useState(todayISO());
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [workoutExercises, setWorkoutExercises] = useState<ExerciseInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateExercises, setTemplateExercises] = useState<
    { name: string; target_sets: number; target_reps: number }[]
  >([{ name: '', target_sets: 3, target_reps: 10 }]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickAddTemplateId, setQuickAddTemplateId] = useState('');

  const [progressExercise, setProgressExercise] = useState('');
  const [progressData, setProgressData] = useState<{ label: string; value: number }[]>([]);
  const [progressMode, setProgressMode] = useState<'max_weight' | 'volume'>('max_weight');

  const supabase = createSupabaseBrowserClient();
  const isMobile = useIsMobile();

  const plansByDate = useMemo(() => {
    const map = new Map<string, DayPlanEntry>();
    for (const plan of gymPlans) {
      map.set(plan.plan_date, {
        id: plan.id,
        plan_date: plan.plan_date,
        name: plan.name,
        completed: completedDates.has(plan.plan_date),
      });
    }
    return map;
  }, [gymPlans, completedDates]);

  const templateChips = useMemo(
    () =>
      templates.map((t) => ({
        id: t.id,
        label: t.name,
        dragPayload: { kind: 'gym-template' as const, templateId: t.id, name: t.name },
      })),
    [templates],
  );

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [viewStart, isMobile]);

  useEffect(() => {
    if (tab === 'workout') {
      loadWorkoutForDate(workoutDate);
    }
  }, [tab, workoutDate]);

  useEffect(() => {
    if (selectedTemplateId && !activeSession) {
      loadTemplateExercises(selectedTemplateId);
    }
  }, [selectedTemplateId, activeSession]);

  useEffect(() => {
    if (progressExercise) loadProgress(progressExercise);
  }, [progressExercise, progressMode]);

  async function loadBase() {
    setLoading(true);
    const [tplRes, sessRes] = await Promise.all([
      supabase.from('routine_templates').select('*').order('name'),
      supabase.from('workout_sessions').select('*').order('session_date', { ascending: false }).limit(30),
    ]);
    setTemplates(tplRes.data ?? []);
    setSessions(sessRes.data ?? []);
    await loadSchedule();
    setLoading(false);
  }

  async function loadSchedule() {
    const { from, to } = getScheduleLoadRange(viewStart, isMobile);

    const [plansRes, sessionsRes] = await Promise.all([
      supabase.from('gym_day_plans').select('*').gte('plan_date', from).lte('plan_date', to),
      supabase.from('workout_sessions').select('session_date').gte('session_date', from).lte('session_date', to),
    ]);

    setGymPlans(plansRes.data ?? []);
    setCompletedDates(new Set((sessionsRes.data ?? []).map((s) => s.session_date)));
  }

  async function loadWorkoutForDate(date: string) {
    const [{ data: session }, { data: plan }] = await Promise.all([
      supabase.from('workout_sessions').select('*').eq('session_date', date).maybeSingle(),
      supabase.from('gym_day_plans').select('*').eq('plan_date', date).maybeSingle(),
    ]);

    setActiveSession(session ?? null);

    if (session) {
      await loadSessionWorkout(session.id);
      if (session.template_id) setSelectedTemplateId(session.template_id);
      return;
    }

    if (plan?.template_id) {
      setSelectedTemplateId(plan.template_id);
      await loadTemplateExercises(plan.template_id);
    } else {
      setSelectedTemplateId('');
      setWorkoutExercises([]);
    }
  }

  async function loadTemplateExercises(templateId: string) {
    const { data } = await supabase
      .from('routine_exercises')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order');

    setWorkoutExercises(
      (data ?? []).map((ex) => ({
        name: ex.name,
        routine_exercise_id: ex.id,
        sets: Array.from({ length: ex.target_sets }, (_, i) => ({
          set_number: i + 1,
          reps: ex.target_reps,
          weight_kg: 0,
        })),
      })),
    );
  }

  async function loadSessionWorkout(sessionId: string) {
    const { data: wex } = await supabase
      .from('workout_exercises')
      .select('*')
      .eq('session_id', sessionId)
      .order('sort_order');

    if (!wex?.length) {
      setWorkoutExercises([]);
      return;
    }

    const result: ExerciseInput[] = [];
    for (const ex of wex) {
      const { data: sets } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_exercise_id', ex.id)
        .order('set_number');
      result.push({
        name: ex.name,
        routine_exercise_id: ex.routine_exercise_id ?? undefined,
        sets: (sets ?? []).map((s) => ({
          set_number: s.set_number,
          reps: s.reps,
          weight_kg: Number(s.weight_kg ?? 0),
        })),
      });
    }
    setWorkoutExercises(result);
  }

  async function upsertPlan(date: string, templateId: string | null, name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = gymPlans.find((p) => p.plan_date === date);
    if (existing) {
      await supabase
        .from('gym_day_plans')
        .update({ template_id: templateId, name })
        .eq('id', existing.id);
    } else {
      await supabase.from('gym_day_plans').insert({
        user_id: user.id,
        plan_date: date,
        template_id: templateId,
        name,
      });
    }
    await loadSchedule();
  }

  async function movePlan(planId: string, toDate: string) {
    const moving = gymPlans.find((p) => p.id === planId);
    if (!moving || moving.plan_date === toDate) return;

    const atTarget = gymPlans.find((p) => p.plan_date === toDate);
    if (atTarget) {
      await supabase.from('gym_day_plans').delete().eq('id', atTarget.id);
    }
    await supabase.from('gym_day_plans').update({ plan_date: toDate }).eq('id', planId);
    await loadSchedule();
  }

  async function handlePlanDrop(payload: PlanDragPayload, date: string) {
    if (payload.kind === 'gym-template') {
      await upsertPlan(date, payload.templateId, payload.name);
    } else if (payload.kind === 'plan') {
      await movePlan(payload.planId, date);
    }
  }

  async function removePlan(planId: string) {
    await supabase.from('gym_day_plans').delete().eq('id', planId);
    await loadSchedule();
  }

  function openWorkoutDay(date: string) {
    setWorkoutDate(date);
    setTab('workout');
  }

  async function confirmQuickAdd() {
    if (!quickAddDate) return;
    const tpl = templates.find((t) => t.id === quickAddTemplateId);
    const name = tpl?.name ?? 'Entreno libre';
    await upsertPlan(quickAddDate, quickAddTemplateId || null, name);
    setQuickAddDate(null);
    setQuickAddTemplateId('');
  }

  async function saveWorkout() {
    if (workoutExercises.length === 0) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let sessionId = activeSession?.id;

    if (!sessionId) {
      const { data: newSession, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          session_date: workoutDate,
          template_id: selectedTemplateId || null,
          name: templates.find((t) => t.id === selectedTemplateId)?.name ?? 'Entreno libre',
        })
        .select()
        .single();

      if (error) {
        alert('Ya tienes un entreno registrado ese día');
        setSaving(false);
        return;
      }
      sessionId = newSession.id;
    } else {
      await supabase.from('workout_exercises').delete().eq('session_id', sessionId);
    }

    for (let i = 0; i < workoutExercises.length; i++) {
      const ex = workoutExercises[i];
      const { data: wex } = await supabase
        .from('workout_exercises')
        .insert({
          user_id: user.id,
          session_id: sessionId!,
          routine_exercise_id: ex.routine_exercise_id ?? null,
          name: ex.name,
          sort_order: i,
        })
        .select()
        .single();

      if (wex && ex.sets.length > 0) {
        await supabase.from('workout_sets').insert(
          ex.sets.map((s) => ({
            user_id: user.id,
            workout_exercise_id: wex.id,
            set_number: s.set_number,
            reps: s.reps,
            weight_kg: s.weight_kg || null,
          })),
        );
      }
    }

    setSaving(false);
    const sessRes = await supabase
      .from('workout_sessions')
      .select('*')
      .order('session_date', { ascending: false })
      .limit(30);
    setSessions(sessRes.data ?? []);
    await loadSchedule();
    await loadWorkoutForDate(workoutDate);
  }

  async function saveTemplate() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !templateName.trim()) return;

    let templateId = editingTemplateId;

    if (editingTemplateId) {
      await supabase.from('routine_templates').update({ name: templateName }).eq('id', editingTemplateId);
      await supabase.from('routine_exercises').delete().eq('template_id', editingTemplateId);
    } else {
      const { data } = await supabase
        .from('routine_templates')
        .insert({ user_id: user.id, name: templateName })
        .select()
        .single();
      templateId = data?.id ?? null;
    }

    if (templateId) {
      const valid = templateExercises.filter((e) => e.name.trim());
      await supabase.from('routine_exercises').insert(
        valid.map((e, i) => ({
          user_id: user.id,
          template_id: templateId!,
          name: e.name,
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          sort_order: i,
        })),
      );
    }

    setShowTemplateModal(false);
    setTemplateName('');
    setTemplateExercises([{ name: '', target_sets: 3, target_reps: 10 }]);
    setEditingTemplateId(null);
    await loadBase();
  }

  async function deleteTemplate(id: string) {
    if (!confirm('¿Eliminar plantilla?')) return;
    await supabase.from('routine_templates').delete().eq('id', id);
    await loadBase();
  }

  async function editTemplate(tpl: RoutineTemplate) {
    const { data } = await supabase
      .from('routine_exercises')
      .select('*')
      .eq('template_id', tpl.id)
      .order('sort_order');
    setEditingTemplateId(tpl.id);
    setTemplateName(tpl.name);
    setTemplateExercises(
      (data ?? []).map((e) => ({
        name: e.name,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
      })),
    );
    setShowTemplateModal(true);
  }

  async function loadProgress(exerciseName: string) {
    const { data: wex } = await supabase
      .from('workout_exercises')
      .select('id, session_id, name')
      .eq('name', exerciseName);

    if (!wex?.length) {
      setProgressData([]);
      return;
    }

    const sessionIds = [...new Set(wex.map((e) => e.session_id))];
    const { data: sessionsData } = await supabase
      .from('workout_sessions')
      .select('id, session_date')
      .in('id', sessionIds)
      .order('session_date');

    const points: { label: string; value: number; date: string }[] = [];

    for (const sess of sessionsData ?? []) {
      const exIds = wex.filter((e) => e.session_id === sess.id).map((e) => e.id);
      const { data: sets } = await supabase
        .from('workout_sets')
        .select('*')
        .in('workout_exercise_id', exIds);

      if (!sets?.length) continue;

      const value =
        progressMode === 'max_weight'
          ? Math.max(...sets.map((s) => Number(s.weight_kg ?? 0)))
          : sets.reduce((acc, s) => acc + s.reps * Number(s.weight_kg ?? 0), 0);

      points.push({
        date: sess.session_date,
        label: formatDate(sess.session_date, 'd/M'),
        value,
      });
    }

    setProgressData(points);
  }

  function addExercise() {
    setWorkoutExercises([
      ...workoutExercises,
      { name: '', sets: [{ set_number: 1, reps: 10, weight_kg: 0 }] },
    ]);
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof SetInput, value: number) {
    const updated = [...workoutExercises];
    updated[exIdx].sets[setIdx] = { ...updated[exIdx].sets[setIdx], [field]: value };
    setWorkoutExercises(updated);
  }

  function addSet(exIdx: number) {
    const updated = [...workoutExercises];
    const next = updated[exIdx].sets.length + 1;
    updated[exIdx].sets.push({ set_number: next, reps: 10, weight_kg: 0 });
    setWorkoutExercises(updated);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'schedule', label: 'Horario' },
    { id: 'workout', label: 'Registrar' },
    { id: 'templates', label: 'Plantillas' },
    { id: 'history', label: 'Historial' },
    { id: 'progress', label: 'Progreso' },
  ];

  const isTodayWorkout = workoutDate === todayISO();

  if (loading) return <div className={loadingClass}>Cargando...</div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">🏋️ Gimnasio</h1>
        <p className={pageSubtitleClass}>
          Planifica tu semana y registra cada entreno
        </p>
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
            title="Plantillas de rutina"
            hint="Arrastra una plantilla al día que quieras entrenar"
            chips={templateChips}
            emptyMessage="Crea plantillas en la pestaña Plantillas"
          />
          <ThreeDayPlanGrid
            viewStart={viewStart}
            onViewStartChange={setViewStart}
            plansByDate={plansByDate}
            slotLabel="Rutina"
            emptyHint="Arrastra una plantilla aquí"
            onDrop={handlePlanDrop}
            onRemove={removePlan}
            onQuickAdd={(date) => {
              setQuickAddDate(date);
              setQuickAddTemplateId('');
            }}
            onOpenDay={openWorkoutDay}
          />
        </div>
      )}

      {tab === 'workout' && (
        <div className="space-y-4">
          <Card className="!py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Fecha del entreno</p>
                <p className="font-medium">{formatDate(workoutDate)}</p>
              </div>
              {!isTodayWorkout && (
                <Button variant="outline" size="sm" onClick={() => setWorkoutDate(todayISO())}>
                  Ir a hoy
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <label className="block text-sm font-medium text-foreground mb-2">Plantilla</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={Boolean(activeSession)}
              className={selectClass}
            >
              <option value="">Entreno libre</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Card>

          {workoutExercises.map((ex, exIdx) => (
            <Card key={exIdx}>
              <Input
                label="Ejercicio"
                value={ex.name}
                onChange={(e) => {
                  const updated = [...workoutExercises];
                  updated[exIdx].name = e.target.value;
                  setWorkoutExercises(updated);
                }}
              />
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground px-1">
                  <span>Serie</span><span>Reps</span><span>Kg</span><span />
                </div>
                {ex.sets.map((set, setIdx) => (
                  <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
                    <span className="text-center text-muted-foreground text-sm tabular-nums">{set.set_number}</span>
                    <input
                      type="number"
                      min="0"
                      value={set.reps}
                      onChange={(e) => updateSet(exIdx, setIdx, 'reps', Number(e.target.value))}
                      className={inlineInputClass}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={set.weight_kg}
                      onChange={(e) => updateSet(exIdx, setIdx, 'weight_kg', Number(e.target.value))}
                      className={inlineInputClass}
                    />
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => addSet(exIdx)}>+ Serie</Button>
              </div>
            </Card>
          ))}

          <Button variant="secondary" onClick={addExercise}>+ Ejercicio extra</Button>
          <Button size="lg" className="w-full" onClick={saveWorkout} disabled={saving}>
            {saving ? 'Guardando...' : activeSession ? 'Actualizar entreno' : 'Guardar entreno'}
          </Button>
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-3">
          <Button onClick={() => { setEditingTemplateId(null); setTemplateName(''); setShowTemplateModal(true); }}>
            + Nueva plantilla
          </Button>
          {templates.map((t) => (
            <Card key={t.id} className="!py-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">{t.name}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => editTemplate(t)}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteTemplate(t.id)}>Eliminar</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {sessions.length === 0 && <p className="text-muted-foreground text-center py-8 text-sm">Sin entrenos aún</p>}
          {sessions.map((s) => (
            <Card key={s.id} className="!py-4">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => openWorkoutDay(s.session_date)}
              >
                <div className="font-medium">{s.name ?? 'Entreno'}</div>
                <div className="text-sm text-muted-foreground">{formatDate(s.session_date)}</div>
              </button>
            </Card>
          ))}
        </div>
      )}

      {tab === 'progress' && (
        <Card>
          <Input
            label="Ejercicio"
            value={progressExercise}
            onChange={(e) => setProgressExercise(e.target.value)}
            placeholder="Ej: Press banca"
          />
          <div className="flex gap-1 my-4 p-1 bg-muted rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setProgressMode('max_weight')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                progressMode === 'max_weight' ? tabActiveClass : tabInactiveClass,
              )}
            >
              Peso máx.
            </button>
            <button
              type="button"
              onClick={() => setProgressMode('volume')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                progressMode === 'volume' ? tabActiveClass : tabInactiveClass,
              )}
            >
              Volumen
            </button>
          </div>
          <LineChart
            data={progressData}
            unit={progressMode === 'max_weight' ? ' kg' : ' vol'}
          />
        </Card>
      )}

      <Modal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title={editingTemplateId ? 'Editar plantilla' : 'Nueva plantilla'}
      >
        <div className="space-y-4">
          <Input label="Nombre" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          {templateExercises.map((ex, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Input
                label="Ejercicio"
                value={ex.name}
                onChange={(e) => {
                  const u = [...templateExercises];
                  u[i].name = e.target.value;
                  setTemplateExercises(u);
                }}
              />
              <Input
                label="Series"
                type="number"
                value={ex.target_sets}
                onChange={(e) => {
                  const u = [...templateExercises];
                  u[i].target_sets = Number(e.target.value);
                  setTemplateExercises(u);
                }}
              />
              <Input
                label="Reps"
                type="number"
                value={ex.target_reps}
                onChange={(e) => {
                  const u = [...templateExercises];
                  u[i].target_reps = Number(e.target.value);
                  setTemplateExercises(u);
                }}
              />
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setTemplateExercises([...templateExercises, { name: '', target_sets: 3, target_reps: 10 }])
            }
          >
            + Ejercicio
          </Button>
          <Button size="lg" className="w-full" onClick={saveTemplate}>Guardar plantilla</Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(quickAddDate)}
        onClose={() => {
          setQuickAddDate(null);
          setQuickAddTemplateId('');
        }}
        title={quickAddDate ? `Planificar ${formatDate(quickAddDate)}` : 'Planificar'}
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-foreground">Plantilla</label>
          <select
            value={quickAddTemplateId}
            onChange={(e) => setQuickAddTemplateId(e.target.value)}
            className={selectClass}
          >
            <option value="">Entreno libre</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
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
