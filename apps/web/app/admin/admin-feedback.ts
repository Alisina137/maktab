"use client";

import { useEffect, useState } from "react";

export const ADMIN_SUCCESS_DURATION_MS = 5_000;
export const ADMIN_ERROR_DURATION_MS = 8_000;

export function useTransientAdminFeedback(options?: { persistent?: boolean }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const persistent = options?.persistent ?? false;

  useEffect(() => {
    if (!error || persistent) return;
    const timer = setTimeout(() => setError(""), ADMIN_ERROR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [error, persistent]);

  useEffect(() => {
    if (!notice || persistent) return;
    const timer = setTimeout(() => setNotice(""), ADMIN_SUCCESS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice, persistent]);

  return { error, notice, setError, setNotice };
}
