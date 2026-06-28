-- Añade registro de botellas de agua (gimnasio, etc.)
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS water_bottles integer NOT NULL DEFAULT 0 CHECK (water_bottles >= 0);
