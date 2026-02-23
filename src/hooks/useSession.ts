"use client";

import { useState, useEffect, useCallback } from "react";

interface SessionData {
  sessionId: string;
  username: string;
}

export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // sessionStorage からセッション情報を復元
    const storedId = sessionStorage.getItem("sessionId");
    const storedName = sessionStorage.getItem("username");

    if (storedId && storedName) {
      setSession({ sessionId: storedId, username: storedName });
    }
    setIsLoaded(true);
  }, []);

  const login = useCallback((username: string) => {
    // 既存のセッションIDがあればそのまま使う、なければ新規生成
    let sessionId = sessionStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("sessionId", sessionId);
    }
    sessionStorage.setItem("username", username);
    const data: SessionData = { sessionId, username };
    setSession(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("sessionId");
    sessionStorage.removeItem("username");
    setSession(null);
  }, []);

  return { session, isLoaded, login, logout };
}
