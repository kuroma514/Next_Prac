"use client";

import { useState, useEffect, useRef } from "react";

interface TimerProps {
  duration: number; // 秒
  isActive: boolean;
  onTimeUp: () => void;
  label?: string;
}

export default function Timer({
  duration,
  isActive,
  onTimeUp,
  label,
}: TimerProps) {
  const [resetKey, setResetKey] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // isActive 変更時にリセットキーを更新
  useEffect(() => {
    if (isActive) {
      setResetKey((k) => k + 1);
    }
  }, [isActive]);

  // リセットキー変更時にタイマーをリセット
  useEffect(() => {
    setTimeLeft(duration);
  }, [resetKey, duration]);

  // カウントダウン
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUpRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const progress = (timeLeft / duration) * 100;

  // 色の決定
  const getColor = () => {
    if (timeLeft <= 3) return { bar: "bg-red-500", text: "text-red-400", glow: "shadow-red-500/50" };
    if (timeLeft <= 5) return { bar: "bg-amber-500", text: "text-amber-400", glow: "shadow-amber-500/50" };
    return { bar: "bg-accent-green", text: "text-accent-green", glow: "shadow-green-500/30" };
  };

  const colors = getColor();

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-muted font-medium">{label}</span>
          <span
            className={`text-3xl font-extrabold tabular-nums ${colors.text} transition-colors duration-300 ${
              timeLeft <= 3 ? "animate-pulse" : ""
            }`}
          >
            {timeLeft}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full h-3 rounded-full bg-surface-light overflow-hidden">
        <div
          className={`h-full rounded-full ${colors.bar} transition-all duration-1000 ease-linear shadow-lg ${colors.glow}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
