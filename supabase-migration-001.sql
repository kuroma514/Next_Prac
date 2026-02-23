-- ==========================================
-- Draw-Relay 追加マイグレーション
-- Supabase SQL Editor で実行してください
-- ==========================================

-- rooms テーブルに設定カラムを追加
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS time_limit int DEFAULT 10;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rounds int DEFAULT 1;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_mode text DEFAULT 'normal';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_color_change boolean DEFAULT false;

-- いつどこでだれが何をした モード用: prompts テーブル
CREATE TABLE IF NOT EXISTS prompts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  category text NOT NULL, -- 'いつ', 'どこで', 'だれが', '誰に', '何をした', 'どのように'
  prompt_text text NOT NULL,
  setter_id text NOT NULL, -- プロンプトを設定したプレイヤーのID
  turn_index int NOT NULL, -- 描画順序
  drawer_id text, -- 描くプレイヤーのID
  created_at timestamp with time zone DEFAULT now()
);

-- prompts テーブルの RLS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompts_select" ON prompts FOR SELECT USING (true);
CREATE POLICY "prompts_insert" ON prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "prompts_update" ON prompts FOR UPDATE USING (true);
CREATE POLICY "prompts_delete" ON prompts FOR DELETE USING (true);

-- Realtime を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE prompts;
