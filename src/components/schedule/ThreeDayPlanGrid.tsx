import { useState } from 'react';
import { addDays, subDays } from 'date-fns';
import type { PlanDragPayload } from '../../lib/schedule';
import { parsePlanDragPayload } from '../../lib/schedule';
import { dayLabel, formatDate, getScheduleVisibleDays, toISODate, todayISO } from '../../lib/dates';
import { useIsMobile } from '../../lib/use-mobile';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export interface DayPlanEntry {
  id: string;
  plan_date: string;
  name: string;
  completed: boolean;
}

interface ThreeDayPlanGridProps {
  viewStart: Date;
  onViewStartChange: (date: Date) => void;
  plansByDate: Map<string, DayPlanEntry>;
  slotLabel: string;
  emptyHint: string;
  onDrop: (payload: PlanDragPayload, date: string) => void;
  onRemove: (planId: string) => void;
  onQuickAdd: (date: string) => void;
  onOpenDay: (date: string) => void;
}

export function ThreeDayPlanGrid({
  viewStart,
  onViewStartChange,
  plansByDate,
  slotLabel,
  emptyHint,
  onDrop,
  onRemove,
  onQuickAdd,
  onOpenDay,
}: ThreeDayPlanGridProps) {
  const isMobile = useIsMobile();
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const visibleDays = getScheduleVisibleDays(viewStart, isMobile);
  const rangeLabel = isMobile
    ? formatDate(todayISO(), 'EEEE d MMM yyyy')
    : `${formatDate(toISODate(visibleDays[0]), 'd MMM')} – ${formatDate(toISODate(visibleDays[visibleDays.length - 1]), 'd MMM yyyy')}`;

  function handleDragOver(e: React.DragEvent, date: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(date);
  }

  function handleDrop(e: React.DragEvent, date: string) {
    e.preventDefault();
    setDragOverDate(null);
    const payload = parsePlanDragPayload(e.dataTransfer.getData('application/json'));
    if (payload) onDrop(payload, date);
  }

  function handlePlanDragStart(e: React.DragEvent, planId: string) {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ kind: 'plan', planId } satisfies PlanDragPayload),
    );
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="space-y-4">
      {isMobile ? (
        <p className="text-sm font-medium text-foreground text-center capitalize">{rangeLabel}</p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewStartChange(subDays(viewStart, 3))}>
            ← Anterior
          </Button>
          <span className="text-sm font-medium text-foreground text-center">{rangeLabel}</span>
          <Button variant="outline" size="sm" onClick={() => onViewStartChange(addDays(viewStart, 3))}>
            Siguiente →
          </Button>
        </div>
      )}

      <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3')}>
        {visibleDays.map((day) => {
          const iso = toISODate(day);
          const isToday = iso === todayISO();
          const plan = plansByDate.get(iso);
          const isOver = dragOverDate === iso;

          return (
            <div
              key={iso}
              className={cn(
                'rounded-xl border bg-card flex flex-col',
                isToday ? 'border-primary shadow-sm ring-1 ring-primary/20' : 'border-border',
              )}
            >
              <button
                type="button"
                onClick={() => onOpenDay(iso)}
                className={cn(
                  'px-4 py-3 border-b border-border text-left w-full hover:bg-accent/50 transition-colors',
                  isToday && 'bg-secondary',
                )}
              >
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
              </button>

              <div className="p-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">{slotLabel}</span>
                  <button
                    type="button"
                    onClick={() => onQuickAdd(iso)}
                    className="text-muted-foreground hover:text-foreground text-sm w-7 h-7 rounded-md hover:bg-accent flex items-center justify-center"
                    aria-label="Añadir plan"
                  >
                    +
                  </button>
                </div>

                <div
                  onDragOver={(e) => handleDragOver(e, iso)}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={(e) => handleDrop(e, iso)}
                  className={cn(
                    'flex-1 min-h-[100px] rounded-lg border border-dashed p-2 transition-colors',
                    isOver && 'border-primary bg-secondary',
                    !isOver && 'border-border/80',
                  )}
                >
                  {!plan ? (
                    <p className="text-xs text-muted-foreground text-center py-6 px-1">{emptyHint}</p>
                  ) : (
                    <div
                      draggable
                      onDragStart={(e) => handlePlanDragStart(e, plan.id)}
                      className={cn(
                        'group flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm cursor-grab active:cursor-grabbing',
                        plan.completed
                          ? 'border-primary/40 bg-secondary'
                          : 'border-border bg-background hover:border-primary/30',
                      )}
                    >
                      <span className="flex-1 select-none leading-snug">
                        {plan.completed && <span className="mr-1">✓</span>}
                        {plan.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemove(plan.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive opacity-60 sm:opacity-0 group-hover:opacity-100"
                        aria-label="Quitar plan"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full text-xs"
                  onClick={() => onOpenDay(iso)}
                >
                  {plan?.completed ? 'Ver entreno' : 'Registrar entreno'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function useDefaultViewStart() {
  return subDays(new Date(), 1);
}
