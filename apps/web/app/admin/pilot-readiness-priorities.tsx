"use client";
import { useState } from "react";
import Link from "next/link";
import { adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { readinessPriorities, type PriorityIssue } from "./pilot-readiness-priority-model";

export function PilotReadinessPriorities({ core, coverage, locale, busy }: {
  core: unknown; coverage: unknown; locale: AdminLocale; busy: boolean;
}) {
  const t = (name: string) => adminText(locale, name);
  const [filter, setFilter] = useState<"all" | PriorityIssue["level"]>("all");
  const [expanded, setExpanded] = useState(false);
  if (busy) {
    return <div role="status" className="admin-panel pilot-priority-worklist">
      {t("Checking priority readiness issues…")}
    </div>;
  }
  const issues = readinessPriorities(core, coverage);
  const selected = filter === "all" ? issues : issues.filter(item => item.level === filter);
  const shown = expanded ? selected : selected.slice(0, 6);
  const number = (value: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : locale).format(value);
  const count = (level: PriorityIssue["level"]) => number(issues.filter(i => i.level === level).length);
  return (
    <section className="admin-panel pilot-priority-worklist" aria-labelledby="pilot-priority-title">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">{t("School readiness worklist")}</span>
          <h3 id="pilot-priority-title">{t("Prioritize incomplete setup")}</h3>
          <p>{t("Review blocking setup gaps before advisory coverage warnings.")}</p>
        </div>
        <label className="pilot-priority-filter">
          <span>{t("Show issues")}</span>
          <select value={filter} onChange={(event) => {
            setFilter(event.target.value as typeof filter); setExpanded(false);
          }}>
            <option value="all">{t("All issues")}</option>
            <option value="blocker">{t("Critical")}</option>
            <option value="unverified">{t("Not verified")}</option>
            <option value="warning">{t("Warning")}</option>
          </select>
        </label>
      </div>
      <div className="pilot-priority-counts" role="status">
        <span className="pilot-badge pilot-badge-danger">
          {adminFormat(locale, "{count} blocking issues", {count: count("blocker")})}
        </span>
        <span className="pilot-badge pilot-badge-warning">
          {adminFormat(locale, "{count} warnings", {count: count("warning")})}
        </span>
        <span className="pilot-priority-unknown">
          {adminFormat(locale, "{count} reports unverified", {count: count("unverified")})}
        </span>
      </div>
      {issues.length === 0 ?
        <p className="pilot-security-note">
          {t("No recorded setup gaps. Timetable integrity and release checks remain separate.")}
        </p> : null}
      <ul className="pilot-priority-list">
        {shown.map(issue => (
          <li key={issue.key} className={"pilot-priority-row pilot-priority-" + issue.level}>
            <div>
              <strong>{t(issue.label)}</strong>
              <p>{issue.level === "unverified"
                ? t("Report unavailable or invalid. Retry and verify the data.")
                : issue.affected === undefined
                ? t(issue.key.startsWith("coverage-")
                  ? "No eligible records; coverage is not verified."
                  : "Required setup or coverage check needs attention.")
                : adminFormat(locale, "{count} affected records need correction.", {
                  count: number(issue.affected)
                })}</p>
            </div>
            <Link className="pilot-inline-link" href={issue.href}>
              {t("Open section")} <span aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ul>
      {issues.length > 0 && selected.length === 0 ?
        <p>{t("No items match this filter.")}</p> : null}
      {selected.length > 6 ?
        <button className="admin-secondary" type="button" aria-expanded={expanded}
          onClick={() => setExpanded(current => !current)}>
          {expanded ? t("Show fewer") :
            adminFormat(locale, "Show all {count} items", {count: number(selected.length)})}
        </button> : null}
      <p className="pilot-security-note">
        {t("Configuration advice only. This does not approve pilot or production launch.")}
      </p>
    </section>
  );
}
