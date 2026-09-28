import Link from "next/link";

const cards = [
  ["Tenant isolation", "Every account belongs to one school, and usernames are unique only inside that school."],
  ["School-issued credentials", "Administrators generate temporary credentials; there is no public school-account signup."],
  ["Role-safe authentication", "Selecting Parent, Teacher, or Student never grants permissions. The backend account role is authoritative."],
  ["Secure sessions", "Temporary passwords force replacement and account suspension revokes active sessions."]
] as const;

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Phase 2 · Authentication & School Accounts</span>
        <h1>School-controlled access is now the front door to MaktabLink.</h1>
        <p>
          The foundation now supports school selection, role-aware login, one-time temporary credentials,
          private password replacement, rotating sessions, and administrator-managed school accounts.
        </p>
        <div className="hero-actions">
          <Link className="primary-link" href="/admin">Open school administration</Link>
        </div>
      </section>

      <section className="grid" aria-label="Phase 2 capabilities">
        {cards.map(([title, description]) => (
          <article className="card" key={title}>
            <div className="status" aria-hidden="true">✓</div>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer>
        Academic years, classes, subjects, teacher assignments, Negaran assignments, and timetables remain intentionally outside Phase 2.
      </footer>
    </main>
  );
}
