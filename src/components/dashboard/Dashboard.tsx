import type { DailyTask, DayStatus } from '../../lib/tasks';
import { getMotivationMessage } from '../../lib/tasks';
import { Card, ProgressBar } from '../ui/Card';
import { formatDate, getGreeting, todayISO } from '../../lib/dates';
import { formatWaterSummary } from '../../lib/water';
import { cn } from '../../lib/utils';

interface DashboardProps {
  tasks: DailyTask[];
  status: DayStatus;
}

export function Dashboard({ tasks, status }: DashboardProps) {
  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const message = getMotivationMessage(completed, total);

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="space-y-1">
        <p className="text-muted-foreground text-sm">{formatDate(todayISO(), "EEEE, d 'de' MMMM")}</p>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          {getGreeting()} 👋
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">{message}</p>
      </header>

      <Card>
        <ProgressBar value={completed} max={total} />
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-muted-foreground mb-4">
          Misiones del día
        </h2>
        <ul className="-mx-2">
          {tasks.map((task, i) => (
            <li key={task.id}>
              <a
                href={task.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-4 py-3 transition-colors hover:bg-accent',
                  task.completed && 'task-completed',
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-all',
                    task.completed
                      ? 'border-primary bg-primary text-primary-foreground animate-check-pop'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {task.completed ? '✓' : i + 1}
                </span>
                <span className="text-base">{task.emoji}</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    task.completed ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {task.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SummaryChip
          label="Peso"
          value={status.weight != null ? `${status.weight} kg` : '—'}
          icon="⚖️"
          href="/peso"
        />
        <SummaryChip
          label="Agua"
          value={formatWaterSummary(status.waterGlasses, status.waterBottles)}
          icon="💧"
          href="/dieta?meal=water"
          active={status.waterGlasses > 0 || status.waterBottles > 0}
        />
        <SummaryChip
          label="Pasos"
          value={status.stepsCount > 0 ? status.stepsCount.toLocaleString() : '—'}
          icon="🚶"
          href="/pasos"
          active={status.stepsCount > 0}
        />
        <SummaryChip
          label="Gimnasio"
          value={status.hasGym ? 'Hecho' : 'Pendiente'}
          icon="🏋️"
          href="/gimnasio"
          active={status.hasGym}
        />
        <SummaryChip
          label="Cardio"
          value={status.hasCardio ? 'Hecho' : 'Pendiente'}
          icon="🏃"
          href="/entrenos"
          active={status.hasCardio}
        />
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  icon,
  href,
  active,
}: {
  label: string;
  value: string;
  icon: string;
  href?: string;
  active?: boolean;
}) {
  const className = cn(
    'rounded-lg border p-4 text-center shadow-sm transition-colors hover:bg-accent block',
    active ? 'border-primary bg-secondary' : 'border-border bg-card',
  );

  const content = (
    <>
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1 tabular-nums">{value}</div>
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}
