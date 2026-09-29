"use client";

import { useEffect, useState } from "react";

export const ADMIN_SUCCESS_DURATION_MS = 5_000;
export const ADMIN_ERROR_DURATION_MS = 8_000;

export function useTransientAdminFeedback() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), ADMIN_ERROR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), ADMIN_SUCCESS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return { error, notice, setError, setNotice };
}
