export type CardioType = 'long_run' | 'intervals' | 'yoyo_test' | 'daily_steps';
export type CardioSource = 'manual' | 'strava';

export interface LongRunDetails {
  distance_km: number;
  duration_seconds: number;
  avg_pace_seconds_per_km?: number;
}

export interface IntervalsDetails {
  interval_count: number;
  interval_distance_m?: number;
  interval_duration_seconds?: number;
  from_interval: number;
  to_interval: number;
  rest_seconds?: number;
}

export interface YoyoTestDetails {
  level: number;
  shuttles: number;
}

export interface DailyStepsDetails {
  steps_count: number;
}

export type CardioDetails =
  | LongRunDetails
  | IntervalsDetails
  | YoyoTestDetails
  | DailyStepsDetails;

export interface Database {
  public: {
    Tables: {
      daily_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          breakfast: string | null;
          lunch: string | null;
          snack: string | null;
          dinner: string | null;
          water_glasses: number;
          water_bottles: number;
          steps_count: number;
          supplement_protein: boolean;
          supplement_creatine: boolean;
          supplement_magnesium: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          breakfast?: string | null;
          lunch?: string | null;
          snack?: string | null;
          dinner?: string | null;
          water_glasses?: number;
          water_bottles?: number;
          steps_count?: number;
          supplement_protein?: boolean;
          supplement_creatine?: boolean;
          supplement_magnesium?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daily_logs']['Insert']>;
      };
      weight_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          weight_kg: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          weight_kg: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['weight_logs']['Insert']>;
      };
      routine_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['routine_templates']['Insert']>;
      };
      routine_exercises: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          name: string;
          target_sets: number;
          target_reps: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id: string;
          name: string;
          target_sets?: number;
          target_reps?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['routine_exercises']['Insert']>;
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_date: string;
          template_id: string | null;
          name: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_date: string;
          template_id?: string | null;
          name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_sessions']['Insert']>;
      };
      workout_exercises: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          routine_exercise_id: string | null;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          routine_exercise_id?: string | null;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_exercises']['Insert']>;
      };
      workout_sets: {
        Row: {
          id: string;
          user_id: string;
          workout_exercise_id: string;
          set_number: number;
          reps: number;
          weight_kg: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_exercise_id: string;
          set_number: number;
          reps: number;
          weight_kg?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_sets']['Insert']>;
      };
      cardio_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_date: string;
          type: CardioType;
          source: CardioSource;
          external_id: string | null;
          details: CardioDetails;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_date: string;
          type: CardioType;
          source?: CardioSource;
          external_id?: string | null;
          details?: CardioDetails;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cardio_sessions']['Insert']>;
      };
      food_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['food_templates']['Insert']>;
      };
      day_meal_items: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
          name: string;
          food_template_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
          name: string;
          food_template_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['day_meal_items']['Insert']>;
      };
    };
  };
}

export type DailyLog = Database['public']['Tables']['daily_logs']['Row'];
export type WeightLog = Database['public']['Tables']['weight_logs']['Row'];
export type RoutineTemplate = Database['public']['Tables']['routine_templates']['Row'];
export type RoutineExercise = Database['public']['Tables']['routine_exercises']['Row'];
export type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row'];
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row'];
export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row'];
export type CardioSession = Database['public']['Tables']['cardio_sessions']['Row'];
export type FoodTemplate = Database['public']['Tables']['food_templates']['Row'];
export type DayMealItem = Database['public']['Tables']['day_meal_items']['Row'];
export type MealType = DayMealItem['meal_type'];
