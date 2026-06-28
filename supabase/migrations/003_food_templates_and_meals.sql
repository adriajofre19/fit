-- Plantillas de alimentos reutilizables + comidas por día y franja horaria

CREATE TABLE food_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE day_meal_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date         date NOT NULL,
  meal_type        text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
  name             text NOT NULL,
  food_template_id uuid REFERENCES food_templates(id) ON DELETE SET NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX food_templates_user_idx ON food_templates (user_id);
CREATE INDEX day_meal_items_user_date_idx ON day_meal_items (user_id, log_date);
CREATE INDEX day_meal_items_user_date_meal_idx ON day_meal_items (user_id, log_date, meal_type);

-- Migrar textos antiguos de daily_logs a day_meal_items
INSERT INTO day_meal_items (user_id, log_date, meal_type, name, sort_order)
SELECT user_id, log_date, 'breakfast', breakfast, 0
FROM daily_logs
WHERE breakfast IS NOT NULL AND trim(breakfast) <> '';

INSERT INTO day_meal_items (user_id, log_date, meal_type, name, sort_order)
SELECT user_id, log_date, 'lunch', lunch, 0
FROM daily_logs
WHERE lunch IS NOT NULL AND trim(lunch) <> '';

INSERT INTO day_meal_items (user_id, log_date, meal_type, name, sort_order)
SELECT user_id, log_date, 'snack', snack, 0
FROM daily_logs
WHERE snack IS NOT NULL AND trim(snack) <> '';

INSERT INTO day_meal_items (user_id, log_date, meal_type, name, sort_order)
SELECT user_id, log_date, 'dinner', dinner, 0
FROM daily_logs
WHERE dinner IS NOT NULL AND trim(dinner) <> '';

ALTER TABLE food_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_templates_own" ON food_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_meal_items_own" ON day_meal_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
