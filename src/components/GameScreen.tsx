"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Palette,
  Trophy,
  Users,
  RotateCcw,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Canvas from "@/components/Canvas";
import Timer from "@/components/Timer";

interface Player {
  id: string;
  username: string;
  is_host: boolean;
  turn_order: number;
}

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

interface Stroke {
  id: string;
  path_data: { x: number; y: number }[];
  color: string;
  player_id: string;
}

interface GameScreenProps {
  room: Room;
  players: Player[];
  currentPlayerId: string;
  isHost: boolean;
}

const INTERVAL_DURATION = 3; // ターン切替インターバル（秒）

export default function GameScreen({
  room,
  players,
  currentPlayerId,
  isHost,
}: GameScreenProps) {
  const router = useRouter();
  const [currentTurn, setCurrentTurn] = useState(room.current_turn);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [timerActive, setTimerActive] = useState(false);
  const [gameFinished, setGameFinished] = useState(room.status === "finished");
  const [isInterval, setIsInterval] = useState(true);
  const [intervalCount, setIntervalCount] = useState(INTERVAL_DURATION);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [colorLocked, setColorLocked] = useState(false);
  const [lastColorPickRound, setLastColorPickRound] = useState(0);
  const prevTurnRef = useRef(currentTurn);

  const turnDuration = room.time_limit || 10;
  const roundCount = room.rounds || 1;
  const isOneColorMode = room.game_mode === "one-color";

  const sortedPlayers = [...players].sort(
    (a, b) => a.turn_order - b.turn_order
  );

  // 通常モード/1人1色モードのプレイヤー計算
  const currentPlayer = sortedPlayers[currentTurn % sortedPlayers.length];
  const isMyTurn = currentPlayer?.id === currentPlayerId;
  const totalTurns = sortedPlayers.length * roundCount;
  const currentRound = Math.floor(currentTurn / sortedPlayers.length) + 1;

  // 1人1色モード: 周回が変わったら色をリセット（許可時）
  const shouldPickColor = isOneColorMode && isMyTurn && (!colorLocked || (room.allow_color_change && currentRound !== lastColorPickRound));

  const ONE_COLOR_PALETTE = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#8b5cf6", "#ec4899", "#1e1b4b", "#ffffff",
  ];

  // 初回インターバル処理（色選択待ちを含む）
  useEffect(() => {
    if (gameFinished || !isInterval) return;
    // 1人1色モードで色が未選択ならカウントダウンを開始しない
    if (shouldPickColor && !selectedColor) return;

    setIntervalCount(INTERVAL_DURATION);
    const timer = setInterval(() => {
      setIntervalCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsInterval(false);
          setTimerActive(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isInterval, gameFinished, currentTurn, shouldPickColor, selectedColor]);

  // 初期ストローク取得
  useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase
        .from("strokes")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });
      if (data) setStrokes(data);
    };
    loadData();
  }, [room.id, room.current_turn]);

  // ストロークのリアルタイム購読
  useEffect(() => {
    const channel = supabase
      .channel(`strokes-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "strokes",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const newStroke = payload.new as Stroke;
          setStrokes((prev) => [...prev, newStroke]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  // ルームの変更を購読（ターン更新、ゲーム終了）
  useEffect(() => {
    const channel = supabase
      .channel(`game-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as Room;
          setCurrentTurn(updated.current_turn);
          if (updated.status === "finished") {
            setGameFinished(true);
            setTimerActive(false);
            setIsInterval(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  // ターン変更時にインターバルを開始
  useEffect(() => {
    if (prevTurnRef.current !== currentTurn) {
      prevTurnRef.current = currentTurn;
      if (!gameFinished) {
        setTimerActive(false);
        setIsInterval(true);
        // 周が変わったら色選択をリセット（許可時）
        const newRound = Math.floor(currentTurn / sortedPlayers.length) + 1;
        if (isOneColorMode && room.allow_color_change && newRound !== lastColorPickRound) {
          setSelectedColor(null);
          setColorLocked(false);
          setLastColorPickRound(newRound);
        }
      }
    }
  }, [currentTurn, gameFinished, sortedPlayers.length, isOneColorMode, room.allow_color_change, lastColorPickRound]);

  // ターン終了処理（ホストが実行）
  const handleTimeUp = useCallback(async () => {
    if (!isHost) return;
    setTimerActive(false);

    const nextTurn = currentTurn + 1;

    if (nextTurn >= totalTurns) {
      // ゲーム終了
      await supabase
        .from("rooms")
        .update({ status: "finished", current_turn: nextTurn })
        .eq("id", room.id);
    } else {
      // 次のターン → インターバルに入る
      await supabase
        .from("rooms")
        .update({ current_turn: nextTurn })
        .eq("id", room.id);
    }
  }, [isHost, currentTurn, totalTurns, room.id]);

  // キャンバスを画像としてダウンロード
  const handleDownload = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `draw-relay-${room.room_code}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // ホームに戻る
  const handleBackToHome = () => {
    router.push("/");
  };

  // ===== ゲーム終了画面 =====
  if (gameFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="text-center mb-8 animate-slide-up">
          <Trophy
            size={56}
            className="mx-auto text-secondary mb-3 animate-wiggle"
          />
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-secondary via-accent-pink to-primary-light bg-clip-text text-transparent mb-2">
            完成！🎉
          </h1>
          <p className="text-text-secondary">
            お題:{" "}
            <span className="text-secondary font-bold text-lg">
              {room.theme}
            </span>
          </p>
        </div>

        {/* Final Canvas */}
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <Canvas
            roomId={room.id}
            playerId={currentPlayerId}
            isMyTurn={false}
            existingStrokes={strokes}
          />
        </div>

        {/* Contributors */}
        <div
          className="glass-card p-4 w-full max-w-[500px] mt-6 animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <h3 className="text-sm font-bold text-text-muted mb-2 flex items-center gap-2">
            <Users size={16} />
            参加者
          </h3>
          <div className="flex flex-wrap gap-2">
            {sortedPlayers.map((p, i) => (
              <span
                key={p.id}
                className="px-3 py-1 rounded-full text-sm font-medium bg-surface-light text-text-secondary"
              >
                {i + 1}. {p.username}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex gap-3 mt-6 animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <button
            onClick={handleDownload}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={18} />
            画像を保存
          </button>
          <button
            onClick={handleBackToHome}
            className="btn-primary flex items-center gap-2"
          >
            <RotateCcw size={18} />
            もう一度遊ぶ
          </button>
        </div>
      </div>
    );
  }

  // ===== ターン切替インターバル =====
  if (isInterval) {
    // 1人1色モード: 色選択画面
    if (shouldPickColor && !selectedColor) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
          <div className="text-center animate-slide-up">
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              🎨 使う色を選んでください
            </h2>
            <p className="text-text-muted text-sm mb-6">
              この色だけで描きます
              {room.allow_color_change && roundCount > 1 && (
                <span className="block mt-1 text-text-secondary">
                  ※ 次の周回で色を変更できます
                </span>
              )}
            </p>

            <div className="glass-card p-6 max-w-sm mx-auto">
              <div className="grid grid-cols-5 gap-3 mb-4">
                {ONE_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      setColorLocked(true);
                      setLastColorPickRound(currentRound);
                    }}
                    className="w-12 h-12 rounded-xl border-2 transition-all duration-200 hover:scale-110 hover:shadow-lg"
                    style={{
                      backgroundColor: color,
                      borderColor: color === "#ffffff" ? "#ccc" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="text-center animate-slide-up">
          {/* Countdown */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="rgba(55, 48, 167, 0.3)"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - intervalCount / INTERVAL_DURATION)}`}
                className="transition-all duration-1000 ease-linear"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-5xl font-extrabold text-primary-light">
              {intervalCount}
            </span>
          </div>

          {/* Next player info */}
          <div className="glass-card p-6 max-w-sm mx-auto">
                <p className="text-text-muted text-sm mb-2">
                  {roundCount > 1
                    ? `${currentRound}周目 - ターン ${(currentTurn % sortedPlayers.length) + 1}/${sortedPlayers.length}`
                    : `ターン ${currentTurn + 1}/${totalTurns}`}
                </p>
                <p className="text-2xl font-bold text-text-primary mb-1">
                  {isMyTurn ? (
                    <span className="text-accent-green">🖌️ あなたの番です！</span>
                  ) : (
                    <span>次は <span className="text-secondary">{currentPlayer?.username}</span> の番</span>
                  )}
                </p>
                <p className="text-text-muted text-sm">
                  制限時間: {turnDuration}秒
                </p>
                {isOneColorMode && selectedColor && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-xs text-text-muted">あなたの色:</span>
                    <div
                      className="w-5 h-5 rounded-full border border-white/30"
                      style={{ backgroundColor: selectedColor }}
                    />
                  </div>
                )}
          </div>
        </div>
      </div>
    );
  }

  // ===== ゲーム進行画面 =====
  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-[500px] mb-4 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-text-muted">お題</p>
            <p className="text-xl font-bold text-secondary">{room.theme}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">
              {roundCount > 1 ? `${currentRound}周目` : "ターン"}
            </p>
            <p className="text-xl font-bold text-text-primary">
              {currentTurn + 1}{" "}
              <span className="text-text-muted text-sm">/ {totalTurns}</span>
            </p>
          </div>
        </div>

        {/* Current Player Info */}
        <div
          className={`flex items-center gap-3 p-3 rounded-xl mb-3 ${
            isMyTurn
              ? "bg-accent-green/20 border border-accent-green/30"
              : "bg-surface-card/40 border border-primary-light/10"
          }`}
        >
          <Palette
            size={20}
            className={isMyTurn ? "text-accent-green" : "text-text-muted"}
          />
          <span className="font-semibold text-text-primary">
            {isMyTurn ? "🖌️ あなたの番です！" : `${currentPlayer?.username} が描いています...`}
          </span>
        </div>

        {/* Timer */}
        <Timer
          duration={turnDuration}
          isActive={timerActive}
          onTimeUp={handleTimeUp}
          label="残り時間"
        />
      </div>

      {/* Canvas */}
      <div className="w-full animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <Canvas
          roomId={room.id}
          playerId={currentPlayerId}
          isMyTurn={isMyTurn}
          existingStrokes={strokes}
          lockedColor={isOneColorMode && selectedColor ? selectedColor : undefined}
        />
      </div>

      {/* Turn Order */}
      <div
        className="w-full max-w-[500px] mt-4 animate-slide-up"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sortedPlayers.map((p, i) => {
            const playerTurnIndex = currentTurn % sortedPlayers.length;
            return (
              <div
                key={p.id}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i === playerTurnIndex
                    ? "bg-accent-green text-white scale-105"
                    : i < playerTurnIndex
                    ? "bg-surface-light/50 text-text-muted line-through"
                    : "bg-surface-light text-text-secondary"
                }`}
              >
                {i + 1}. {p.username}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
