-- Mi Rutina — esquema inicial
-- Ejecutar en el SQL Editor de Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Dieta, agua, suplementos y pasos diarios ───────────────────────────────

CREATE TABLE daily_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date             date NOT NULL,
  breakfast            text,
  lunch                text,
  snack                text,
  dinner               text,
  water_glasses        integer NOT NULL DEFAULT 0 CHECK (water_glasses >= 0),
  water_bottles        integer NOT NULL DEFAULT 0 CHECK (water_bottles >= 0),
  steps_count          integer NOT NULL DEFAULT 0 CHECK (steps_count >= 0),
  supplement_protein   boolean NOT NULL DEFAULT false,
  supplement_creatine  boolean NOT NULL DEFAULT false,
  supplement_magnesium boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- ─── Peso corporal ───────────────────────────────────────────────────────────

CREATE TABLE weight_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date   date NOT NULL,
  weight_kg  numeric(4, 1) NOT NULL CHECK (weight_kg > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- ─── Plantillas de rutina (gimnasio) ────────────────────────────────────────

CREATE TABLE routine_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE routine_exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id  uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  name         text NOT NULL,
  target_sets  integer NOT NULL DEFAULT 3 CHECK (target_sets > 0),
  target_reps  integer NOT NULL DEFAULT 10 CHECK (target_reps > 0),
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Sesiones de entrenamiento de fuerza (máx. 1 por día) ───────────────────

CREATE TABLE workout_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date  date NOT NULL,
  template_id   uuid REFERENCES routine_templates(id) ON DELETE SET NULL,
  name          text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_date)
);

CREATE TABLE workout_exercises (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id          uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  routine_exercise_id uuid REFERENCES routine_exercises(id) ON DELETE SET NULL,
  name                text NOT NULL,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workout_sets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_exercise_id uuid NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number          integer NOT NULL CHECK (set_number > 0),
  reps                integer NOT NULL CHECK (reps >= 0),
  weight_kg           numeric(5, 2) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── Cardio / running ───────────────────────────────────────────────────────
-- TODO: integración Strava OAuth + webhook de actividades
-- Al sincronizar: INSERT con source='strava', external_id=<activity_id>
-- Upsert por (user_id, external_id) para evitar duplicados

CREATE TABLE cardio_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date  date NOT NULL,
  type          text NOT NULL CHECK (type IN ('long_run', 'intervals', 'yoyo_test', 'daily_steps')),
  source        text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'strava')),
  external_id   text,
  details       jsonb NOT NULL DEFAULT '{}',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cardio_sessions_strava_unique
  ON cardio_sessions (user_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX cardio_sessions_daily_steps_unique
  ON cardio_sessions (user_id, session_date)
  WHERE type = 'daily_steps';

-- ─── Índices de rendimiento ──────────────────────────────────────────────────

CREATE INDEX daily_logs_user_date_idx ON daily_logs (user_id, log_date);
CREATE INDEX weight_logs_user_date_idx ON weight_logs (user_id, log_date);
CREATE INDEX workout_sessions_user_date_idx ON workout_sessions (user_id, session_date);
CREATE INDEX cardio_sessions_user_date_idx ON cardio_sessions (user_id, session_date);
CREATE INDEX cardio_sessions_user_type_idx ON cardio_sessions (user_id, type);

-- ─── Trigger updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON daily_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER weight_logs_updated_at
  BEFORE UPDATE ON weight_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER routine_templates_updated_at
  BEFORE UPDATE ON routine_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workout_sessions_updated_at
  BEFORE UPDATE ON workout_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cardio_sessions_updated_at
  BEFORE UPDATE ON cardio_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cardio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_logs_own" ON daily_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weight_logs_own" ON weight_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "routine_templates_own" ON routine_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "routine_exercises_own" ON routine_exercises
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_sessions_own" ON workout_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_exercises_own" ON workout_exercises
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_sets_own" ON workout_sets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cardio_sessions_own" ON cardio_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
