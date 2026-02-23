"use client";

import { useState, useEffect } from "react";
import { Check, Clock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Player {
  id: string;
  username: string;
  is_host: boolean;
  turn_order: number;
}

interface Prompt {
  id: string;
  room_id: string;
  category: string;
  prompt_text: string;
  setter_id: string;
  turn_index: number;
  drawer_id: string | null;
}

interface PromptSettingProps {
  roomId: string;
  players: Player[];
  currentPlayerId: string;
  isHost: boolean;
  onAllPromptsSet: () => void;
}

// プレイヤー数に応じたカテゴリ
function getCategoriesForPlayerCount(count: number): string[] {
  if (count <= 2) return ["だれが", "何をした"];
  if (count === 3) return ["どこで", "だれが", "何をした"];
  if (count === 4) return ["いつ", "どこで", "だれが", "何をした"];
  if (count === 5) return ["いつ", "どこで", "だれが", "誰に", "何をした"];
  // 6人以上: 基本5 + 残りは「どのように」
  const cats = ["いつ", "どこで", "だれが", "誰に", "何をした"];
  for (let i = 5; i < count; i++) {
    cats.push("どのように");
  }
  return cats;
}

// カテゴリの絵文字
function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    "いつ": "🕐",
    "どこで": "📍",
    "だれが": "👤",
    "誰に": "👥",
    "何をした": "⚡",
    "どのように": "💫",
  };
  return map[cat] || "❓";
}

// カテゴリの色
function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    "いつ": "#eab308",
    "どこで": "#22c55e",
    "だれが": "#3b82f6",
    "誰に": "#8b5cf6",
    "何をした": "#ef4444",
    "どのように": "#ec4899",
  };
  return map[cat] || "#6b7280";
}

// カテゴリのヒント
function getCategoryHint(cat: string): string {
  const map: Record<string, string> = {
    "いつ": "例: 真夜中に、お正月に、100年後",
    "どこで": "例: 学校で、宇宙で、お風呂で",
    "だれが": "例: 猫が、社長が、宇宙人が",
    "誰に": "例: お母さんに、先生に、ライオンに",
    "何をした": "例: 踊った、爆発した、告白した",
    "どのように": "例: 全力で、こっそり、泣きながら",
  };
  return map[cat] || "";
}

export default function PromptSetting({
  roomId,
  players,
  currentPlayerId,
  isHost,
  onAllPromptsSet,
}: PromptSettingProps) {
  const [myCategory, setMyCategory] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  const sortedPlayers = [...players].sort(
    (a, b) => a.turn_order - b.turn_order
  );
  const categories = getCategoriesForPlayerCount(sortedPlayers.length);

  // カテゴリ割り当て（ルームIDベースの疑似ランダムで全員同じ結果に）
  useEffect(() => {
    // roomId をシードに使ってシャッフル（全クライアントで同じ結果）
    const seed = roomId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const shuffled = [...sortedPlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (seed * (i + 1) * 7919) % (i + 1); // 簡易シャッフル
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const myIndex = shuffled.findIndex((p) => p.id === currentPlayerId);
    if (myIndex >= 0 && myIndex < categories.length) {
      setMyCategory(categories[myIndex]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, sortedPlayers.length, currentPlayerId, categories.length]);

  // 既存プロンプトを取得 & リアルタイム購読
  useEffect(() => {
    const loadPrompts = async () => {
      const { data } = await supabase
        .from("prompts")
        .select("*")
        .eq("room_id", roomId);

      if (data) {
        setPrompts(data);
        setSubmittedCount(data.length);
        const mine = data.find((p) => p.setter_id === currentPlayerId);
        if (mine) {
          setIsSubmitted(true);
          setPromptText(mine.prompt_text);
        }
      }
    };
    loadPrompts();

    const channel = supabase
      .channel(`prompts-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "prompts",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newPrompt = payload.new as Prompt;
          setPrompts((prev) => {
            if (prev.some((p) => p.id === newPrompt.id)) return prev;
            return [...prev, newPrompt];
          });
          setSubmittedCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentPlayerId]);

  // 全員提出完了チェック
  useEffect(() => {
    if (submittedCount >= categories.length && categories.length > 0) {
      // ホストが描画割り当てを行ってゲームを開始
      if (isHost) {
        assignDrawersAndStart();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedCount, categories.length, isHost]);

  // 描画者の割り当て + ゲーム開始
  const assignDrawersAndStart = async () => {
    // 最新のプロンプトを取得
    const { data: allPrompts } = await supabase
      .from("prompts")
      .select("*")
      .eq("room_id", roomId)
      .order("turn_index", { ascending: true });

    if (!allPrompts || allPrompts.length < categories.length) return;

    // 各プロンプトに描画者を割り当て（設定者以外）
    const seed = roomId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const shuffled = [...sortedPlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (seed * (i + 1) * 7919) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (let i = 0; i < allPrompts.length; i++) {
      const prompt = allPrompts[i];
      // 設定者以外のプレイヤーをローテーションで割り当て
      const availablePlayers = sortedPlayers.filter(
        (p) => p.id !== prompt.setter_id
      );
      const drawer = availablePlayers[i % availablePlayers.length];

      await supabase
        .from("prompts")
        .update({ drawer_id: drawer.id })
        .eq("id", prompt.id);
    }

    // ゲーム開始
    await supabase
      .from("rooms")
      .update({ status: "playing", current_turn: 0 })
      .eq("id", roomId);

    onAllPromptsSet();
  };

  // お題を提出
  const handleSubmit = async () => {
    if (!promptText.trim() || !myCategory) return;
    setIsSubmitting(true);

    try {
      // turn_index はカテゴリの順序に対応
      const turnIndex = categories.indexOf(myCategory);

      const { error } = await supabase.from("prompts").insert({
        room_id: roomId,
        category: myCategory,
        prompt_text: promptText.trim(),
        setter_id: currentPlayerId,
        turn_index: turnIndex,
      });

      if (error) throw error;
      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!myCategory) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-xl text-text-muted">
          カテゴリを割り当て中...
        </div>
      </div>
    );
  }

  const color = getCategoryColor(myCategory);
  const emoji = getCategoryEmoji(myCategory);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="text-center mb-8 animate-slide-up">
        <h1 className="text-3xl font-extrabold text-text-primary mb-2">
          📝 お題をセットしよう
        </h1>
        <p className="text-text-muted text-sm">
          各プレイヤーが秘密のお題を設定します
        </p>
      </div>

      <div className="w-full max-w-md space-y-5">
        {/* My Category */}
        <div
          className="glass-card p-6 animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="text-center mb-4">
            <span className="text-4xl mb-2 block">{emoji}</span>
            <h2 className="text-xl font-bold" style={{ color }}>
              あなたの担当: {myCategory}
            </h2>
            <p className="text-text-muted text-xs mt-1">
              {getCategoryHint(myCategory)}
            </p>
          </div>

          {!isSubmitted ? (
            <div className="space-y-3">
              <input
                type="text"
                className="input-field text-center text-lg"
                placeholder={`「${myCategory}」のお題を入力...`}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                maxLength={20}
                autoFocus
              />
              <button
                onClick={handleSubmit}
                disabled={!promptText.trim() || isSubmitting}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">送信中...</span>
                ) : (
                  <>
                    <Check size={20} />
                    お題を決定
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-3">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <Check size={16} />
                送信済み: 「{promptText}」
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <div
          className="glass-card p-4 animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-text-muted flex items-center gap-1.5">
              <Clock size={14} />
              お題の提出状況
            </h3>
            <span className="text-sm font-bold text-secondary">
              {submittedCount} / {categories.length}
            </span>
          </div>

          <div className="space-y-2">
            {categories.map((cat, i) => {
              const submitted = prompts.some((p) => p.category === cat && p.turn_index === i);
              const isMine = cat === myCategory;
              return (
                <div
                  key={`${cat}-${i}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="text-lg">{getCategoryEmoji(cat)}</span>
                  <span
                    className="font-medium"
                    style={{ color: getCategoryColor(cat) }}
                  >
                    {cat}
                  </span>
                  <span className="flex-1" />
                  {submitted ? (
                    <span className="flex items-center gap-1 text-accent-green text-xs">
                      <Check size={12} />
                      {isMine ? (
                        <EyeOff size={12} />
                      ) : (
                        <Eye size={12} />
                      )}
                    </span>
                  ) : (
                    <span className="text-text-muted text-xs animate-pulse">
                      入力中...
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Waiting message */}
        {isSubmitted && submittedCount < categories.length && (
          <div className="text-center animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <p className="text-text-secondary animate-pulse text-sm">
              他のプレイヤーのお題入力を待っています...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export { getCategoriesForPlayerCount, getCategoryEmoji, getCategoryColor };
