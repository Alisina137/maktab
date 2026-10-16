/** Read-only prioritization of school readiness evidence; never a release decision. */
export type PriorityIssue = {
  key: string; label: string; href: string;
  level: "blocker" | "warning" | "unverified";
  affected?: number;
};
const core = [
  ["school-active","School active","/admin/pilot/subscription"],
  ["subscription","Subscription","/admin/pilot/subscription"],
  ["admin","Administrator account","/admin/accounts"],
  ["academic-year","Active academic year","/admin/academics/years"],
  ["classes","Classes ready","/admin/academics/classes"],
  ["subjects","Subjects ready","/admin/academics/subjects"],
  ["teachers","Teacher profiles","/admin/academics/teachers"],
  ["assignments","Teacher assignments ready","/admin/academics/assignments"],
  ["families","Families ready","/admin/families"]
] as const;
const coverage = [
  ["teaching","Classes with active teacher assignments","/admin/academics/assignments","critical"],
  ["timetable","Classes with matching timetable periods","/admin/academics/timetable","warning"],
  ["class_students","Classes with enrolled students","/admin/families","warning"],
  ["negaran","Classes with a current Negaran","/admin/academics/negaran","warning"],
  ["family_links","Students with accessible parents and matching classes","/admin/families","critical"],
  ["student_logins","Students with activated logins","/admin/accounts","warning"],
  ["teacher_logins","Teachers with completed first login","/admin/accounts","warning"]
] as const;
function record(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("Invalid report");
  return x as Record<string, unknown>;
}
function natural(x: unknown): number {
  if (!Number.isSafeInteger(x) || (x as number) < 0) throw new Error("Invalid count");
  return x as number;
}
export function readinessPriorities(coreRaw: unknown, coverageRaw: unknown): PriorityIssue[] {
  const items: PriorityIssue[] = [];
  try {
    const report = record(coreRaw);
    if (!Array.isArray(report.checks) || report.checks.length !== core.length ||
      typeof report.ready !== "boolean") throw new Error("Incomplete core checks");
    const seen = new Set<string>();
    const checks = report.checks.map(raw => {
      const row = record(raw);
      const def = core.find(k => k[0] === row.key);
      if (!def || seen.has(def[0]) || typeof row.passed !== "boolean") throw new Error("Invalid core check");
      seen.add(def[0]);
      return { def, passed: row.passed };
    });
    if (report.ready !== checks.every(c => c.passed)) throw new Error("Conflicting core readiness");
    for (const check of checks) {
      if (!check.passed) items.push({key:"core-" + check.def[0],label:check.def[1],
        href:check.def[2],level:"blocker"});
    }
  } catch {
    items.push({key:"core-unavailable",label:"Core setup checks unavailable",
      href:"/admin/pilot/readiness",level:"unverified"});
  }
  try {
    const report = record(coverageRaw);
    if (!Array.isArray(report.metrics) || report.metrics.length !== coverage.length ||
      typeof report.ready !== "boolean" || typeof report.coreReady !== "boolean")
      throw new Error("Incomplete coverage");
    const seen = new Set<string>();
    const metrics = report.metrics.map(raw => {
      const row = record(raw);
      const def = coverage.find(k => k[0] === row.key);
      if (!def || seen.has(def[0]) || row.severity !== def[3]) throw new Error("Invalid metric");
      seen.add(def[0]);
      const total = natural(row.total), missing = natural(row.missing), complete = natural(row.complete);
      if (complete + missing !== total) throw new Error("Inconsistent counts");
      const expected = total === 0 ? "not_applicable" : missing ? def[3] : "complete";
      if (row.status !== expected ||
        row.percentage !== (total ? Math.round(complete / total * 100) : null))
        throw new Error("Contradictory metric");
      return {def,total,missing};
    });
    const criticalReady = metrics.filter(m=>m.def[3]==="critical")
      .every(m=>m.total>0 && m.missing===0);
    if (report.ready !== (report.coreReady && criticalReady))
      throw new Error("Contradictory coverage ready");
    for (const m of metrics) {
      if (m.missing > 0 || (m.total===0 && m.def[3]==="critical"))
        items.push({key:"coverage-"+m.def[0],label:m.def[1],href:m.def[2],
          level:m.def[3]==="critical"?"blocker":"warning",
          affected:m.missing||undefined});
    }
  } catch {
    items.push({key:"coverage-unavailable",label:"Configuration coverage unavailable",
      href:"/admin/pilot/readiness",level:"unverified"});
  }
  const rank = {blocker:0,unverified:1,warning:2};
  return items.sort((a,b)=>rank[a.level]-rank[b.level]);
}
