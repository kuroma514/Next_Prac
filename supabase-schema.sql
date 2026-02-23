-- ==========================================
-- Draw-Relay データベーススキーマ
-- Supabase SQL Editor で実行してください
-- ==========================================

-- 部屋情報
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  status text DEFAULT 'waiting', -- waiting, playing, finished
  current_turn int DEFAULT 0,
  theme text,
  created_at timestamp with time zone DEFAULT now()
);

-- 参加者情報
CREATE TABLE players (
  id uuid PRIMARY KEY, -- ブラウザ側で生成したセッションID
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  username text NOT NULL,
  turn_order int,
  is_host boolean DEFAULT false,
  joined_at timestamp with time zone DEFAULT now()
);

-- 描画データ
CREATE TABLE strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  player_id uuid,
  path_data jsonb NOT NULL, -- 座標配列 [{x, y}, ...]
  color text DEFAULT '#000000',
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- Realtime を有効にする
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE strokes;

-- ==========================================
-- RLS (Row Level Security) ポリシー
-- ==========================================

-- rooms テーブル
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON rooms
  FOR SELECT USING (true);

CREATE POLICY "rooms_insert" ON rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "rooms_update" ON rooms
  FOR UPDATE USING (true);

-- players テーブル
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_select" ON players
  FOR SELECT USING (true);

CREATE POLICY "players_insert" ON players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "players_update" ON players
  FOR UPDATE USING (true);

CREATE POLICY "players_delete" ON players
  FOR DELETE USING (true);

-- strokes テーブル
ALTER TABLE strokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strokes_select" ON strokes
  FOR SELECT USING (true);

CREATE POLICY "strokes_insert" ON strokes
  FOR INSERT WITH CHECK (true);
