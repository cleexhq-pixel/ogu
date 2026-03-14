-- Run in Supabase SQL Editor to create the streaks table for the learning streak feature.

CREATE TABLE IF NOT EXISTS streaks (
  user_id text PRIMARY KEY,
  current_streak integer DEFAULT 1,
  best_streak integer DEFAULT 1,
  total_sessions integer DEFAULT 0,
  last_study text NOT NULL DEFAULT to_char(now()::date, 'YYYY-MM-DD')
);

-- If RLS is enabled, allow anon to read/insert/update:
-- ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon read write streaks" ON streaks FOR ALL TO anon USING (true) WITH CHECK (true);
