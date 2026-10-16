"use client";

import { useState } from "react";
import Link from "next/link";
import { adminText, type AdminLocale } from "./admin-i18n";

type Entity = "PARENT" | "STUDENT" | "TEACHER";
const entities: Record<Entity, {
  title: string;
  required: readonly string[];
  optional: readonly string[];
  prerequisite: string;
}> = {
  PARENT: {
    title: "Parent accounts",
    required: ["username", "fullName"], optional: ["phone"],
    prerequisite: "Create parents before students so student records can link to an existing parent username."
  },
  STUDENT: {
    title: "Student accounts",
    required: ["username", "studentCode", "fullName", "parentUsername", "academicYear", "classCode"],
    optional: ["phone"],
    prerequisite: "Create an active academic year, classes and parent accounts before importing students."
  },
  TEACHER: {
    title: "Teacher accounts",
    required: ["username", "employeeCode", "fullName"], optional: ["phone"],
    prerequisite: "After importing teachers, assign them to their active-year classes and subjects."
  }
};
const steps = [
  ["1", "Download the matching CSV template"],
  ["2", "Upload the file and review column mapping in Families"],
  ["3", "Validate every row and correct reported errors"],
  ["4", "Confirm once and save temporary credentials securely"]
] as const;

/** Preparation only: never pretends that a batch has been validated or committed. */
export function PilotOnboardingImportPlan({ locale }: { locale: AdminLocale }) {
  const [entity, setEntity] = useState<Entity>("PARENT");
  const t = (value: string) => adminText(locale, value);
  const data = entities[entity];
  return (
    <section className="admin-panel pilot-import-plan" aria-labelledby="pilot-import-plan-title">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">{t("Prepare a safe import")}</span>
          <h3 id="pilot-import-plan-title">{t("Choose an import type")}</h3>
          <p>{t("Check required columns and prerequisites before validating real school records.")}</p>
        </div>
        <Link href="/admin/families" className="pilot-inline-link">
          {t("Open Families import")} <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="pilot-import-plan-types" aria-label={t("Choose an import type")}>
        {(Object.keys(entities) as Entity[]).map((value) => (
          <button key={value} className={entity === value ?
            "pilot-import-plan-choice pilot-import-plan-choice-active" : "pilot-import-plan-choice"}
            aria-pressed={entity === value} type="button" onClick={() => setEntity(value)}>
            {t(entities[value].title)}
          </button>
        ))}
      </div>
      <div className="pilot-import-plan-details">
        <div>
          <strong>{t("Required CSV columns")}</strong>
          <code dir="ltr">{data.required.join(", ")}</code>
          <p>{t("Optional CSV columns")}: <code dir="ltr">{data.optional.join(", ")}</code></p>
          <p className="pilot-security-note">{t(data.prerequisite)}</p>
        </div>
        <ol>
          {steps.map(([number, label]) => (
            <li key={number}>
              <span className="pilot-step-number" aria-hidden="true">{number}</span>
              <span>{t(label)}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="admin-actions">
        <a href="#pilot-import-templates" className="admin-secondary">{t("See official templates")}</a>
        <Link href="/admin/families" className="admin-primary">{t("Continue to validation")}</Link>
      </div>
      <p className="pilot-security-note">
        {t("Previewing or downloading a template never imports accounts. Actual validation and confirmation happen in Families.")}
      </p>
    </section>
  );
}
