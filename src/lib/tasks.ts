import type { DailyLog, MealType } from '../types/database';
import { hasWater } from './water';
import { hasMealType } from './meals';

export type TaskId =
  | 'weight'
  | 'breakfast'
  | 'water'
  | 'protein'
  | 'creatine'
  | 'magnesium'
  | 'gym'
  | 'cardio'
  | 'lunch'
  | 'snack'
  | 'dinner';

export interface DailyTask {
  id: TaskId;
  emoji: string;
  label: string;
  href: string;
  completed: boolean;
}

export interface DayStatus {
  weight: number | null;
  waterGlasses: number;
  waterBottles: number;
  hasGym: boolean;
  hasCardio: boolean;
  stepsCount: number;
}

export function buildDailyTasks(
  dailyLog: DailyLog | null,
  todayMeals: { meal_type: MealType }[],
  hasWeight: boolean,
  hasGym: boolean,
  hasCardio: boolean,
): DailyTask[] {
  const hasMeal = (type: MealType) =>
    hasMealType(todayMeals, type) || Boolean(getLegacyMealText(dailyLog, type)?.trim());

  return [
    {
      id: 'weight',
      emoji: '⚖️',
      label: 'Añade tu peso en ayunas',
      href: '/peso',
      completed: hasWeight,
    },
    {
      id: 'breakfast',
      emoji: '🍳',
      label: 'Registra el desayuno',
      href: '/dieta?meal=breakfast',
      completed: hasMeal('breakfast'),
    },
    {
      id: 'water',
      emoji: '💧',
      label: 'Registra el agua',
      href: '/dieta?meal=water',
      completed: hasWater(dailyLog),
    },
    {
      id: 'protein',
      emoji: '💊',
      label: 'Toma la proteína',
      href: '/dieta?meal=protein',
      completed: dailyLog?.supplement_protein ?? false,
    },
    {
      id: 'creatine',
      emoji: '💊',
      label: 'Toma la creatina',
      href: '/dieta?meal=creatine',
      completed: dailyLog?.supplement_creatine ?? false,
    },
    {
      id: 'magnesium',
      emoji: '💊',
      label: 'Toma el magnesio',
      href: '/dieta?meal=magnesium',
      completed: dailyLog?.supplement_magnesium ?? false,
    },
    {
      id: 'gym',
      emoji: '🏋️',
      label: 'Entrenamiento de gimnasio',
      href: '/gimnasio',
      completed: hasGym,
    },
    {
      id: 'cardio',
      emoji: '🏃',
      label: 'Entrenamiento de cardio',
      href: '/entrenos',
      completed: hasCardio,
    },
    {
      id: 'lunch',
      emoji: '🍽️',
      label: 'Registra la comida',
      href: '/dieta?meal=lunch',
      completed: hasMeal('lunch'),
    },
    {
      id: 'snack',
      emoji: '🥪',
      label: 'Registra la merienda',
      href: '/dieta?meal=snack',
      completed: hasMeal('snack'),
    },
    {
      id: 'dinner',
      emoji: '🌙',
      label: 'Registra la cena',
      href: '/dieta?meal=dinner',
      completed: hasMeal('dinner'),
    },
  ];
}

export function getMotivationMessage(completed: number, total: number): string {
  const ratio = completed / total;
  if (ratio === 1) return '¡Día perfecto! Has completado todas tus misiones 🏆';
  if (ratio >= 0.75) return '¡Casi lo tienes! Un último empujón 💪';
  if (ratio >= 0.5) return 'Vas por buen camino, sigue así 🔥';
  if (ratio >= 0.25) return 'Cada paso cuenta, ¡tú puedes! ⚡';
  return 'Hoy es un nuevo día para cuidarte. ¡Empecemos! 🌱';
}

export const CARDIO_WORKOUT_LABELS: Record<string, string> = {
  long_run: '🏃 Tirada larga',
  intervals: '⚡ Series',
  yoyo_test: '🧪 Test Yoyo',
};

export const CARDIO_TYPE_LABELS: Record<string, string> = {
  ...CARDIO_WORKOUT_LABELS,
  daily_steps: '🚶 Pasos diarios',
};

function getLegacyMealText(dailyLog: DailyLog | null, type: MealType): string | null | undefined {
  if (!dailyLog) return undefined;
  switch (type) {
    case 'breakfast':
      return dailyLog.breakfast;
    case 'lunch':
      return dailyLog.lunch;
    case 'snack':
      return dailyLog.snack;
    case 'dinner':
      return dailyLog.dinner;
  }
}
