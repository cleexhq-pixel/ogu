-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).

-- 1. Create table
CREATE TABLE IF NOT EXISTS active_users (
  id text PRIMARY KEY,
  status text DEFAULT 'browsing',
  last_seen timestamp DEFAULT now()
);

-- 2. RLS: allow all for anonymous app usage (insert/select/update/delete)
ALTER TABLE active_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for active_users" ON active_users;
CREATE POLICY "Allow all for active_users"
  ON active_users FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Enable Realtime for this table
-- In Supabase Dashboard: Database → Replication → select 'active_users' and enable.
-- Or run (if you have permissions):
-- ALTER PUBLICATION supabase_realtime ADD TABLE active_users;
