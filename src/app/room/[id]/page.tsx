"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  Play,
  ArrowLeft,
  Palette,
  Shuffle,
  Pencil,
  Clock,
  RefreshCw,
  Settings,
  Gamepad2,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase";
import Lobby from "@/components/Lobby";
import GameScreen from "@/components/GameScreen";
import PromptSetting from "@/components/PromptSetting";

// かんたん：単語・シンプルなお題
const THEMES_EASY = [
  // 動物
  "ネコ", "イヌ", "ペンギン", "サメ", "クジラ", "ドラゴン", "恐竜",
  "ウサギ", "パンダ", "ライオン", "ゾウ", "キリン", "カメ", "タコ",
  "フラミンゴ", "ハムスター", "カエル", "チョウ", "コウモリ", "ユニコーン",
  // 食べ物
  "ピザ", "ケーキ", "ラーメン", "お寿司", "ハンバーガー", "アイスクリーム",
  "おにぎり", "たこ焼き", "パンケーキ", "ドーナツ", "フライドチキン", "カレーライス",
  // 乗り物・建物
  "ロケット", "UFO", "自転車", "飛行機", "新幹線", "潜水艦", "ヘリコプター",
  "お城", "東京タワー", "灯台", "観覧車", "ジェットコースター",
  // 自然・天体
  "富士山", "虹", "ヒマワリ", "桜", "流れ星", "太陽", "月",
  "雪だるま", "火山", "滝", "サボテン", "クローバー",
  // 人物・キャラクター
  "忍者", "宇宙飛行士", "海賊", "魔法使い", "ロボット", "王様",
  "サンタクロース", "スーパーヒーロー", "人魚", "天使",
  // その他
  "ギター", "テレビ", "カメラ", "傘", "メガネ", "王冠",
  "宝箱", "地球儀", "風船", "花火", "ダイヤモンド", "時計",
];

// むずかしい：状況描写・シーンのお題
const THEMES_HARD = [
  // アクション系
  "ネコがピアノを弾いている",
  "恐竜が衝星から逃げている",
  "忍者がピザを配達している",
  "ロボットが犬の散歩をしている",
  "ペンギンがサーフィンをしている",
  "魔法使いが料理をしている",
  "ドラゴンがアイスクリームを食べている",
  "サメが自転車に乗っている",
  "宇宙飛行士がラーメンを食べている",
  "パンダがスケボをしている",
  "海賊が宝箱を掘り当てている",
  "ユニコーンが虹の上を走っている",
  "ライオンが歯医者さんに行っている",
  "タコが寿司屋で働いている",
  "カエルが王様になっている",
  // 場所・シチュエーション系
  "放課後の学校",
  "深夜のコンビニ",
  "雨の日の遊園地",
  "宇宙から見た地球",
  "無人島のキャンプ",
  "深海のパーティー",
  "雲の上のお城",
  "月面の運動会",
  "ジャングルの遊園地",
  "火星のカフェ",
  "雪山の温泉",
  "水中の図書館",
  // おかしなシチュエーション系
  "サンタがビーチで日光浴している",
  "ゴリラがバレエを踊っている",
  "猫が会議を開いている",
  "タコが富士山に登っている",
  "ペンギンが砂漠で迷子になっている",
  "恋するロボット",
  "寝坊するドラゴン",
  "踊るお寿司",
  "筋トレする雪だるま",
  "プロポーズするカエル",
];

interface Room {
  id: string;
  room_code: string;
  status: string;
  current_turn: number;
  theme: string | null;
  time_limit: number;
  rounds: number;
  game_mode: string;
  allow_color_change: boolean;
}

interface Player {
  id: string;
  username: string;
  is_host: boolean;
  turn_order: number;
  room_id: string;
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: roomId } = use(params);
  const router = useRouter();
  const { session, isLoaded } = useSession();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [theme, setTheme] = useState("");
  const [timeLimit, setTimeLimit] = useState(10);
  const [rounds, setRounds] = useState(1);
  const [gameMode, setGameMode] = useState("normal");
  const [allowColorChange, setAllowColorChange] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  const isHost = players.some(
    (p) => p.id === session?.sessionId && p.is_host
  );

  // 部屋情報と参加者を取得
  const fetchRoomData = useCallback(async () => {
    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomData) {
      setRoom(roomData);
      if (roomData.theme) setTheme(roomData.theme);
      if (roomData.time_limit) setTimeLimit(roomData.time_limit);
      if (roomData.rounds) setRounds(roomData.rounds);
      if (roomData.game_mode) setGameMode(roomData.game_mode);
      setAllowColorChange(roomData.allow_color_change ?? false);
    }

    const { data: playersData } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("turn_order", { ascending: true });

    if (playersData) setPlayers(playersData);
  }, [roomId]);

  // 初期データ取得 & Realtime 購読
  useEffect(() => {
    if (!isLoaded || !session) return;
    fetchRoomData();

    // Players テーブルの変更を購読
    const playersChannel = supabase
      .channel(`players-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchRoomData();
        }
      )
      .subscribe();

    // Rooms テーブルの変更を購読
    const roomChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updatedRoom = payload.new as Room;
          setRoom(updatedRoom);
          if (updatedRoom.theme) setTheme(updatedRoom.theme);
          if (updatedRoom.time_limit) setTimeLimit(updatedRoom.time_limit);
          if (updatedRoom.rounds) setRounds(updatedRoom.rounds);
          if (updatedRoom.game_mode) setGameMode(updatedRoom.game_mode);
          setAllowColorChange(updatedRoom.allow_color_change ?? false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [isLoaded, session, roomId, fetchRoomData]);

  // ルームコードコピー
  const handleCopy = async () => {
    if (!room) return;
    await navigator.clipboard.writeText(room.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ランダムお題（難易度別）
  const handleRandomTheme = (difficulty: "easy" | "hard") => {
    const list = difficulty === "easy" ? THEMES_EASY : THEMES_HARD;
    const randomTheme = list[Math.floor(Math.random() * list.length)];
    setTheme(randomTheme);
  };

  // ゲーム開始
  const handleStartGame = async () => {
    if (!isHost || !room) return;

    if (players.length < 2) {
      setError("ゲームを開始するには、少なくとも2人必要です。");
      return;
    }

    if (gameMode !== "itsu-doko" && !theme.trim()) {
      setError("お題を設定してください。");
      return;
    }

    setIsStarting(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("rooms")
        .update({
          status: gameMode === "itsu-doko" ? "setting_prompts" : "playing",
          theme: gameMode === "itsu-doko" ? "いつどこでだれが何をした" : theme.trim(),
          current_turn: 0,
          time_limit: timeLimit,
          rounds: 1, // itsu-dokoは常に1周
          game_mode: gameMode,
          allow_color_change: allowColorChange,
        })
        .eq("id", room.id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error(err);
      setError("ゲームの開始に失敗しました。");
    } finally {
      setIsStarting(false);
    }
  };

  // 退室
  const handleLeave = async () => {
    if (!session) return;
    await supabase.from("players").delete().eq("id", session.sessionId);
    router.push("/");
  };

  // Loading / Auth guard
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-2xl text-text-muted">
          読み込み中...
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-xl text-text-muted">
          ルームを読み込み中...
        </div>
      </div>
    );
  }

  // お題設定中（いつどこでモード）
  if (room.status === "setting_prompts") {
    return (
      <PromptSetting
        roomId={room.id}
        players={players}
        currentPlayerId={session.sessionId}
        isHost={isHost}
        onAllPromptsSet={() => {}}
      />
    );
  }

  // ゲーム開始済み or 終了 → ゲーム画面
  if (room.status === "playing" || room.status === "finished") {
    return (
      <GameScreen
        room={room}
        players={players}
        currentPlayerId={session.sessionId}
        isHost={isHost}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      {/* Header */}
      <div className="w-full max-w-lg mb-6 animate-slide-up">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors text-sm mb-4"
        >
          <ArrowLeft size={16} />
          ホームに戻る
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Palette size={28} className="text-secondary" />
              ロビー
            </h1>
          </div>

          {/* Room Code */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card/60 border border-primary-light/20 hover:border-primary-light/40 transition-all group"
          >
            <span className="text-text-muted text-sm">ルームコード</span>
            <span className="text-2xl font-bold tracking-widest text-secondary">
              {room.room_code}
            </span>
            {copied ? (
              <Check size={18} className="text-accent-green" />
            ) : (
              <Copy
                size={18}
                className="text-text-muted group-hover:text-text-primary transition-colors"
              />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-lg space-y-5">
        {/* Players List */}
        <div
          className="glass-card p-5 animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <Lobby players={players} currentPlayerId={session.sessionId} />
        </div>

        {/* Host Settings */}
        {isHost && (
          <>
            {/* Theme Setting - hide for itsu-doko */}
            {gameMode !== "itsu-doko" && (
            <div
              className="glass-card p-5 animate-slide-up"
              style={{ animationDelay: "0.2s" }}
            >
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                <Pencil size={20} className="text-accent-pink" />
                お題を設定
              </h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="お題を入力..."
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  maxLength={30}
                />
              </div>

              {/* 難易度別ランダムボタン */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleRandomTheme("easy")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-accent-green/15 hover:bg-accent-green/25 border border-accent-green/20 hover:border-accent-green/40 transition-all text-accent-green font-medium text-sm"
                >
                  <Shuffle size={16} />
                  かんたん
                </button>
                <button
                  onClick={() => handleRandomTheme("hard")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-accent-pink/15 hover:bg-accent-pink/25 border border-accent-pink/20 hover:border-accent-pink/40 transition-all text-accent-pink font-medium text-sm"
                >
                  <Shuffle size={16} />
                  むずかしい
                </button>
              </div>
            </div>
            )}

            {/* itsu-doko mode description */}
            {gameMode === "itsu-doko" && (
              <div
                className="glass-card p-5 animate-slide-up"
                style={{ animationDelay: "0.2s" }}
              >
                <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                  🎲 いつどこでだれが何をした
                </h3>
                <p className="text-sm text-text-muted">
                  各プレイヤーに「いつ」「どこで」「だれが」などのカテゴリが割り当てられ、秘密のお題を設定します。
                  描くプレイヤーには順番にお題が明かされます。
                </p>
                <p className="text-xs text-text-muted mt-2">
                  ※ お題と周回数の設定は不要です
                </p>
              </div>
            )}

            {/* Game Settings */}
            <div
              className="glass-card p-5 animate-slide-up"
              style={{ animationDelay: "0.25s" }}
            >
              <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                <Settings size={20} className="text-accent-cyan" />
                ゲーム設定
              </h3>

              <div className="space-y-4">
                {/* Time Limit */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                      <Clock size={16} className="text-text-muted" />
                      1人あたりの制限時間
                    </label>
                    <span className="text-lg font-bold text-secondary tabular-nums">
                      {timeLimit}秒
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
                    style={{
                      background: `linear-gradient(to right, #7c3aed ${((timeLimit - 5) / 55) * 100}%, #312e81 ${((timeLimit - 5) / 55) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>5秒</span>
                    <span>30秒</span>
                    <span>60秒</span>
                  </div>
                </div>

                {/* Rounds */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                      <RefreshCw size={16} className="text-text-muted" />
                      周回数
                    </label>
                    <span className="text-lg font-bold text-secondary tabular-nums">
                      {rounds}周
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRounds(r)}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                          rounds === r
                            ? "bg-primary text-white shadow-lg shadow-primary/30"
                            : "bg-surface-light text-text-muted hover:text-text-secondary hover:bg-surface-card"
                        }`}
                      >
                        {r}周
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-1.5">
                    合計ターン数: {players.length * rounds}ターン
                    （{players.length}人 × {rounds}周）
                  </p>
                </div>

                {/* Game Mode */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Gamepad2 size={16} className="text-text-muted" />
                    <label className="text-sm font-medium text-text-secondary">
                      ゲームモード
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setGameMode("normal")}
                      className={`flex-1 py-3 px-3 rounded-xl text-sm font-bold transition-all text-center ${
                        gameMode === "normal"
                          ? "bg-primary text-white shadow-lg shadow-primary/30"
                          : "bg-surface-light text-text-muted hover:text-text-secondary hover:bg-surface-card"
                      }`}
                    >
                      🎨 ノーマル
                      <p className={`text-xs mt-0.5 font-normal ${
                        gameMode === "normal" ? "text-white/70" : "text-text-muted"
                      }`}>
                        自由に描画
                      </p>
                    </button>
                    <button
                      onClick={() => setGameMode("one-color")}
                      className={`flex-1 py-3 px-3 rounded-xl text-sm font-bold transition-all text-center ${
                        gameMode === "one-color"
                          ? "bg-primary text-white shadow-lg shadow-primary/30"
                          : "bg-surface-light text-text-muted hover:text-text-secondary hover:bg-surface-card"
                      }`}
                    >
                      🌈 1人1色
                      <p className={`text-xs mt-0.5 font-normal ${
                        gameMode === "one-color" ? "text-white/70" : "text-text-muted"
                      }`}>
                        各自1色で協力
                      </p>
                    </button>
                    <button
                      onClick={() => setGameMode("itsu-doko")}
                      className={`flex-1 py-3 px-3 rounded-xl text-sm font-bold transition-all text-center ${
                        gameMode === "itsu-doko"
                          ? "bg-primary text-white shadow-lg shadow-primary/30"
                          : "bg-surface-light text-text-muted hover:text-text-secondary hover:bg-surface-card"
                      }`}
                    >
                      🎲 いつどこで
                      <p className={`text-xs mt-0.5 font-normal ${
                        gameMode === "itsu-doko" ? "text-white/70" : "text-text-muted"
                      }`}>
                        お題リレー
                      </p>
                    </button>
                  </div>
                </div>

                {/* Color Change Setting (only for one-color mode with rounds > 1) */}
                {gameMode === "one-color" && rounds > 1 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-light/50">
                    <div>
                      <p className="text-sm font-medium text-text-secondary">
                        2周目以降の色変更
                      </p>
                      <p className="text-xs text-text-muted">
                        周回ごとに新しい色を選べます
                      </p>
                    </div>
                    <button
                      onClick={() => setAllowColorChange(!allowColorChange)}
                      className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                        allowColorChange
                          ? "bg-accent-green"
                          : "bg-surface-card"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-300 ${
                          allowColorChange ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Non-host info display */}
        {!isHost && (
          <div
            className="glass-card p-5 animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            {room.theme && (
              <div className="mb-3">
                <h3 className="text-sm font-bold text-text-muted mb-1 flex items-center gap-1.5">
                  <Pencil size={14} />
                  お題
                </h3>
                <p className="text-xl font-bold text-secondary">
                  {room.theme}
                </p>
              </div>
            )}
            <div className="flex gap-4 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <Clock size={14} className="text-text-muted" />
                {room.time_limit ?? 10}秒
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw size={14} className="text-text-muted" />
                {room.rounds ?? 1}周
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-accent-pink text-sm font-medium text-center">
            {error}
          </p>
        )}

        {/* Start Button (Host Only) */}
        {isHost ? (
          <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <button
              className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-4"
              onClick={handleStartGame}
              disabled={isStarting || players.length < 2 || !theme.trim()}
            >
              {isStarting ? (
                <span className="animate-pulse">開始中...</span>
              ) : (
                <>
                  <Play size={24} />
                  ゲームスタート！
                </>
              )}
            </button>
            {players.length < 2 && (
              <p className="text-text-muted text-xs text-center mt-2">
                ゲーム開始にはもう1人必要です
              </p>
            )}
          </div>
        ) : (
          <div
            className="text-center py-4 animate-slide-up"
            style={{ animationDelay: "0.3s" }}
          >
            <p className="text-text-secondary animate-pulse">
              ホストがゲームを開始するのを待っています...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
