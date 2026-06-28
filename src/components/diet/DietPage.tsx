import { useEffect, useRef, useState } from 'react';
import { addDays, subDays } from 'date-fns';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { getThreeDayWindow, toISODate, formatDate, todayISO } from '../../lib/dates';
import { groupMealsBySlot, slotKey, type DragPayload } from '../../lib/meals';
import { loadingClass, pageSubtitleClass } from '../../lib/ui-classes';
import type { DailyLog, DayMealItem, FoodTemplate, MealType } from '../../types/database';
import type { WaterEntryValue } from '../../lib/water';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { FoodLibrary } from './FoodLibrary';
import { WeekSchedule } from './WeekSchedule';
import {
  DietExtrasModal,
  buildExtraUpdatePayload,
  getExtraEntryValue,
  isExtraEntry,
  type ExtraEntryType,
} from './DietExtrasModal';

interface DietPageProps {
  initialMeal?: string;
}

export function DietPage({ initialMeal }: DietPageProps) {
  const [viewStart, setViewStart] = useState(() => subDays(new Date(), 1));
  const [foods, setFoods] = useState<FoodTemplate[]>([]);
  const [mealItems, setMealItems] = useState<DayMealItem[]>([]);
  const [logs, setLogs] = useState<Map<string, DailyLog>>(new Map());
  const [newFoodName, setNewFoodName] = useState('');
  const [creatingFood, setCreatingFood] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [extrasOpen, setExtrasOpen] = useState(false);
  const [extrasDate, setExtrasDate] = useState(todayISO());
  const [activeExtra, setActiveExtra] = useState<ExtraEntryType | null>(null);
  const [extraValue, setExtraValue] = useState<string | number | boolean | WaterEntryValue>('');

  const [quickAdd, setQuickAdd] = useState<{ date: string; mealType: MealType } | null>(null);
  const [highlightMeal, setHighlightMeal] = useState<MealType | null>(null);

  const supabase = createSupabaseBrowserClient();
  const visibleDays = getThreeDayWindow(viewStart);
  const mealsBySlot = groupMealsBySlot(mealItems);
  const openedInitial = useRef(false);

  useEffect(() => {
    loadWeek();
  }, [viewStart]);

  useEffect(() => {
    if (!loading && initialMeal && !openedInitial.current) {
      openedInitial.current = true;
      if (isExtraEntry(initialMeal)) {
        openExtras(todayISO(), initialMeal);
      } else if (isMealSlot(initialMeal)) {
        setHighlightMeal(initialMeal);
        setTimeout(() => setHighlightMeal(null), 3000);
      }
    }
  }, [loading, initialMeal]);

  function isMealSlot(value: string): value is MealType {
    return ['breakfast', 'lunch', 'snack', 'dinner'].includes(value);
  }

  async function loadWeek() {
    setLoading(true);
    const days = getThreeDayWindow(viewStart);
    const from = toISODate(days[0]);
    const to = toISODate(days[2]);

    const [foodsRes, mealsRes, logsRes] = await Promise.all([
      supabase.from('food_templates').select('*').order('name'),
      supabase
        .from('day_meal_items')
        .select('*')
        .gte('log_date', from)
        .lte('log_date', to)
        .order('sort_order'),
      supabase.from('daily_logs').select('*').gte('log_date', from).lte('log_date', to),
    ]);

    setFoods(foodsRes.data ?? []);
    setMealItems(mealsRes.data ?? []);

    const map = new Map<string, DailyLog>();
    (logsRes.data ?? []).forEach((log) => map.set(log.log_date, log));
    setLogs(map);
    setLoading(false);
  }

  async function createFood() {
    const name = newFoodName.trim();
    if (!name) return;
    setCreatingFood(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('food_templates').insert({ user_id: user.id, name });
    setNewFoodName('');
    setCreatingFood(false);
    await loadWeek();
  }

  async function deleteFood(id: string) {
    if (!confirm('¿Eliminar este alimento?')) return;
    await supabase.from('food_templates').delete().eq('id', id);
    await loadWeek();
  }

  async function addMealToSlot(
    date: string,
    mealType: MealType,
    name: string,
    templateId?: string | null,
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const key = `${date}:${mealType}`;
    const existing = mealsBySlot.get(key) ?? [];
    await supabase.from('day_meal_items').insert({
      user_id: user.id,
      log_date: date,
      meal_type: mealType,
      name,
      food_template_id: templateId ?? null,
      sort_order: existing.length,
    });
    await loadWeek();
  }

  async function handleDrop(payload: DragPayload, date: string, mealType: MealType) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (payload.kind === 'template') {
      await addMealToSlot(date, mealType, payload.name, payload.templateId);
      return;
    }

    const item = mealItems.find((m) => m.id === payload.itemId);
    if (!item) return;

    const key = slotKey(date, mealType);
    const targetItems = mealsBySlot.get(key) ?? [];

    await supabase
      .from('day_meal_items')
      .update({
        log_date: date,
        meal_type: mealType,
        sort_order: targetItems.length,
      })
      .eq('id', payload.itemId);
    await loadWeek();
  }

  async function removeMealItem(itemId: string) {
    await supabase.from('day_meal_items').delete().eq('id', itemId);
    await loadWeek();
  }

  function openExtras(date: string, entry?: ExtraEntryType) {
    setExtrasDate(date);
    setExtrasOpen(true);
    if (entry) {
      setActiveExtra(entry);
      setExtraValue(getExtraEntryValue(logs.get(date), entry));
    } else {
      setActiveExtra(null);
      setExtraValue('');
    }
  }

  function closeExtras() {
    setExtrasOpen(false);
    setActiveExtra(null);
    setExtraValue('');
  }

  async function saveExtra() {
    if (!activeExtra) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = logs.get(extrasDate);
    const update = buildExtraUpdatePayload(activeExtra, extraValue);

    if (existing) {
      await supabase.from('daily_logs').update(update).eq('id', existing.id);
    } else {
      await supabase.from('daily_logs').insert({
        user_id: user.id,
        log_date: extrasDate,
        ...update,
      });
    }

    setSaving(false);
    closeExtras();
    await loadWeek();
  }

  const rangeLabel = `${formatDate(toISODate(visibleDays[0]), 'd MMM')} – ${formatDate(toISODate(visibleDays[2]), 'd MMM yyyy')}`;

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">🍽️ Dieta semanal</h1>
            <p className={pageSubtitleClass}>
              Horario de comidas — arrastra alimentos entre días
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => openExtras(todayISO())}>
            💧 Extras
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setViewStart(subDays(viewStart, 3))}>
          ← Anterior
        </Button>
        <span className="text-sm font-medium text-foreground text-center">{rangeLabel}</span>
        <Button variant="outline" size="sm" onClick={() => setViewStart(addDays(viewStart, 3))}>
          Siguiente →
        </Button>
      </div>

      {loading ? (
        <div className={loadingClass}>Cargando...</div>
      ) : (
        <>
          <FoodLibrary
            foods={foods}
            newFoodName={newFoodName}
            onNewFoodNameChange={setNewFoodName}
            onCreateFood={createFood}
            onDeleteFood={deleteFood}
            creating={creatingFood}
          />

          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">Horario (3 días)</h2>
            <WeekSchedule
              visibleDays={visibleDays}
              mealsBySlot={mealsBySlot}
              onDrop={handleDrop}
              onRemoveItem={removeMealItem}
              onQuickAdd={(date, mealType) => setQuickAdd({ date, mealType })}
              highlightMeal={highlightMeal}
            />
          </div>
        </>
      )}

      <DietExtrasModal
        open={extrasOpen}
        date={extrasDate}
        log={logs.get(extrasDate)}
        activeEntry={activeExtra}
        entryValue={extraValue}
        saving={saving}
        onClose={closeExtras}
        onSelectEntry={(entry) => {
          setActiveExtra(entry);
          setExtraValue(getExtraEntryValue(logs.get(extrasDate), entry));
        }}
        onBack={() => {
          setActiveExtra(null);
          setExtraValue('');
        }}
        onChangeValue={setExtraValue}
        onSave={saveExtra}
      />

      <Modal
        open={quickAdd !== null}
        onClose={() => setQuickAdd(null)}
        title={
          quickAdd
            ? `Añadir — ${mealLabel(quickAdd.mealType)} (${formatDate(quickAdd.date, 'd MMM')})`
            : ''
        }
      >
        {quickAdd && (
          <div className="space-y-2">
            {foods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Crea alimentos arriba para añadirlos aquí
              </p>
            ) : (
              foods.map((food) => (
                <button
                  key={food.id}
                  type="button"
                  onClick={async () => {
                    await addMealToSlot(quickAdd.date, quickAdd.mealType, food.name, food.id);
                    setQuickAdd(null);
                  }}
                  className="w-full text-left rounded-md border border-border px-4 py-3 hover:bg-accent text-sm"
                >
                  {food.name}
                </button>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function mealLabel(mealType: MealType): string {
  const labels: Record<MealType, string> = {
    breakfast: 'Desayuno',
    lunch: 'Comida',
    snack: 'Merienda',
    dinner: 'Cena',
  };
  return labels[mealType];
}
