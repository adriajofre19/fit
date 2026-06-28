import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Checkbox } from '../ui/Input';
import type { DailyLog } from '../../types/database';
import {
  emptyWaterEntry,
  formatWaterSummary,
  isWaterEntryValue,
  type WaterEntryValue,
} from '../../lib/water';
import { formatDate } from '../../lib/dates';

export type ExtraEntryType = 'water' | 'protein' | 'creatine' | 'magnesium';

const EXTRA_ENTRIES: { id: ExtraEntryType; label: string; emoji: string }[] = [
  { id: 'water', label: 'Agua', emoji: '💧' },
  { id: 'protein', label: 'Proteína', emoji: '💊' },
  { id: 'creatine', label: 'Creatina', emoji: '💊' },
  { id: 'magnesium', label: 'Magnesio', emoji: '💊' },
];

interface DietExtrasModalProps {
  open: boolean;
  date: string;
  log: DailyLog | undefined;
  activeEntry: ExtraEntryType | null;
  entryValue: string | number | boolean | WaterEntryValue;
  saving: boolean;
  onClose: () => void;
  onSelectEntry: (entry: ExtraEntryType) => void;
  onBack: () => void;
  onChangeValue: (value: string | number | boolean | WaterEntryValue) => void;
  onSave: () => void;
}

export function DietExtrasModal({
  open,
  date,
  log,
  activeEntry,
  entryValue,
  saving,
  onClose,
  onSelectEntry,
  onBack,
  onChangeValue,
  onSave,
}: DietExtrasModalProps) {
  function isDone(entry: ExtraEntryType): boolean {
    if (!log) return false;
    switch (entry) {
      case 'water':
        return log.water_glasses > 0 || log.water_bottles > 0;
      case 'protein':
        return log.supplement_protein;
      case 'creatine':
        return log.supplement_creatine;
      case 'magnesium':
        return log.supplement_magnesium;
    }
  }

  function summary(entry: ExtraEntryType): string {
    if (!log) return '';
    switch (entry) {
      case 'water':
        return formatWaterSummary(log.water_glasses, log.water_bottles, '');
      case 'protein':
        return log.supplement_protein ? 'Tomado' : '';
      case 'creatine':
        return log.supplement_creatine ? 'Tomado' : '';
      case 'magnesium':
        return log.supplement_magnesium ? 'Tomado' : '';
    }
  }

  const activeConfig = activeEntry
    ? EXTRA_ENTRIES.find((e) => e.id === activeEntry)
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        activeEntry && activeConfig
          ? `${activeConfig.emoji} ${activeConfig.label} — ${formatDate(date, 'd MMM')}`
          : `Agua y suplementos — ${formatDate(date, 'd MMM')}`
      }
    >
      {!activeEntry ? (
        <div className="space-y-2">
          {EXTRA_ENTRIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectEntry(entry.id)}
              className="w-full flex items-center gap-3 rounded-md border border-border px-4 py-3 hover:bg-accent text-left"
            >
              <span>{entry.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{entry.label}</div>
                {summary(entry.id) && (
                  <div className="text-xs text-muted-foreground">{summary(entry.id)}</div>
                )}
              </div>
              {isDone(entry.id) && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
            ← Volver
          </button>
          {renderForm(activeEntry, entryValue, onChangeValue)}
          <Button size="lg" className="w-full" onClick={onSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function renderForm(
  entry: ExtraEntryType,
  value: string | number | boolean | WaterEntryValue,
  setValue: (v: string | number | boolean | WaterEntryValue) => void,
) {
  if (entry === 'water') {
    const water = isWaterEntryValue(value) ? value : emptyWaterEntry();
    return (
      <div className="space-y-4">
        <Input
          label="🥛 Vasos de agua"
          type="number"
          min="0"
          value={water.glasses}
          onChange={(e) => setValue({ ...water, glasses: Number(e.target.value) || 0 })}
        />
        <Input
          label="🧴 Botellas de agua"
          type="number"
          min="0"
          value={water.bottles}
          onChange={(e) => setValue({ ...water, bottles: Number(e.target.value) || 0 })}
        />
      </div>
    );
  }

  const labels: Record<ExtraEntryType, string> = {
    water: '',
    protein: '¿Has tomado la proteína?',
    creatine: '¿Has tomado la creatina?',
    magnesium: '¿Has tomado el magnesio?',
  };

  return (
    <Checkbox
      label={labels[entry]}
      checked={Boolean(value)}
      onChange={(v) => setValue(v)}
    />
  );
}

export function getExtraEntryValue(
  log: DailyLog | undefined,
  entry: ExtraEntryType,
): string | number | boolean | WaterEntryValue {
  if (!log) {
    if (entry === 'water') return emptyWaterEntry();
    return false;
  }
  switch (entry) {
    case 'water':
      return { glasses: log.water_glasses, bottles: log.water_bottles };
    case 'protein':
      return log.supplement_protein;
    case 'creatine':
      return log.supplement_creatine;
    case 'magnesium':
      return log.supplement_magnesium;
  }
}

export function buildExtraUpdatePayload(
  entry: ExtraEntryType,
  value: string | number | boolean | WaterEntryValue,
): Partial<DailyLog> {
  switch (entry) {
    case 'water': {
      const water = isWaterEntryValue(value) ? value : emptyWaterEntry();
      return { water_glasses: water.glasses, water_bottles: water.bottles };
    }
    case 'protein':
      return { supplement_protein: Boolean(value) };
    case 'creatine':
      return { supplement_creatine: Boolean(value) };
    case 'magnesium':
      return { supplement_magnesium: Boolean(value) };
  }
}

export function isExtraEntry(value: string): value is ExtraEntryType {
  return ['water', 'protein', 'creatine', 'magnesium'].includes(value);
}
