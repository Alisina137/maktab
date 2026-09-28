import { translate } from "@maktablink/localization";

const cards = [
  ["foundation.tenant", "Tenant-scoped school data is established at the database boundary."],
  ["foundation.localization", "Dari and Pashto are RTL from the foundation; English remains LTR."],
  ["foundation.api", "Internal platform provisioning can create and configure school tenants."],
  ["foundation.design", "Web and mobile share one semantic design-token package."]
] as const;

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">{translate("en", "foundation.eyebrow")}</span>
        <h1>{translate("en", "foundation.title")}</h1>
        <p>{translate("en", "foundation.subtitle")}</p>
      </section>

      <section className="grid" aria-label="Phase 1 foundation capabilities">
        {cards.map(([key, description]) => (
          <article className="card" key={key}>
            <div className="status" aria-hidden="true">✓</div>
            <h2>{translate("en", key)}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer>
        Academic workflows begin in later phases. Phase 1 intentionally contains no student, attendance, homework, or grade features.
      </footer>
    </main>
  );
}
