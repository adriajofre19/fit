import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';

export interface DraggableChip {
  id: string;
  label: string;
  dragPayload: object;
}

interface TemplateChipLibraryProps {
  title: string;
  hint: string;
  chips: DraggableChip[];
  emptyMessage?: string;
}

export function TemplateChipLibrary({ title, hint, chips, emptyMessage }: TemplateChipLibraryProps) {
  function handleDragStart(e: React.DragEvent, payload: object) {
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copyMove';
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-foreground mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{hint}</p>
      {chips.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {emptyMessage ?? 'Crea plantillas para arrastrarlas al horario'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <div
              key={chip.id}
              draggable
              onDragStart={(e) => handleDragStart(e, chip.dragPayload)}
              className={cn(
                'inline-flex items-center rounded-md border border-border bg-secondary',
                'px-3 py-2 text-sm cursor-grab active:cursor-grabbing',
                'hover:border-primary/40 transition-colors select-none',
              )}
            >
              {chip.label}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
