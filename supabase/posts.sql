-- Run this in Supabase SQL Editor to create the posts table for the community board.

CREATE TABLE posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  language text DEFAULT 'ko',
  likes integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- If RLS is enabled on your project, allow anon to read/insert/update for the board:
-- ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon read insert update posts" ON posts FOR ALL TO anon USING (true) WITH CHECK (true);
