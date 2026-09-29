"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminText, type AdminLocale } from "./admin-i18n";

type SolarDay = {
  day: number;
  iso: string;
  weekday: number;
};

const monthCache = new Map<string, SolarDay[]>();

function localeTag(locale: AdminLocale) {
  return locale === "en" ? "en-US" : locale;
}

function solarParts(isoDate: string) {
  if (!isoDate) return null;
  const dateOnly = isoDate.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC"
  }).formatToParts(date);

  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return { year: value("year"), month: value("month"), day: value("day") };
}

function solarMonthDays(year: number, month: number): SolarDay[] {
  const key = `${year}-${month}`;
  const cached = monthCache.get(key);
  if (cached) return cached;

  const days: SolarDay[] = [];
  const start = new Date(Date.UTC(year + 621, 0, 1));
  let found = false;

  for (let offset = 0; offset < 500; offset += 1) {
    const current = new Date(start.getTime() + offset * 86_400_000);
    const iso = current.toISOString().slice(0, 10);
    const parts = solarParts(iso);
    if (!parts) continue;

    if (parts.year === year && parts.month === month) {
      found = true;
      days.push({ day: parts.day, iso, weekday: current.getUTCDay() });
      continue;
    }

    if (found) break;
  }

  monthCache.set(key, days);
  return days;
}

export function formatAdminHijriDate(locale: AdminLocale, value: string) {
  return formatSelected(locale, value, false);
}

export function formatAdminHijriDateTime(locale: AdminLocale, value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(`${localeTag(locale)}-u-ca-persian`, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatSelected(locale: AdminLocale, value: string, includeTime: boolean) {
  if (!value) return "";
  const iso = value.slice(0, 10);
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";

  const formatted = new Intl.DateTimeFormat(`${localeTag(locale)}-u-ca-persian`, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);

  if (!includeTime) return formatted;
  const time = value.includes("T") ? value.slice(11, 16) : "";
  return time ? `${formatted} · ${time}` : formatted;
}

function monthTitle(locale: AdminLocale, days: SolarDay[]) {
  const first = days[0];
  if (!first) return "";
  return new Intl.DateTimeFormat(`${localeTag(locale)}-u-ca-persian`, {
    year: "numeric",
    month: "long",
    timeZone: "UTC"
  }).format(new Date(`${first.iso}T00:00:00Z`));
}

function weekdayLabels(locale: AdminLocale) {
  if (locale === "en") return ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  if (locale === "ps-AF") return ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  return ["ش", "ی", "د", "س", "چ", "پ", "ج"];
}

export function AdminHijriDatePicker({
  locale,
  name,
  value,
  defaultValue = "",
  onChange,
  required = false,
  includeTime = false,
  disabled = false
}: {
  locale: AdminLocale;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  includeTime?: boolean;
  disabled?: boolean;
}) {
  const t = (english: string) => adminText(locale, english);
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const selectedValue = value ?? internalValue;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentSolar = useMemo(
    () => solarParts(selectedValue || new Date().toISOString().slice(0, 10)),
    [selectedValue]
  );
  const [viewYear, setViewYear] = useState(currentSolar?.year ?? 1405);
  const [viewMonth, setViewMonth] = useState(currentSolar?.month ?? 1);

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  useEffect(() => {
    const selected = solarParts(selectedValue);
    if (selected) {
      setViewYear(selected.year);
      setViewMonth(selected.month);
    }
  }, [selectedValue]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const days = useMemo(() => solarMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const selectedSolar = solarParts(selectedValue);
  const firstOffset = days[0] ? (days[0].weekday + 1) % 7 : 0;
  const timeValue = selectedValue.includes("T") ? selectedValue.slice(11, 16) : "";

  function commit(next: string) {
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
  }

  function selectDay(iso: string) {
    const next = includeTime ? `${iso}T${timeValue || "08:00"}` : iso;
    commit(next);
    if (!includeTime) setOpen(false);
  }

  function changeTime(nextTime: string) {
    if (!selectedValue) return;
    commit(`${selectedValue.slice(0, 10)}T${nextTime}`);
  }

  function moveMonth(delta: number) {
    let month = viewMonth + delta;
    let year = viewYear;
    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }
    setViewYear(year);
    setViewMonth(month);
  }

  function goToday() {
    const today = new Date().toISOString().slice(0, 10);
    const parts = solarParts(today);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
      selectDay(today);
    }
  }

  return (
    <div className="admin-hijri-picker" ref={containerRef}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        className={selectedValue ? "admin-hijri-trigger admin-hijri-trigger-selected" : "admin-hijri-trigger"}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">☾</span>
        <strong>{selectedValue ? formatSelected(locale, selectedValue, includeTime) : t("Select Hijri date")}</strong>
        <span className="admin-hijri-chevron" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="admin-hijri-popover" role="dialog" aria-label={t("Solar Hijri calendar")}>
          <div className="admin-hijri-calendar-header">
            <button type="button" onClick={() => moveMonth(-1)} aria-label={t("Previous month")}>‹</button>
            <strong>{monthTitle(locale, days)}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label={t("Next month")}>›</button>
          </div>

          <div className="admin-hijri-weekdays" aria-hidden="true">
            {weekdayLabels(locale).map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
          </div>

          <div className="admin-hijri-grid">
            {Array.from({ length: firstOffset }).map((_, index) => <span key={`empty-${index}`} />)}
            {days.map((item) => {
              const active =
                selectedSolar?.year === viewYear &&
                selectedSolar?.month === viewMonth &&
                selectedSolar?.day === item.day;
              return (
                <button
                  key={item.iso}
                  className={active ? "admin-hijri-day admin-hijri-day-active" : "admin-hijri-day"}
                  type="button"
                  onClick={() => selectDay(item.iso)}
                  aria-pressed={active}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {includeTime ? (
            <label className="admin-hijri-time">
              <span>{t("Time")}</span>
              <input
                type="time"
                value={timeValue || "08:00"}
                onChange={(event) => changeTime(event.target.value)}
                disabled={!selectedValue}
              />
            </label>
          ) : null}

          <div className="admin-hijri-actions">
            <button type="button" className="admin-secondary" onClick={goToday}>{t("Today")}</button>
            {selectedValue && !required ? (
              <button type="button" className="admin-secondary" onClick={() => { commit(""); setOpen(false); }}>
                {t("Clear")}
              </button>
            ) : null}
            {includeTime && selectedValue ? (
              <button type="button" className="admin-primary" onClick={() => setOpen(false)}>{t("Done")}</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
