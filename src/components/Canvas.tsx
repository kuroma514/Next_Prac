"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id?: string;
  path_data: Point[];
  color: string;
  player_id?: string;
}

interface CanvasProps {
  roomId: string;
  playerId: string;
  isMyTurn: boolean;
  existingStrokes?: Stroke[];
  onStrokeSaved?: () => void;
  lockedColor?: string; // 1人1色モード用
}

const COLOR_PALETTE = [
  "#1e1b4b", // Dark (almost black)
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#ffffff", // White
];

const LINE_WIDTHS = [3, 6, 10, 16];

export default function Canvas({
  roomId,
  playerId,
  isMyTurn,
  existingStrokes = [],
  onStrokeSaved,
  lockedColor,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef<Point[]>([]);

  const [selectedColor, setSelectedColor] = useState(lockedColor || "#1e1b4b");
  const [lineWidth, setLineWidth] = useState(6);
  const [isSaving, setIsSaving] = useState(false);

  // Canvas のサイズ設定
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(rect.width, 500);

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  // 既存のストロークを描画
  const drawExistingStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // 白背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 既存ストロークを再描画
    existingStrokes.forEach((stroke) => {
      if (stroke.path_data.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.path_data[0].x, stroke.path_data[0].y);
      for (let i = 1; i < stroke.path_data.length; i++) {
        ctx.lineTo(stroke.path_data[i].x, stroke.path_data[i].y);
      }
      ctx.stroke();
    });
  }, [existingStrokes]);

  // 初期化
  useEffect(() => {
    setupCanvas();
    drawExistingStrokes();

    const handleResize = () => {
      setupCanvas();
      drawExistingStrokes();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setupCanvas, drawExistingStrokes]);

  // ストローク変更時に再描画
  useEffect(() => {
    drawExistingStrokes();
  }, [existingStrokes, drawExistingStrokes]);

  // 座標取得
  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }

    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  // 描画開始
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isMyTurn) return;
    e.preventDefault();

    const point = getPoint(e);
    if (!point) return;

    isDrawingRef.current = true;
    currentPathRef.current = [point];

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(point.x, point.y);
    }
  };

  // 描画中
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || !isMyTurn) return;
    e.preventDefault();

    const point = getPoint(e);
    if (!point) return;

    currentPathRef.current.push(point);

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  };

  // 描画終了 → Supabase に保存
  const stopDrawing = async () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const path = currentPathRef.current;
    if (path.length < 2) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("strokes").insert({
        room_id: roomId,
        player_id: playerId,
        path_data: path,
        color: selectedColor,
      });

      if (error) {
        console.error("Stroke save error:", error);
      } else {
        onStrokeSaved?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
      currentPathRef.current = [];
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas */}
      <div className="relative w-full max-w-[500px]">
        <canvas
          ref={canvasRef}
          className={`w-full rounded-2xl border-2 transition-all duration-300 touch-none ${
            isMyTurn
              ? "border-accent-green shadow-[0_0_30px_rgba(16,185,129,0.3)] cursor-crosshair"
              : "border-surface-light opacity-80 cursor-not-allowed"
          }`}
          style={{ aspectRatio: "1/1", background: "#fff" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Drawing indicator overlay */}
        {!isMyTurn && (
          <div className="absolute inset-0 rounded-2xl bg-black/20 flex items-center justify-center">
            <span className="bg-surface/80 px-4 py-2 rounded-full text-text-secondary text-sm font-medium backdrop-blur-sm">
              他のプレイヤーのターンです
            </span>
          </div>
        )}

        {/* Saving indicator */}
        {isSaving && (
          <div className="absolute top-3 right-3 bg-surface/80 px-3 py-1 rounded-full text-xs text-accent-green backdrop-blur-sm animate-pulse">
            保存中...
          </div>
        )}
      </div>

      {/* Toolbar - only show when it's my turn */}
      {isMyTurn && (
        <div className="glass-card p-3 w-full max-w-[500px] animate-slide-up">
          {/* Color palette - hide in locked color mode */}
          {!lockedColor && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-text-muted font-medium mr-1">色</span>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                      selectedColor === color
                        ? "border-white scale-110 shadow-lg"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Locked color indicator */}
          {lockedColor && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-text-muted font-medium">あなたの色</span>
              <div
                className="w-8 h-8 rounded-full border-2 border-white shadow-lg"
                style={{ backgroundColor: lockedColor }}
              />
            </div>
          )}

          {/* Line width */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium mr-1">太さ</span>
            <div className="flex gap-2">
              {LINE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setLineWidth(w)}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                    lineWidth === w
                      ? "bg-primary border border-primary-light"
                      : "bg-surface-light hover:bg-surface-card"
                  }`}
                >
                  <div
                    className="rounded-full bg-white"
                    style={{ width: w, height: w }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
