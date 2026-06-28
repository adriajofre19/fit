-- Planificación de rutinas de gimnasio y cardio por día

CREATE TABLE gym_day_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date   date NOT NULL,
  template_id uuid REFERENCES routine_templates(id) ON DELETE SET NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

CREATE TABLE cardio_day_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date     date NOT NULL,
  planned_type  text NOT NULL CHECK (planned_type IN ('long_run', 'intervals', 'yoyo_test')),
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

CREATE INDEX gym_day_plans_user_date_idx ON gym_day_plans (user_id, plan_date);
CREATE INDEX cardio_day_plans_user_date_idx ON cardio_day_plans (user_id, plan_date);

CREATE TRIGGER gym_day_plans_updated_at
  BEFORE UPDATE ON gym_day_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cardio_day_plans_updated_at
  BEFORE UPDATE ON cardio_day_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE gym_day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE cardio_day_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_day_plans_own" ON gym_day_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cardio_day_plans_own" ON cardio_day_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
