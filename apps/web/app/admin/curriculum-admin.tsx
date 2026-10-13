"use client";
import { useEffect, useState, type FormEvent } from "react";
import { adminApi, friendlyAdminError } from "./admin-client";
import { adminText, type AdminLocale } from "./admin-i18n";

type ClassRow = { id: string; name: string; code: string };
type SubjectRow = { id: string; name: string; code: string };
type Unit = { id: string; title: string; sortOrder: number };

export function CurriculumAdminPanel({
  accessToken, yearId, active, classes, subjects, locale,
  onNotice
}: {
  accessToken: string; yearId: string; active: boolean;
  classes: ClassRow[]; subjects: SubjectRow[]; locale: AdminLocale;
  onNotice: (success: boolean, message: string) => void;
}) {
  const t = (label: string) => adminText(locale, label);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [order, setOrder] = useState("1");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState("");
  const [revision, setRevision] = useState(0);
  const [pane, setPane] = useState<"FORM" | "LIST">("FORM");

  useEffect(() => {
    setClassId(""); setSubjectId(""); setUnits([]); setEditingId(null); setTitle("");
    setPane("FORM");
  }, [yearId]);

  useEffect(() => {
    let activeRequest = true;
    setUnits([]); setFailure("");
    if (!yearId || !classId || !subjectId) return;
    setLoading(true);
    const params = new URLSearchParams({ academicYearId: yearId, classId, subjectId });
    void adminApi<{ units: Unit[] }>(`/v1/admin/teaching/curriculum?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(result => {
      if (!activeRequest) return;
      setUnits(result.units);
      const next = Math.max(0, ...result.units.map(x => x.sortOrder)) + 1;
      if (!editingId) setOrder(String(next));
    }).catch((error: unknown) => {
      if (activeRequest) setFailure(friendlyAdminError(error, "Unable to load curriculum.", locale));
    }).finally(() => { if (activeRequest) setLoading(false); });
    return () => { activeRequest = false; };
  }, [yearId, classId, subjectId, accessToken, revision, locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sortOrder = Number(order);
    if (!yearId || !classId || !subjectId || !title.trim() ||
      title.trim().length > 160 || !Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 500) {
      onNotice(false, t("Select class, subject, title and a valid chapter position."));
      return;
    }
    setBusy(true);
    try {
      await adminApi(editingId
        ? `/v1/admin/teaching/curriculum/${encodeURIComponent(editingId)}`
        : "/v1/admin/teaching/curriculum", {
        method: editingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          ...(editingId ? {} : { academicYearId: yearId, classId, subjectId }),
          title: title.trim(), sortOrder
        })
      });
      setTitle(""); setEditingId(null); setPane("LIST");
      setRevision(i => i + 1);
      onNotice(true, t(editingId ? "Curriculum unit updated." : "Curriculum unit added for this class and subject."));
    } catch (error) {
      onNotice(false, friendlyAdminError(error, "Could not create curriculum unit.", locale));
    } finally { setBusy(false); }
  }

  function beginEdit(unit: Unit) {
    setEditingId(unit.id); setTitle(unit.title); setOrder(String(unit.sortOrder)); setPane("FORM");
  }

  async function remove(unit: Unit) {
    if (!active || !window.confirm(t("Delete this unused chapter permanently?"))) return;
    setBusy(true);
    try {
      await adminApi(`/v1/admin/teaching/curriculum/${encodeURIComponent(unit.id)}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (editingId === unit.id) { setEditingId(null); setTitle(""); }
      setRevision((current) => current + 1);
      onNotice(true, t("Unused curriculum unit deleted."));
    } catch (cause) {
      onNotice(false, friendlyAdminError(cause,
        "Only unused curriculum units can be deleted. Existing lesson plans and progress are protected.", locale));
    } finally { setBusy(false); }
  }

  return (
    <section className="academic-section admin-page-enter">
      <div className="admin-section-header academic-heading">
        <div>
          <h2>{t("Curriculum units")}</h2>
          <p>{t("School administration defines official chapters. Assigned teachers track progress without changing this structure.")}</p>
        </div>
      </div>
      {!active ? <div className="admin-panel admin-copy" role="status">
        {t("Curriculum creation is available only for the active academic year.")}
      </div> : null}
      <div className="admin-panel academic-form-card">
        <h2>{t("Choose a class and subject")}</h2>
        <div className="admin-form">
          <label>{t("Class")}
            <select value={classId} onChange={(e) => {setClassId(e.target.value);setEditingId(null);setTitle("");}}>
              <option value="">{t("Select class")}</option>
              {classes.map(item=><option value={item.id} key={item.id}>{item.name} · {item.code}</option>)}
            </select>
          </label>
          <label>{t("Subject")}
            <select value={subjectId} onChange={(e) => {setSubjectId(e.target.value);setEditingId(null);setTitle("");}}>
              <option value="">{t("Select subject")}</option>
              {subjects.map(item=><option value={item.id} key={item.id}>{item.name} · {item.code}</option>)}
            </select>
          </label>
        </div>
      </div>
      {failure ? <div role="alert" className="admin-error">
        {failure}
        <button type="button" className="admin-secondary" onClick={() => setRevision(i=>i+1)}>{t("Retry")}</button>
      </div> : null}
      <div className="academic-pane-switch" role="tablist">
        <button role="tab" type="button" aria-selected={pane==="FORM"}
          className={pane==="FORM" ? "academic-pane-switch-button academic-pane-switch-button-active" : "academic-pane-switch-button"}
          onClick={()=>setPane("FORM")}>{t("Create curriculum unit")}</button>
        <button role="tab" type="button" aria-selected={pane==="LIST"}
          className={pane==="LIST" ? "academic-pane-switch-button academic-pane-switch-button-active" : "academic-pane-switch-button"}
          onClick={()=>setPane("LIST")}>{t("List of curriculum units")}</button>
      </div>
      <div className={"academic-single-module academic-single-module-" + pane.toLowerCase()}>
        <div className="academic-responsive-pane academic-responsive-pane-form">
          <article className="admin-panel academic-form-card academic-single-form">
            <h2>{t(editingId ? "Edit official chapter" : "Add official chapter")}</h2>
            <form className="admin-form" onSubmit={event=>void submit(event)}>
              <label>{t("Chapter name")}
                <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} required />
              </label>
              <label>{t("Position")}
                <input value={order} onChange={e=>setOrder(e.target.value)}
                  type="number" min={1} max={500} required />
              </label>
              <button className="admin-primary" type="submit"
                disabled={busy || !active || !classId || !subjectId}>
                {busy ? t("Saving…") : t(editingId ? "Save chapter" : "Create curriculum unit")}
              </button>
              {editingId ? <button type="button" className="admin-secondary"
                onClick={()=>{setEditingId(null);setTitle("");setOrder(String(Math.max(0,...units.map(x=>x.sortOrder))+1));}}>
                {t("Cancel editing")}
              </button> : null}
            </form>
          </article>
        </div>
        <div className="academic-responsive-pane academic-responsive-pane-list">
          <article className="admin-panel academic-form-card">
            <h2>{t("Curriculum units")}</h2>
            {loading ? <p>{t("Loading…")}</p> : null}
            {units.map(unit=>(
              <div className="academic-module-card" key={unit.id}>
                <strong>{unit.sortOrder}. {unit.title}</strong>
                {active ? <div className="academic-pane-switch">
                  <button type="button" className="admin-secondary" disabled={busy}
                    onClick={()=>beginEdit(unit)}>{t("Edit")}</button>
                  <button type="button" className="admin-secondary" disabled={busy}
                    onClick={()=>void remove(unit)}>{t("Delete")}</button>
                </div> : null}
              </div>
            ))}
            {!loading && !units.length ? <p>{t("No chapters defined for this class and subject.")}</p> : null}
          </article>
        </div>
      </div>
    </section>
  );
}
