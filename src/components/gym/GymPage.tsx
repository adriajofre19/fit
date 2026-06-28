import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { todayISO, formatDate } from '../../lib/dates';
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
import type {
  RoutineTemplate,
  RoutineExercise,
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
} from '../../types/database';

type Tab = 'workout' | 'templates' | 'history' | 'progress';

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
  const [tab, setTab] = useState<Tab>('workout');
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [todaySession, setTodaySession] = useState<WorkoutSession | null>(null);
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

  const [progressExercise, setProgressExercise] = useState('');
  const [progressData, setProgressData] = useState<{ label: string; value: number }[]>([]);
  const [progressMode, setProgressMode] = useState<'max_weight' | 'volume'>('max_weight');

  const supabase = createSupabaseBrowserClient();
  const today = todayISO();

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateExercises(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    if (progressExercise) loadProgress(progressExercise);
  }, [progressExercise, progressMode]);

  async function loadAll() {
    setLoading(true);
    const [tplRes, sessRes, todayRes] = await Promise.all([
      supabase.from('routine_templates').select('*').order('name'),
      supabase.from('workout_sessions').select('*').order('session_date', { ascending: false }).limit(30),
      supabase.from('workout_sessions').select('*').eq('session_date', today).maybeSingle(),
    ]);
    setTemplates(tplRes.data ?? []);
    setSessions(sessRes.data ?? []);
    setTodaySession(todayRes.data ?? null);

    if (todayRes.data) {
      await loadTodayWorkout(todayRes.data.id);
    }
    setLoading(false);
  }

  async function loadTemplateExercises(templateId: string) {
    const { data } = await supabase
      .from('routine_exercises')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order');
    setExercises(data ?? []);

    if (!todaySession) {
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
  }

  async function loadTodayWorkout(sessionId: string) {
    const { data: wex } = await supabase
      .from('workout_exercises')
      .select('*')
      .eq('session_id', sessionId)
      .order('sort_order');

    if (!wex?.length) return;

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
    if (todaySession?.template_id) setSelectedTemplateId(todaySession.template_id);
  }

  async function saveWorkout() {
    if (workoutExercises.length === 0) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let sessionId = todaySession?.id;

    if (!sessionId) {
      const { data: newSession, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          session_date: today,
          template_id: selectedTemplateId || null,
          name: templates.find((t) => t.id === selectedTemplateId)?.name ?? 'Entreno libre',
        })
        .select()
        .single();

      if (error) {
        alert('Ya tienes un entreno registrado hoy');
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
    await loadAll();
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
    await loadAll();
  }

  async function deleteTemplate(id: string) {
    if (!confirm('¿Eliminar plantilla?')) return;
    await supabase.from('routine_templates').delete().eq('id', id);
    await loadAll();
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
    { id: 'workout', label: 'Hoy' },
    { id: 'templates', label: 'Plantillas' },
    { id: 'history', label: 'Historial' },
    { id: 'progress', label: 'Progreso' },
  ];

  if (loading) return <div className={loadingClass}>Cargando...</div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">🏋️ Gimnasio</h1>
        <p className={pageSubtitleClass}>
          {todaySession ? 'Entreno de hoy registrado — puedes editarlo' : 'Registra tu entreno de hoy'}
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

      {tab === 'workout' && (
        <div className="space-y-4">
          <Card>
            <label className="block text-sm font-medium text-foreground mb-2">Plantilla</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={Boolean(todaySession)}
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
            {saving ? 'Guardando...' : todaySession ? 'Actualizar entreno' : 'Guardar entreno'}
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
              <div>
                <div className="font-medium">{s.name ?? 'Entreno'}</div>
                <div className="text-sm text-muted-foreground">{formatDate(s.session_date)}</div>
              </div>
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
    </div>
  );
}
