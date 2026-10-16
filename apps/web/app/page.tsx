import Link from "next/link";

const capabilities = [
  ["Academic planning", "Set up school years, grades, classes, subjects, teacher assignments, Negaran responsibilities and timetables."],
  ["Student & family records", "Enroll students, link guardians, manage school-scoped accounts and distribute temporary credentials."],
  ["Attendance", "Allow assigned Negaran teachers to record attendance and keep parents informed about their children."],
  ["Teaching & homework", "Plan lessons, assign homework, review submissions and control publication to families."],
  ["Exams & results", "Manage class/subject exams, validate grades, publish results and audit authorized corrections."],
  ["Announcements", "Communicate with school, class and role audiences through scoped notifications."],
  ["Fees & receipts", "Issue invoices, record manual payments and reversals, and show family balances."],
  ["Pilot operations", "Review setup readiness, subscription status, import templates and school-scoped exports."]
] as const;

export default function Home() {
  return (
    <main className="shell" id="main-content">
      <section className="hero" aria-labelledby="home-heading">
        <span className="eyebrow">MaktabLink · School & family platform</span>
        <h1 id="home-heading">School operations and family updates in one place.</h1>
        <p>
          Manage academics, teachers, students, attendance and communication through
          school-scoped workflows. Parents and students can follow published school
          information through their own accounts.
        </p>
        <div className="hero-actions">
          <Link className="primary-link" href="/admin">Go to school administration</Link>
          <Link className="primary-link" href="/staff">School staff sign in</Link>
        </div>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading">What MaktabLink supports</h2>
        <div className="grid">
          {capabilities.map(([title, description]) => (
            <article className="card" key={title}>
              <div className="status" aria-hidden="true">✓</div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        Access to school data requires an account at a provisioned school.
        MaktabLink fee records are managed manually; this is not an online payment gateway.
      </footer>
    </main>
  );
}
