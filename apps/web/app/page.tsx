import Link from "next/link";

const cards = [
  ["Academic years", "Model the school year with an explicit DRAFT → ACTIVE → CLOSED → ARCHIVED lifecycle."],
  ["Teacher assignments", "A teacher can teach several subjects and classes through explicit subject-class assignments."],
  ["Negaran", "Class supervision is a dated teacher assignment with retained history, never a separate account role."],
  ["Conflict-safe timetable", "Each period maps class, subject, and teacher while rejecting teacher/class overlaps."]
] as const;

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Phase 3 · Academic Structure</span>
        <h1>MaktabLink can now model the real structure of a school day.</h1>
        <p>
          School administrators can define academic years, grades, classes, subjects, teachers,
          teacher assignments, Negaran responsibilities, and timetable periods while preserving
          strict tenant boundaries.
        </p>
        <div className="hero-actions">
          <Link className="primary-link" href="/admin">Open school administration</Link>
        </div>
      </section>

      <section className="grid" aria-label="Phase 3 capabilities">
        {cards.map(([title, description]) => (
          <article className="card" key={title}>
            <div className="status" aria-hidden="true">✓</div>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer>
        Student/family onboarding is intentionally deferred to Phase 4. Attendance remains Phase 5.
      </footer>
    </main>
  );
}
