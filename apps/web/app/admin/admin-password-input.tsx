"use client";

import { useState, type InputHTMLAttributes } from "react";

type AdminPasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showLabel: string;
  hideLabel: string;
};

export function AdminPasswordInput({
  showLabel,
  hideLabel,
  className,
  ...inputProps
}: AdminPasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? hideLabel : showLabel;

  return (
    <div className="admin-password-input-wrap">
      <input
        {...inputProps}
        className={className}
        type={visible ? "text" : "password"}
      />
      <button
        className="admin-password-toggle"
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 5.5 9 8a10.8 10.8 0 01-2.1 3.7M6.6 6.6C4.4 8 3 10.3 3 12c0 2.5 3.5 8 9 8a10.8 10.8 0 004.2-.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 12c0-2.5 3.5-8 9-8s9 5.5 9 8-3.5 8-9 8-9-5.5-9-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
