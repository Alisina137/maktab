"use client";

import Link from "next/link";
import { adminText, type AdminLocale } from "./admin-i18n";
import { subscriptionCheckpoints, subscriptionNextActions,
  type SubscriptionHealth } from "./pilot-subscription-guidance-model";

export function PilotSubscriptionNextSteps({health, locale}: {
  health: SubscriptionHealth; locale: AdminLocale;
}) {
  const t=(label:string)=>adminText(locale,label);
  const steps=subscriptionNextActions(health);
  const checkpoints=subscriptionCheckpoints(health);
  return (
    <>
      <section className="admin-panel pilot-subscription-guidance"
        aria-labelledby="pilot-subscription-guidance-title">
        <div className="admin-section-header">
          <div>
            <span className="eyebrow">{t("Read-only account guidance")}</span>
            <h3 id="pilot-subscription-guidance-title">{t("Subscription and administration next steps")}</h3>
            <p>{t("Actions are recommendations and links only; school administrators cannot change platform billing states here.")}</p>
          </div>
        </div>
        <ul className="pilot-subscription-actions">
          {steps.map(step=>(
            <li key={step.key} className={"pilot-subscription-action pilot-subscription-action-"+step.severity}>
              <div>
                <strong>{t(step.title)}</strong>
                <p>{t(step.detail)}</p>
              </div>
              <Link href={step.href} className="pilot-inline-link">
                {t("Open section")} <span aria-hidden="true">↗</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="pilot-security-note">
          {t("Billing support links open an editable draft. No support ticket, payment, or renewal is submitted automatically.")}
        </p>
      </section>
      <section className="admin-panel pilot-subscription-thresholds"
        aria-labelledby="pilot-subscription-threshold-title">
        <div className="admin-section-header">
          <div>
            <span className="eyebrow">{t("Renewal schedule reference")}</span>
            <h3 id="pilot-subscription-threshold-title">{t("Expiry reminder checkpoints")}</h3>
            <p>{t("Calendar thresholds based on the recorded expiry date, not verified notification delivery.")}</p>
          </div>
        </div>
        <div className="pilot-subscription-threshold-grid">
          {checkpoints.map(item=>(
            <div className="pilot-subscription-threshold" key={item.days}>
              <strong>{item.days}</strong>
              <span>{t("Days before expiry")}</span>
              <small>{t(item.state==="unknown" ? "No expiry date recorded" :
                item.state==="future" ? "Not reached yet" :
                item.state==="reached" ? "Threshold is today" : "Threshold already passed")}</small>
            </div>
          ))}
        </div>
        <p className="pilot-security-note">
          {t("These thresholds do not confirm a scheduler run, message creation, delivery, or receipt.")}
        </p>
      </section>
    </>
  );
}
