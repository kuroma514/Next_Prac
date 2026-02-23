"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paintbrush, Users, Sparkles, ArrowRight, Plus, LogIn } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase";


function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function HomePage() {
  const router = useRouter();
  const { session, isLoaded, login } = useSession();
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleSetName = () => {
    if (!username.trim()) {
      setError("ニックネームを入力してください");
      return;
    }
    if (username.trim().length > 12) {
      setError("ニックネームは12文字以内で入力してください");
      return;
    }
    login(username.trim());
    setError("");
  };

  const handleCreateRoom = async () => {
    if (!session) return;
    setIsCreating(true);
    setError("");

    try {
      const code = generateRoomCode();

      // 部屋を作成
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({ room_code: code })
        .select()
        .single();

      if (roomError) throw roomError;

      // ホストとして参加 (再プレイ時は更新＝upsert)
      const { error: playerError } = await supabase.from("players").upsert({
        id: session.sessionId,
        room_id: room.id,
        username: session.username,
        turn_order: 0,
        is_host: true,
      });

      if (playerError) throw playerError;

      router.push(`/room/${room.id}`);
    } catch (err) {
      console.error(err);
      setError("部屋の作成に失敗しました。もう一度お試しください。");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!session) return;
    if (!roomCode.trim()) {
      setError("ルームコードを入力してください");
      return;
    }
    setIsJoining(true);
    setError("");

    try {
      // ルームコードで部屋を検索
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", roomCode.trim())
        .single();

      if (roomError || !room) {
        setError("この部屋が見つかりません。コードを確認してください。");
        return;
      }

      if (room.status !== "waiting") {
        setError("この部屋はすでにゲームが始まっています。");
        return;
      }

      // 自分がすでにこの部屋に参加しているか確認
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("room_id")
        .eq("id", session.sessionId)
        .single();

      if (existingPlayer?.room_id === room.id) {
        router.push(`/room/${room.id}`);
        return;
      }

      // 既存の参加者数を確認
      const { count } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);

      if (count !== null && count >= 8) {
        setError("この部屋は満員です（最大8人）。");
        return;
      }

      // 参加者として登録 (再プレイ時は別部屋から移動＝upsert)
      const { error: playerError } = await supabase.from("players").upsert({
        id: session.sessionId,
        room_id: room.id,
        username: session.username,
        turn_order: count ?? 0,
        is_host: false,
      });

      if (playerError) throw playerError;

      router.push(`/room/${room.id}`);
    } catch (err) {
      console.error(err);
      setError("入室に失敗しました。もう一度お試しください。");
    } finally {
      setIsJoining(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-2xl text-text-muted">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Paintbrush
            size={48}
            className="text-secondary animate-wiggle"
          />
          <h1 className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-primary-light via-accent-pink to-secondary bg-clip-text text-transparent animate-gradient">
            Draw-Relay
          </h1>
          <Sparkles
            size={36}
            className="text-accent-cyan animate-float"
          />
        </div>
        <p className="text-lg md:text-xl text-text-secondary max-w-md mx-auto">
          みんなで一つの絵を完成させよう！
          <br />
          <span className="text-text-muted text-base">
            2〜8人 × 10秒リレー × リアルタイム
          </span>
        </p>
      </div>

      {/* Main Card */}
      <div
        className="glass-card p-8 w-full max-w-md animate-slide-up"
        style={{ animationDelay: "0.2s" }}
      >
        {!session ? (
          /* ===== Name Input ===== */
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Users size={22} className="text-primary-light" />
              <h2 className="text-xl font-bold text-text-primary">
                ニックネームを入力
              </h2>
            </div>

            <input
              type="text"
              className="input-field"
              placeholder="あなたの名前..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              maxLength={12}
              autoFocus
            />

            {error && (
              <p className="text-accent-pink text-sm font-medium">{error}</p>
            )}

            <button
              className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={handleSetName}
            >
              はじめる
              <ArrowRight size={20} />
            </button>
          </div>
        ) : (
          /* ===== Room Actions ===== */
          <div className="space-y-6">
            <div className="text-center pb-4 border-b border-primary-light/20">
              <p className="text-text-secondary text-sm">ようこそ</p>
              <p className="text-2xl font-bold text-secondary">
                {session.username}
              </p>
            </div>

            {error && (
              <p className="text-accent-pink text-sm font-medium text-center">
                {error}
              </p>
            )}

            {/* Create Room */}
            <button
              className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={handleCreateRoom}
              disabled={isCreating}
            >
              {isCreating ? (
                <span className="animate-pulse">作成中...</span>
              ) : (
                <>
                  <Plus size={22} />
                  部屋をつくる
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-primary-light/20" />
              <span className="text-text-muted text-sm font-medium">
                または
              </span>
              <div className="flex-1 h-px bg-primary-light/20" />
            </div>

            {/* Join Room */}
            <div className="space-y-3">
              <input
                type="text"
                className="input-field text-center text-2xl tracking-[0.5em] font-bold"
                placeholder="1234"
                value={roomCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setRoomCode(v);
                }}
                maxLength={4}
              />
              <button
                className="btn-secondary w-full flex items-center justify-center gap-2"
                onClick={handleJoinRoom}
                disabled={isJoining || roomCode.length !== 4}
              >
                {isJoining ? (
                  <span className="animate-pulse">入室中...</span>
                ) : (
                  <>
                    <LogIn size={22} />
                    コードで入室
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
