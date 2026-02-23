"use client";

import { Crown, User } from "lucide-react";

interface Player {
  id: string;
  username: string;
  is_host: boolean;
  turn_order: number;
}

interface LobbyProps {
  players: Player[];
  currentPlayerId: string;
}

// アバターの背景色パレット
const AVATAR_COLORS = [
  "from-purple-500 to-indigo-500",
  "from-pink-500 to-rose-500",
  "from-cyan-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-green-500 to-emerald-500",
  "from-blue-500 to-sky-500",
  "from-fuchsia-500 to-purple-500",
  "from-red-500 to-pink-500",
];

export default function Lobby({ players, currentPlayerId }: LobbyProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-text-primary">
          参加者 ({players.length}/8)
        </h3>
        <div className="flex gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i < players.length
                  ? "bg-accent-green scale-100"
                  : "bg-surface-light scale-75"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        {players
          .sort((a, b) => a.turn_order - b.turn_order)
          .map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                player.id === currentPlayerId
                  ? "bg-primary/20 border border-primary-light/30"
                  : "bg-surface/40 border border-transparent"
              }`}
              style={{
                animation: `slide-up 0.4s ease-out forwards`,
                animationDelay: `${index * 0.08}s`,
                opacity: 0,
              }}
            >
              {/* Avatar */}
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                  AVATAR_COLORS[index % AVATAR_COLORS.length]
                } flex items-center justify-center flex-shrink-0`}
              >
                {player.is_host ? (
                  <Crown size={20} className="text-white" />
                ) : (
                  <User size={20} className="text-white" />
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary truncate">
                  {player.username}
                  {player.id === currentPlayerId && (
                    <span className="ml-2 text-xs text-primary-light font-normal">
                      (あなた)
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-muted">
                  {player.is_host ? "ホスト" : `プレイヤー #${player.turn_order + 1}`}
                </p>
              </div>

              {/* Turn order badge */}
              <div className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center">
                <span className="text-sm font-bold text-text-muted">
                  {player.turn_order + 1}
                </span>
              </div>
            </div>
          ))}
      </div>

      {players.length < 2 && (
        <p className="text-center text-text-muted text-sm mt-4 animate-pulse">
          もう1人以上の参加者を待っています...
        </p>
      )}
    </div>
  );
}
