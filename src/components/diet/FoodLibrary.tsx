import type { FoodTemplate } from '../../types/database';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

interface FoodLibraryProps {
  foods: FoodTemplate[];
  newFoodName: string;
  onNewFoodNameChange: (value: string) => void;
  onCreateFood: () => void;
  onDeleteFood: (id: string) => void;
  creating: boolean;
}

export function FoodLibrary({
  foods,
  newFoodName,
  onNewFoodNameChange,
  onCreateFood,
  onDeleteFood,
  creating,
}: FoodLibraryProps) {
  function handleDragStart(e: React.DragEvent, food: FoodTemplate) {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ kind: 'template', templateId: food.id, name: food.name }),
    );
    e.dataTransfer.effectAllowed = 'copyMove';
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-foreground mb-1">Mis alimentos</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Crea alimentos reutilizables y arrástralos al horario semanal
      </p>

      <form
        className="flex gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          onCreateFood();
        }}
      >
        <Input
          className="flex-1"
          placeholder="Ej. Café con leche"
          value={newFoodName}
          onChange={(e) => onNewFoodNameChange(e.target.value)}
        />
        <Button type="submit" disabled={creating || !newFoodName.trim()}>
          Crear
        </Button>
      </form>

      {foods.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aún no tienes alimentos guardados
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {foods.map((food) => (
            <div
              key={food.id}
              draggable
              onDragStart={(e) => handleDragStart(e, food)}
              className={cn(
                'group inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary',
                'px-3 py-1.5 text-sm cursor-grab active:cursor-grabbing',
                'hover:border-primary/40 transition-colors',
              )}
            >
              <span className="select-none">{food.name}</span>
              <button
                type="button"
                onClick={() => onDeleteFood(food.id)}
                className="text-muted-foreground hover:text-destructive text-xs opacity-60 group-hover:opacity-100"
                aria-label={`Eliminar ${food.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
