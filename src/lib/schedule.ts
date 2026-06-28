export type PlanDragPayload =
  | { kind: 'plan'; planId: string }
  | { kind: 'gym-template'; templateId: string; name: string }
  | { kind: 'cardio-template'; plannedType: string; name: string };

export function parsePlanDragPayload(raw: string): PlanDragPayload | null {
  try {
    return JSON.parse(raw) as PlanDragPayload;
  } catch {
    return null;
  }
}

export interface DayPlanView {
  id: string;
  plan_date: string;
  name: string;
  completed: boolean;
}
