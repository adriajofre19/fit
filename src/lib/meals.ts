export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Desayuno', emoji: '🍳' },
  { id: 'lunch', label: 'Comida', emoji: '🍽️' },
  { id: 'snack', label: 'Merienda', emoji: '🥪' },
  { id: 'dinner', label: 'Cena', emoji: '🌙' },
] as const;

export type MealType = (typeof MEAL_SLOTS)[number]['id'];

export type DragPayload =
  | { kind: 'item'; itemId: string }
  | { kind: 'template'; templateId: string; name: string };

export function parseDragPayload(raw: string): DragPayload | null {
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

export function slotKey(date: string, mealType: MealType): string {
  return `${date}:${mealType}`;
}

export function hasMealType(
  items: { meal_type: MealType }[],
  mealType: MealType,
): boolean {
  return items.some((item) => item.meal_type === mealType);
}

export function groupMealsBySlot<T extends { log_date: string; meal_type: MealType; sort_order: number }>(
  items: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = slotKey(item.log_date, item.meal_type);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }
  return map;
}
