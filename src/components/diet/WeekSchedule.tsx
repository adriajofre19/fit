import { useState } from 'react';
import type { DayMealItem, MealType } from '../../types/database';
import { MEAL_SLOTS, parseDragPayload, slotKey, type DragPayload } from '../../lib/meals';
import { dayLabel, formatDate, toISODate, todayISO } from '../../lib/dates';
import { cn } from '../../lib/utils';

interface WeekScheduleProps {
  visibleDays: Date[];
  mealsBySlot: Map<string, DayMealItem[]>;
  onDrop: (payload: DragPayload, date: string, mealType: MealType) => void;
  onRemoveItem: (itemId: string) => void;
  onQuickAdd: (date: string, mealType: MealType) => void;
  highlightMeal?: MealType | null;
}

export function WeekSchedule({
  visibleDays,
  mealsBySlot,
  onDrop,
  onRemoveItem,
  onQuickAdd,
  highlightMeal,
}: WeekScheduleProps) {
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  function handleDragOver(e: React.DragEvent, key: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(key);
  }

  function handleDrop(e: React.DragEvent, date: string, mealType: MealType) {
    e.preventDefault();
    setDragOverSlot(null);
    const payload = parseDragPayload(e.dataTransfer.getData('application/json'));
    if (payload) onDrop(payload, date, mealType);
  }

  function handleItemDragStart(e: React.DragEvent, itemId: string) {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ kind: 'item', itemId } satisfies DragPayload),
    );
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {visibleDays.map((day) => {
        const iso = toISODate(day);
        const isToday = iso === todayISO();

        return (
          <div
            key={iso}
            className={cn(
              'rounded-xl border bg-card flex flex-col',
              isToday ? 'border-primary shadow-sm ring-1 ring-primary/20' : 'border-border',
            )}
          >
            <div className={cn('px-4 py-3 border-b border-border', isToday && 'bg-secondary')}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {dayLabel(day)}
              </div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {formatDate(iso, 'd MMM')}
              </div>
              {isToday && (
                <span className="inline-block mt-1 text-[10px] font-medium bg-primary text-primary-foreground rounded px-1.5 py-0.5">
                  Hoy
                </span>
              )}
            </div>

            <div className="p-3 space-y-3 flex-1">
              {MEAL_SLOTS.map((slot) => {
                const key = slotKey(iso, slot.id);
                const items = mealsBySlot.get(key) ?? [];
                const isOver = dragOverSlot === key;
                const isHighlighted = highlightMeal === slot.id && isToday;

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        {slot.emoji} {slot.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuickAdd(iso, slot.id)}
                        className="text-muted-foreground hover:text-foreground text-sm leading-none w-7 h-7 rounded-md hover:bg-accent flex items-center justify-center"
                        aria-label={`Añadir a ${slot.label}`}
                      >
                        +
                      </button>
                    </div>
                    <div
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDragLeave={() => setDragOverSlot(null)}
                      onDrop={(e) => handleDrop(e, iso, slot.id)}
                      className={cn(
                        'min-h-[72px] rounded-lg border border-dashed p-2 space-y-1.5 transition-colors',
                        isOver && 'border-primary bg-secondary',
                        isHighlighted && 'ring-2 ring-ring',
                        !isOver && 'border-border/80',
                      )}
                    >
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4 px-1">
                          Arrastra aquí
                        </p>
                      ) : (
                        items.map((item) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleItemDragStart(e, item.id)}
                            className={cn(
                              'group flex items-center gap-2 rounded-md border border-border bg-background',
                              'px-3 py-2 text-sm cursor-grab active:cursor-grabbing',
                              'hover:border-primary/30 hover:shadow-sm',
                            )}
                          >
                            <span className="flex-1 select-none leading-snug">{item.name}</span>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.id)}
                              className="shrink-0 text-muted-foreground hover:text-destructive opacity-60 sm:opacity-0 group-hover:opacity-100 text-sm"
                              aria-label={`Quitar ${item.name}`}
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
