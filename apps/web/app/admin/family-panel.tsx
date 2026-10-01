"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AdminLoader, AdminSkeleton } from "./admin-loader";
import { formatAdminHijriDateTime } from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminFormat, adminText } from "./admin-i18n";

type User = {
  id: string;
  username: string;
  role: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

type ParentSummary = {
  profile: { userId: string; fullName: string; phone: string | null };
  user: User;
  childCount: number;
};

type StudentRow = {
  student: {
    id: string;
    parentUserId: string;
    userId: string | null;
    studentCode: string;
    fullName: string;
    phone: string | null;
    academicYearId: string;
    classId: string;
    status: "ACTIVE" | "WITHDRAWN";
  };
  user: User | null;
  classSection: { id: string; code: string; name: string; academicYearId: string };
  academicYear: { id: string; name: string; status: string };
};

type EnrollmentRow = {
  history: {
    id: string;
    academicYearId: string;
    classId: string;
    startedAt: string;
    endedAt: string | null;
  };
  student: StudentRow["student"];
  user: User | null;
  classSection: StudentRow["classSection"];
  academicYear: StudentRow["academicYear"];
};

type FamilyOverview = {
  parents: ParentSummary[];
  students: StudentRow[];
  enrollments: EnrollmentRow[];
};
type AcademicOverview = {
  academicYears: Array<{ id: string; name: string; status: string }>;
  classes: Array<{ id: string; code: string; name: string; academicYearId: string }>;
};

type ImportEntity = "PARENT" | "STUDENT" | "TEACHER";
type Preview = { headers: string[]; rows: Array<Record<string, string>> };
type Validation = {
  entityType: ImportEntity;
  valid: boolean;
  rowCount: number;
  validRowCount: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  normalizedRows: Array<Record<string, string>>;
};
type Credential = { username: string; temporaryPassword: string };
type AccountCredentialPreview = {
  accountType: "PARENT" | "STUDENT";
  username: string;
  fullName: string;
  phone: string | null;
  temporaryPassword: string;
};

type AccountPdfLabels = {
  title: string;
  subtitle: string;
  username: string;
  fullName: string;
  phone: string;
  temporaryPassword: string;
  notProvided: string;
  important: string;
  note: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const importFields: Record<ImportEntity, Array<{ key: string; label: string; required: boolean; aliases: string[] }>> = {
  PARENT: [
    { key: "username", label: "Username", required: true, aliases: ["username", "user", "parentusername"] },
    { key: "fullName", label: "Parent full name", required: true, aliases: ["fullname", "parentname", "name"] },
    { key: "phone", label: "Phone", required: false, aliases: ["phone", "mobile", "phonenumber"] }
  ],
  STUDENT: [
    { key: "studentCode", label: "Student code", required: true, aliases: ["studentcode", "code", "studentid"] },
    { key: "fullName", label: "Student full name", required: true, aliases: ["fullname", "studentname", "name"] },
    { key: "parentUsername", label: "Parent username", required: true, aliases: ["parentusername", "parent", "guardianusername"] },
    { key: "academicYear", label: "Academic year", required: true, aliases: ["academicyear", "year", "yearname"] },
    { key: "classCode", label: "Class code", required: true, aliases: ["classcode", "class", "section"] }
  ],
  TEACHER: [
    { key: "username", label: "Username", required: true, aliases: ["username", "user", "teacherusername"] },
    { key: "employeeCode", label: "Employee code", required: true, aliases: ["employeecode", "staffcode", "teachercode"] },
    { key: "fullName", label: "Teacher full name", required: true, aliases: ["fullname", "teachername", "name"] },
    { key: "phone", label: "Phone", required: false, aliases: ["phone", "mobile", "phonenumber"] }
  ]
};


function hasRtlText(value: string) {
  return /[\u0590-\u08FF]/.test(value);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function jpegPdfBytes(jpeg: Uint8Array, width: number, height: number) {
  const encode = (value: string) => new TextEncoder().encode(value);
  const content = "q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n";
  const objects: Uint8Array[] = [
    encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    encode("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    encode("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n"),
    encode(`4 0 obj\n<< /Length ${encode(content).length} >>\nstream\n${content}endstream\nendobj\n`),
    concatBytes([
      encode(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      encode("\nendstream\nendobj\n")
    ])
  ];

  const header = encode("%PDF-1.4\n%MaktabLink\n");
  const offsets: number[] = [0];
  let cursor = header.length;
  for (const object of objects) {
    offsets.push(cursor);
    cursor += object.length;
  }

  const xrefOffset = cursor;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let index = 1; index <= 5; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return concatBytes([header, ...objects, encode(xref)]);
}

async function buildAccountPdf(
  preview: AccountCredentialPreview,
  labels: AccountPdfLabels
) {
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  const maybeContext = canvas.getContext("2d");
  if (!maybeContext) throw new Error("PDF canvas is unavailable.");
  const context: CanvasRenderingContext2D = maybeContext;

  const pageWidth = canvas.width;
  const margin = 96;
  const contentWidth = pageWidth - margin * 2;

  function roundedRect(x: number, y: number, width: number, height: number, radius: number) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function drawText(
    value: string,
    x: number,
    y: number,
    options: { size: number; weight?: number; maxWidth?: number; muted?: boolean; monospace?: boolean }
  ) {
    const rtl = hasRtlText(value);
    context.save();
    context.direction = rtl ? "rtl" : "ltr";
    context.textAlign = rtl ? "right" : "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = options.muted ? "#64748b" : "#172033";
    context.font = `${options.weight ?? 700} ${options.size}px ${options.monospace ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : "Arial, sans-serif"}`;
    context.fillText(value, rtl ? pageWidth - x : x, y, options.maxWidth);
    context.restore();
  }

  function drawField(label: string, value: string, x: number, y: number, width: number, height: number, monospace = false) {
    context.save();
    roundedRect(x, y, width, height, 22);
    context.fillStyle = "#f8faff";
    context.fill();
    context.strokeStyle = "#d9e2f2";
    context.lineWidth = 2;
    context.stroke();
    context.restore();

    const labelRtl = hasRtlText(label);
    const valueRtl = hasRtlText(value);
    context.save();
    context.direction = labelRtl ? "rtl" : "ltr";
    context.textAlign = labelRtl ? "right" : "left";
    context.fillStyle = "#64748b";
    context.font = "700 24px Arial, sans-serif";
    context.fillText(label, labelRtl ? x + width - 34 : x + 34, y + 48, width - 68);
    context.restore();

    context.save();
    context.direction = valueRtl ? "rtl" : "ltr";
    context.textAlign = valueRtl ? "right" : "left";
    context.fillStyle = "#172033";
    context.font = `800 36px ${monospace ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : "Arial, sans-serif"}`;
    context.fillText(value, valueRtl ? x + width - 34 : x + 34, y + 112, width - 68);
    context.restore();
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  roundedRect(margin, 86, contentWidth, 230, 32);
  context.fillStyle = "#eef4ff";
  context.fill();
  context.strokeStyle = "#cbdaf6";
  context.lineWidth = 2;
  context.stroke();

  drawText("MaktabLink", margin + 42, 150, { size: 30, weight: 900 });
  drawText(labels.title, margin + 42, 215, { size: 46, weight: 900, maxWidth: contentWidth - 84 });
  drawText(labels.subtitle, margin + 42, 270, { size: 25, weight: 600, maxWidth: contentWidth - 84, muted: true });

  const gap = 24;
  const columnWidth = (contentWidth - gap) / 2;
  drawField(labels.username, preview.username, margin, 365, columnWidth, 150, true);
  drawField(labels.fullName, preview.fullName, margin + columnWidth + gap, 365, columnWidth, 150);
  drawField(labels.phone, preview.phone || labels.notProvided, margin, 545, contentWidth, 150, true);
  drawField(labels.temporaryPassword, preview.temporaryPassword, margin, 725, contentWidth, 170, true);

  roundedRect(margin, 945, contentWidth, 170, 22);
  context.fillStyle = "#fff8e9";
  context.fill();
  context.strokeStyle = "#f3d69c";
  context.lineWidth = 2;
  context.stroke();
  drawText(labels.important, margin + 34, 1000, { size: 25, weight: 900 });
  drawText(labels.note, margin + 34, 1060, { size: 24, weight: 600, maxWidth: contentWidth - 68, muted: true });

  context.fillStyle = "#e8eef8";
  context.fillRect(margin, 1205, contentWidth, 2);
  drawText("MaktabLink · Account Credential", margin, 1260, { size: 21, weight: 600, muted: true });

  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = window.atob(base64);
  const jpeg = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) jpeg[index] = binary.charCodeAt(index);

  return jpegPdfBytes(jpeg, canvas.width, canvas.height);
}

function downloadAccountPdf(preview: AccountCredentialPreview, labels: AccountPdfLabels) {
  return buildAccountPdf(preview, labels).then((bytes) => {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const type = preview.accountType === "PARENT" ? "parent" : "student";
    const safeUsername = preview.username.replace(/[^A-Za-z0-9]+/g, "-") || "account";
    link.href = url;
    link.download = `${type}-account-${safeUsername}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nextAvailableStudentCodeFromValues(codes: string[]) {
  const used = new Set<number>();
  for (const code of codes) {
    const match = /^S-(\d+)$/i.exec(code.trim());
    if (!match?.[1]) continue;
    const number = Number(match[1]);
    if (Number.isInteger(number) && number > 0) used.add(number);
  }

  let next = 1;
  while (used.has(next)) next += 1;
  return `S-${String(next).padStart(4, "0")}`;
}

function nextAvailableStudentCode(students: StudentRow[]) {
  return nextAvailableStudentCodeFromValues(students.map((item) => item.student.studentCode));
}

function isDuplicateUsernameError(cause: unknown) {
  return cause instanceof Error && cause.message === "This username already exists. Please type another username.";
}

async function request<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers
  });
  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("The school service returned an unreadable response. Please try again.");
    }
  }
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const comma = value.indexOf(",");
      if (comma < 0) reject(new Error("Could not encode the selected file."));
      else resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function FamilyPanel({ accessToken }: { accessToken: string }) {
  const { locale, selectedAcademicYearId, selectedAcademicYear } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const toastPortalTarget = typeof document === "undefined" ? null : document.body;
  const [overview, setOverview] = useState<FamilyOverview | null>(null);
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const { error, notice, setError, setNotice } = useTransientAdminFeedback({ persistent: true });
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [accountPreview, setAccountPreview] = useState<AccountCredentialPreview | null>(null);
  const [accountPreviewClosePrompt, setAccountPreviewClosePrompt] = useState(false);

  const [studentYearId, setStudentYearId] = useState("");
  const [studentAccountId, setStudentAccountId] = useState("");
  const [studentAccountSubmitting, setStudentAccountSubmitting] = useState(false);
  const [studentCode, setStudentCode] = useState("");
  const [parentSearch, setParentSearch] = useState("");
  const [selectedParentUserId, setSelectedParentUserId] = useState("");
  const [parentUsernameFilter, setParentUsernameFilter] = useState("");
  const [parentStatusFilter, setParentStatusFilter] = useState("");
  const [parentChildFilter, setParentChildFilter] = useState("");
  const [studentUsernameFilter, setStudentUsernameFilter] = useState("");
  const [studentClassFilter, setStudentClassFilter] = useState("");
  const [studentParentFilter, setStudentParentFilter] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState("");
  const [usernamePopup, setUsernamePopup] = useState("");
  const [importEntity, setImportEntity] = useState<ImportEntity>("PARENT");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<Validation | null>(null);
  const [importFileName, setImportFileName] = useState("");

  const parentMap = useMemo(
    () => new Map(overview?.parents.map((item) => [item.user.id, item]) ?? []),
    [overview]
  );

  const availableClasses = useMemo(
    () => academics?.classes.filter((item) => item.academicYearId === studentYearId) ?? [],
    [academics, studentYearId]
  );

  const suggestedStudentCode = useMemo(
    () => nextAvailableStudentCode(overview?.students ?? []),
    [overview?.students]
  );

  const selectedYearStudents = useMemo(() => {
    if (!overview || !selectedAcademicYearId) return [] as EnrollmentRow[];
    const latestByStudent = new Map<string, EnrollmentRow>();
    for (const enrollment of overview.enrollments) {
      if (enrollment.academicYear.id !== selectedAcademicYearId) continue;
      const current = latestByStudent.get(enrollment.student.id);
      if (!current || current.history.startedAt < enrollment.history.startedAt) {
        latestByStudent.set(enrollment.student.id, enrollment);
      }
    }
    return Array.from(latestByStudent.values()).sort((a, b) =>
      a.student.fullName.localeCompare(b.student.fullName)
    );
  }, [overview, selectedAcademicYearId]);

  const parentStatuses = useMemo(
    () => Array.from(new Set((overview?.parents ?? []).map((item) => item.user.status))).sort(),
    [overview?.parents]
  );

  const listedParents = useMemo(() => {
    const usernameQuery = parentUsernameFilter.trim().toLowerCase();
    return (overview?.parents ?? []).filter((parent) =>
      (!usernameQuery || parent.user.username.toLowerCase().includes(usernameQuery)) &&
      (!parentStatusFilter || parent.user.status === parentStatusFilter) &&
      (
        !parentChildFilter ||
        (parentChildFilter === "NONE" && parent.childCount === 0) ||
        (parentChildFilter === "ONE" && parent.childCount === 1) ||
        (parentChildFilter === "MULTIPLE" && parent.childCount > 1)
      )
    );
  }, [overview?.parents, parentUsernameFilter, parentStatusFilter, parentChildFilter]);

  const studentClassOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of selectedYearStudents) map.set(item.classSection.id, item.classSection.name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [selectedYearStudents]);

  const studentParentOptions = useMemo(() => {
    const ids = new Set(selectedYearStudents.map((item) => item.student.parentUserId));
    return (overview?.parents ?? [])
      .filter((parent) => ids.has(parent.user.id))
      .slice()
      .sort((a, b) => a.profile.fullName.localeCompare(b.profile.fullName));
  }, [overview?.parents, selectedYearStudents]);

  const studentStatuses = useMemo(
    () => Array.from(new Set(selectedYearStudents.map((item) => item.student.status))).sort(),
    [selectedYearStudents]
  );

  const listedStudents = useMemo(() => {
    const usernameQuery = studentUsernameFilter.trim().toLowerCase();
    return selectedYearStudents.filter((item) =>
      (!usernameQuery || Boolean(item.user?.username.toLowerCase().includes(usernameQuery))) &&
      (!studentClassFilter || item.classSection.id === studentClassFilter) &&
      (!studentParentFilter || item.student.parentUserId === studentParentFilter) &&
      (!studentStatusFilter || item.student.status === studentStatusFilter)
    );
  }, [
    selectedYearStudents,
    studentUsernameFilter,
    studentClassFilter,
    studentParentFilter,
    studentStatusFilter
  ]);

  const parentListHasFilters = Boolean(parentUsernameFilter.trim() || parentStatusFilter || parentChildFilter);
  const studentListHasFilters = Boolean(
    studentUsernameFilter.trim() || studentClassFilter || studentParentFilter || studentStatusFilter
  );

  function clearParentListFilters() {
    setParentUsernameFilter("");
    setParentStatusFilter("");
    setParentChildFilter("");
  }

  function clearStudentListFilters() {
    setStudentUsernameFilter("");
    setStudentClassFilter("");
    setStudentParentFilter("");
    setStudentStatusFilter("");
  }

  const selectedYearMutable =
    selectedAcademicYear?.status === "DRAFT" || selectedAcademicYear?.status === "ACTIVE";

  const availableParents = useMemo(
    () => overview?.parents.filter(
      (parent) => parent.user.status !== "SUSPENDED" && parent.user.status !== "ARCHIVED"
    ) ?? [],
    [overview?.parents]
  );

  const filteredParents = useMemo(() => {
    const query = parentSearch.trim().toLowerCase();
    if (!query) return availableParents;
    return availableParents.filter((parent) => parent.user.username.toLowerCase().includes(query));
  }, [availableParents, parentSearch]);

  const studentsWithoutLogin = useMemo(
    () => overview?.students.filter((item) => !item.student.userId && item.student.status === "ACTIVE") ?? [],
    [overview?.students]
  );

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    if (selectedAcademicYearId) setStudentYearId(selectedAcademicYearId);
  }, [selectedAcademicYearId]);

  useEffect(() => {
    if (!studentCode && overview) setStudentCode(suggestedStudentCode);
  }, [overview, studentCode, suggestedStudentCode]);

  useEffect(() => {
    if (
      selectedParentUserId &&
      !availableParents.some((parent) => parent.user.id === selectedParentUserId)
    ) {
      setSelectedParentUserId("");
    }
  }, [availableParents, selectedParentUserId]);

  useEffect(() => {
    if (
      studentAccountId &&
      !studentsWithoutLogin.some((item) => item.student.id === studentAccountId)
    ) {
      setStudentAccountId("");
    }
  }, [studentAccountId, studentsWithoutLogin]);

  function accountPdfLabels(preview: AccountCredentialPreview): AccountPdfLabels {
    return {
      title: t(preview.accountType === "PARENT" ? "Parent account information" : "Student account information"),
      subtitle: t("Account credential"),
      username: t("Username"),
      fullName: t("Full name"),
      phone: t("Phone number"),
      temporaryPassword: t("Temporary password"),
      notProvided: t("Not provided"),
      important: t("Important"),
      note: t("Give this information only to the account owner and keep the PDF in a secure place.")
    };
  }

  async function exportAccountPreviewPdf(preview: AccountCredentialPreview) {
    try {
      await downloadAccountPdf(preview, accountPdfLabels(preview));
    } catch {
      setError(t("Could not export the account information as PDF. Please try again."));
    }
  }

  function scheduleAccountPreviewExport(preview: AccountCredentialPreview) {
    window.setTimeout(() => {
      void exportAccountPreviewPdf(preview);
    }, 180);
  }

  function requestCloseAccountPreview() {
    setAccountPreviewClosePrompt(true);
  }

  function confirmCloseAccountPreview() {
    setAccountPreview(null);
    setAccountPreviewClosePrompt(false);
  }

  async function load(options?: { silentFeedback?: boolean }): Promise<FamilyOverview | null> {
    if (!options?.silentFeedback) setError("");
    try {
      const [familyData, academicData] = await Promise.all([
        request<FamilyOverview>(accessToken, "/v1/admin/families"),
        request<AcademicOverview>(accessToken, "/v1/admin/academics")
      ]);
      setOverview(familyData);
      setAcademics(academicData);
      setStudentYearId((current) =>
        selectedAcademicYearId ||
        current ||
        academicData.academicYears.find((year) => year.status === "ACTIVE")?.id ||
        academicData.academicYears[0]?.id ||
        ""
      );
      return familyData;
    } catch (cause) {
      if (!options?.silentFeedback) {
        setError(adminErrorText(locale, cause, "Could not load family data."));
      }
      return null;
    }
  }

  async function createParent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{
        user: User;
        profile: ParentSummary["profile"];
        temporaryPassword: string;
      }>(
        accessToken,
        "/v1/admin/families/parents",
        {
          method: "POST",
          body: JSON.stringify({
            username: String(form.get("username") ?? "").trim(),
            fullName: String(form.get("fullName") ?? "").trim(),
            phone: String(form.get("phone") ?? "").trim() || undefined
          })
        }
      );
      const preview: AccountCredentialPreview = {
        accountType: "PARENT",
        username: result.user.username,
        fullName: result.profile.fullName,
        phone: result.profile.phone,
        temporaryPassword: result.temporaryPassword
      };
      setCredentials([]);
      setAccountPreview(preview);
      setNotice(t("Parent account created. The account PDF was exported automatically. Keep it secure before closing the preview."));
      formElement.reset();
      scheduleAccountPreviewExport(preview);
      void load({ silentFeedback: true });
    } catch (cause) {
      if (isDuplicateUsernameError(cause)) {
        setUsernamePopup(t("This username already exists. Please type another username."));
      } else {
        setError(adminErrorText(locale, cause, "Could not create parent."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{ student: StudentRow["student"] }>(
        accessToken,
        "/v1/admin/families/students",
        {
          method: "POST",
          body: JSON.stringify({
            studentCode: studentCode.trim(),
            fullName: String(form.get("fullName") ?? "").trim(),
            parentUserId: selectedParentUserId,
            academicYearId: String(form.get("academicYearId") ?? ""),
            classId: String(form.get("classId") ?? "")
          })
        }
      );

      setNotice(t("Student created and linked to the selected parent."));
      setParentSearch("");
      setSelectedParentUserId("");
      formElement.reset();

      const knownCodes = [
        ...(overview?.students.map((item) => item.student.studentCode) ?? []),
        result.student.studentCode
      ];
      setStudentCode(nextAvailableStudentCodeFromValues(knownCodes));

      // Refresh the lists quietly. The create response is already authoritative
      // for success, so a secondary read failure must not turn it into an error.
      void load({ silentFeedback: true });
    } catch (cause) {
      if (cause instanceof Error && cause.message === "That student code already exists in this school.") {
        const refreshed = await load({ silentFeedback: true });
        const knownCodes = [
          ...((refreshed?.students ?? overview?.students ?? []).map((item) => item.student.studentCode)),
          studentCode.trim()
        ];
        setStudentCode(nextAvailableStudentCodeFromValues(knownCodes));
      }
      setNotice("");
      setError(adminErrorText(locale, cause, "Could not create student."));
    } finally {
      setBusy(false);
    }
  }

  async function createStudentAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentAccountId || studentAccountSubmitting) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const targetStudentId = studentAccountId;
    setBusy(true);
    setStudentAccountSubmitting(true);
    setError("");
    setNotice("");
    setCredentials([]);

    try {
      const result = await request<{ user: User; student: StudentRow["student"]; temporaryPassword: string }>(
        accessToken,
        `/v1/admin/families/students/${targetStudentId}/account`,
        {
          method: "POST",
          body: JSON.stringify({
            username: String(form.get("username") ?? "").trim(),
            phone: String(form.get("phone") ?? "").trim() || undefined
          })
        }
      );

      setOverview((current) => {
        if (!current) return current;
        return {
          ...current,
          students: current.students.map((item) =>
            item.student.id === targetStudentId
              ? { ...item, student: result.student, user: result.user }
              : item
          ),
          enrollments: current.enrollments.map((item) =>
            item.student.id === targetStudentId
              ? { ...item, student: result.student, user: result.user }
              : item
          )
        };
      });

      setError("");
      const preview: AccountCredentialPreview = {
        accountType: "STUDENT",
        username: result.user.username,
        fullName: result.student.fullName,
        phone: result.student.phone,
        temporaryPassword: result.temporaryPassword
      };
      setCredentials([]);
      setAccountPreview(preview);
      setNotice(t("Student login created. The account PDF was exported automatically. Keep it secure before closing the preview."));
      setStudentAccountId("");
      formElement.reset();
      scheduleAccountPreviewExport(preview);

      // The credential creation is already complete. Refresh quietly so a
      // follow-up read failure never turns a successful create into a mixed
      // success/error state or hides the one-time credential.
      void load({ silentFeedback: true });
    } catch (cause) {
      setNotice("");
      if (isDuplicateUsernameError(cause)) {
        setUsernamePopup(t("This username already exists. Please type another username."));
      } else {
        setError(adminErrorText(locale, cause, "Could not create student account."));
      }
    } finally {
      setStudentAccountSubmitting(false);
      setBusy(false);
    }
  }

  async function parentAction(parent: ParentSummary, action: "reset-password" | "suspend" | "reactivate") {
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{ user: User; temporaryPassword?: string }>(
        accessToken,
        `/v1/admin/users/${parent.user.id}/${action}`,
        { method: "POST" }
      );
      if (result.temporaryPassword) {
        setCredentials([{ username: result.user.username, temporaryPassword: result.temporaryPassword }]);
        setNotice(t("A new temporary password was generated. It is shown only in this response."));
      } else {
        setNotice(t(action === "suspend" ? "Parent account suspended." : "Parent account reactivated."));
      }
      void load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Parent account action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function studentAccountAction(item: EnrollmentRow, action: "reset-password" | "suspend" | "reactivate") {
    if (!item.user) return;

    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{ user: User; temporaryPassword?: string }>(
        accessToken,
        `/v1/admin/users/${item.user.id}/${action}`,
        { method: "POST" }
      );

      if (result.temporaryPassword) {
        setCredentials([{ username: result.user.username, temporaryPassword: result.temporaryPassword }]);
        setNotice(t("A new temporary password was generated. It is shown only in this response."));
      } else {
        setNotice(t(action === "suspend" ? "Student account suspended." : "Student account reactivated."));
      }

      setOverview((current) => {
        if (!current) return current;
        return {
          ...current,
          students: current.students.map((studentItem) =>
            studentItem.student.id === item.student.id
              ? { ...studentItem, user: result.user }
              : studentItem
          ),
          enrollments: current.enrollments.map((enrollment) =>
            enrollment.student.id === item.student.id
              ? { ...enrollment, user: result.user }
              : enrollment
          )
        };
      });
      void load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Student account action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent(item: EnrollmentRow) {
    if (!window.confirm(t("Delete this student? This action cannot be undone."))) return;

    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      await request(accessToken, `/v1/admin/families/students/${item.student.id}`, { method: "DELETE" });
      setNotice(t("Student deleted."));
      setOverview((current) => {
        if (!current) return current;
        return {
          ...current,
          students: current.students.filter((studentItem) => studentItem.student.id !== item.student.id),
          enrollments: current.enrollments.filter((enrollment) => enrollment.student.id !== item.student.id)
        };
      });
      void load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not delete student."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteParent(parent: ParentSummary) {
    if (parent.childCount > 0) {
      setError(t("This parent cannot be deleted because students are linked to the account."));
      return;
    }

    if (!window.confirm(t("Delete this parent account? This action cannot be undone."))) return;

    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      await request(accessToken, `/v1/admin/families/parents/${parent.user.id}`, { method: "DELETE" });
      setNotice(t("Parent account deleted."));
      void load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not delete parent account."));
    } finally {
      setBusy(false);
    }
  }

  function resetImport(nextEntity = importEntity) {
    setImportEntity(nextEntity);
    setPreview(null);
    setMapping({});
    setValidation(null);
    setImportFileName("");
  }

  async function selectImportFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    setValidation(null);
    try {
      const contentBase64 = await toBase64(file);
      const result = await request<Preview>(accessToken, "/v1/admin/families/import/preview", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, contentBase64 })
      });
      const autoMapping: Record<string, string> = {};
      for (const field of importFields[importEntity]) {
        const matching = result.headers.find((header) => field.aliases.includes(normalizeHeader(header)));
        if (matching) autoMapping[field.key] = matching;
      }
      setPreview(result);
      setMapping(autoMapping);
      setImportFileName(file.name);
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not preview import file."));
    } finally {
      setBusy(false);
    }
  }

  async function validateImport() {
    if (!preview) return;
    const missing = importFields[importEntity].filter((field) => field.required && !mapping[field.key]);
    if (missing.length > 0) {
      setError(adminFormat(locale, "Map all required fields before validation: {fields}.", { fields: missing.map((item) => t(item.label)).join(", ") }));
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<Validation>(accessToken, "/v1/admin/families/import/validate", {
        method: "POST",
        body: JSON.stringify({ entityType: importEntity, rows: preview.rows, mapping })
      });
      setValidation(result);
      if (result.valid) {
        setNotice(adminFormat(locale, "{count} rows validated. Review and confirm the import.", { count: result.validRowCount }));
      } else {
        setError(t("Import not committed — fix the errors and validate again."));
      }
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Import validation failed."));
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!validation?.valid) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{ importedCount: number; credentials: Credential[] }>(
        accessToken,
        "/v1/admin/families/import/commit",
        {
          method: "POST",
          body: JSON.stringify({ entityType: importEntity, rows: validation.normalizedRows })
        }
      );
      setCredentials(result.credentials);
      setNotice(adminFormat(locale, "{count} {entity} row(s) imported successfully.", {
        count: result.importedCount,
        entity: importEntity === "PARENT" ? t("Parents") : t("Students")
      }));
      setPreview(null);
      setValidation(null);
      setMapping({});
      setImportFileName("");
      void load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Import failed."));
    } finally {
      setBusy(false);
    }
  }

  if (!overview || !academics) {
    return (
      <section className="admin-panel family-section admin-loading-card">
        <AdminLoader label={t("Loading Phase 4 data…")} />
        <AdminSkeleton rows={5} />
        {error && toastPortalTarget
          ? createPortal(
              <div className="family-feedback-toast-host">
                <div
                  className="family-username-popup family-feedback-popup family-feedback-toast family-feedback-error"
                  role="alert"
                  aria-labelledby="family-load-error-title"
                >
                  <span className="family-feedback-icon" aria-hidden="true">!</span>
                  <div className="family-feedback-copy">
                    <strong id="family-load-error-title">{t("Error")}</strong>
                    <p>{error}</p>
                  </div>
                  <div className="admin-actions family-feedback-actions">
                    <button className="admin-secondary" type="button" onClick={() => setError("")} data-admin-no-loading="true">
                      {t("OK")}
                    </button>
                    <button className="admin-primary" type="button" onClick={() => void load()} data-admin-no-loading="true">
                      {t("Retry")}
                    </button>
                  </div>
                </div>
              </div>,
              toastPortalTarget
            )
          : null}
      </section>
    );
  }

  return (
    <section className="family-section admin-page-enter">
      {accountPreviewClosePrompt && toastPortalTarget
        ? createPortal(
            <div className="family-username-popup-backdrop" role="presentation">
              <div className="family-username-popup" role="alertdialog" aria-modal="true" aria-labelledby="family-account-save-title">
                <strong id="family-account-save-title">{t("Have you saved the account information?")}</strong>
                <p>{t("Choose Yes only after you have saved the exported PDF containing the username, full name, phone number, and temporary password.")}</p>
                <div className="admin-actions">
                  <button className="admin-secondary" type="button" onClick={() => setAccountPreviewClosePrompt(false)} data-admin-no-loading="true">
                    {t("No")}
                  </button>
                  <button className="admin-primary" type="button" onClick={confirmCloseAccountPreview} data-admin-no-loading="true">
                    {t("Yes")}
                  </button>
                </div>
              </div>
            </div>,
            toastPortalTarget
          )
        : null}

      {usernamePopup && toastPortalTarget
        ? createPortal(
            <div className="family-feedback-toast-host">
              <div
                className="family-username-popup family-feedback-popup family-feedback-toast family-feedback-error"
                role="alert"
                aria-labelledby="family-username-popup-title"
              >
                <span className="family-feedback-icon" aria-hidden="true">!</span>
                <div className="family-feedback-copy">
                  <strong id="family-username-popup-title">{t("Username already exists")}</strong>
                  <p>{usernamePopup}</p>
                </div>
                <button
                  className="admin-primary family-feedback-dismiss"
                  type="button"
                  onClick={() => setUsernamePopup("")}
                  data-admin-no-loading="true"
                >
                  {t("OK")}
                </button>
              </div>
            </div>,
            toastPortalTarget
          )
        : null}

      {(error || notice) && toastPortalTarget
        ? createPortal(
            <div className="family-feedback-toast-host">
              <div
                className={`family-username-popup family-feedback-popup family-feedback-toast ${error ? "family-feedback-error" : "family-feedback-success"}`}
                role={error ? "alert" : "status"}
                aria-labelledby="family-feedback-title"
              >
                <span className="family-feedback-icon" aria-hidden="true">{error ? "!" : "✓"}</span>
                <div className="family-feedback-copy">
                  <strong id="family-feedback-title">{t(error ? "Error" : "Success")}</strong>
                  <p>{error || notice}</p>
                </div>
                <button
                  className="admin-primary family-feedback-dismiss"
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("");
                  }}
                  data-admin-no-loading="true"
                >
                  {t("OK")}
                </button>
              </div>
            </div>,
            toastPortalTarget
          )
        : null}

      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 4 · Student & Family System")}</span>
          <h2>{t("Onboard families")}</h2>
          <p>{t("Create school-controlled parent accounts, link each student to exactly one parent, and import validated school data.")}</p>
        </div>
      </div>

      {accountPreview ? (
        <section className="credential-card family-account-preview">
          <div className="family-account-preview-header">
            <div>
              <span className="eyebrow">{t(accountPreview.accountType === "PARENT" ? "Parent account information" : "Student account information")}</span>
              <h2>{t("Account credential")}</h2>
              <p>{t("The account PDF is exported automatically after creation. You can export it again below. The temporary password cannot be retrieved later.")}</p>
            </div>
            <div className="family-account-preview-actions">
              <button
                className="admin-secondary"
                type="button"
                onClick={() => void exportAccountPreviewPdf(accountPreview)}
                data-admin-no-loading="true"
              >
                {t("Export as PDF")}
              </button>
              <button
                className="admin-secondary"
                type="button"
                onClick={requestCloseAccountPreview}
                data-admin-no-loading="true"
              >
                {t("Close")}
              </button>
            </div>
          </div>

          <div className="family-account-preview-grid">
            <div>
              <span>{t("Username")}</span>
              <strong dir="ltr">{accountPreview.username}</strong>
            </div>
            <div>
              <span>{t("Full name")}</span>
              <strong>{accountPreview.fullName}</strong>
            </div>
            <div className="family-account-preview-phone">
              <span>{t("Phone number")}</span>
              <strong dir="ltr">{accountPreview.phone || t("Not provided")}</strong>
            </div>
            <div className="family-account-preview-password">
              <span>{t("Temporary password")}</span>
              <code dir="ltr">{accountPreview.temporaryPassword}</code>
            </div>
          </div>

          <div className="family-account-preview-note">
            <strong>{t("Important")}</strong>
            <span>{t("Give this information only to the account owner and keep the PDF in a secure place.")}</span>
          </div>
        </section>
      ) : null}

      {credentials.length > 0 ? (
        <section className="credential-card family-credential">
          <div className="admin-section-header">
            <strong>{t("Temporary credentials — distribute securely")}</strong>
            <button className="admin-secondary" type="button" onClick={() => window.print()}>{t("Print")}</button>
          </div>
          {credentials.map((credential) => (
            <div key={credential.username}>
              <span>{credential.username}</span>
              <code>{credential.temporaryPassword}</code>
            </div>
          ))}
          <p>{t("Temporary passwords are shown after creation/reset/import. Permanent passwords are never retrievable.")}</p>
        </section>
      ) : null}

      <div className="academic-summary-grid family-summary-grid">
        <Summary label={t("Parents")} value={overview.parents.length} />
        <Summary label={t("Students")} value={selectedYearStudents.length} />
        <Summary label={t("Active students")} value={selectedYearStudents.filter((item) => item.student.status === "ACTIVE").length} />
        <Summary label={t("Families with siblings")} value={overview.parents.filter((item) => item.childCount > 1).length} />
      </div>

      <div className="family-add-student-layout">
      <article className="admin-panel academic-form-card family-add-student-card">
        <div><h2>{t("Add student")}</h2><p>{t("Link the student to one existing parent account. The relationship is singular, not many-to-many.")}</p></div>
        <form className="admin-form family-add-student-form" onSubmit={createStudent}>
          <div className="family-add-student-field">
            <label>
              {t("Student code")}
              <input
                name="studentCode"
                value={studentCode}
                onChange={(event) => setStudentCode(event.target.value.toUpperCase())}
                placeholder="S-0001"
                required
              />
            </label>
            <p className="admin-form-help">{t("The lowest available student code is suggested automatically. You can change it if needed.")}</p>
          </div>
          <label>{t("Full name")}<input name="fullName" placeholder={t("Student full name")} required /></label>
          <label>
            {t("Search parent username")}
            <input
              value={parentSearch}
              onChange={(event) => {
                const next = event.target.value;
                setParentSearch(next);
                const exact = availableParents.find((parent) => parent.user.username.toLowerCase() === next.trim().toLowerCase());
                if (exact) setSelectedParentUserId(exact.user.id);
                else if (selectedParentUserId && !availableParents.some((parent) => parent.user.id === selectedParentUserId && parent.user.username.toLowerCase().includes(next.trim().toLowerCase()))) {
                  setSelectedParentUserId("");
                }
              }}
              placeholder={t("Type a username to filter parents")}
              autoCapitalize="none"
              autoComplete="off"
            />
          </label>
          <label>
            {t("Parent")}
            <select
              name="parentUserId"
              required
              value={selectedParentUserId}
              onChange={(event) => setSelectedParentUserId(event.target.value)}
            >
              <option value="">{t("Select parent")}</option>
              {filteredParents.map((parent) => (
                <option key={parent.user.id} value={parent.user.id}>
                  {parent.user.username}
                </option>
              ))}
            </select>
          </label>
          <label>{t("Academic year")}<select name="academicYearId" required value={studentYearId} onChange={(event) => setStudentYearId(event.target.value)}>
              <option value="">{t("Select year")}</option>
              {selectedAcademicYear && selectedYearMutable ? (
                <option value={selectedAcademicYear.id}>{selectedAcademicYear.name} · {t(selectedAcademicYear.status)}</option>
              ) : null}
            </select>
          </label>
          <label>{t("Class")}<select name="classId" required defaultValue="" key={studentYearId}>
              <option value="">{t("Select class")}</option>
              {availableClasses.map((classSection) => (
                <option key={classSection.id} value={classSection.id}>{classSection.name} · {classSection.code}</option>
              ))}
            </select>
          </label>
          <button className="admin-primary family-add-student-submit" disabled={busy || availableParents.length === 0 || !selectedYearMutable}>{t("Add student")}</button>
        </form>
      </article>
      </div>

      <div className="family-account-layout">
        <div className="family-account-column">
      <article className="admin-panel academic-form-card">
        <div><h2>{t("Create parent account")}</h2><p>{t("Creates a PARENT identity and profile together and generates a one-time temporary password.")}</p></div>
        <form className="admin-form" onSubmit={createParent}>
          <label>
            {t("Username")}
            <input
              name="username"
              placeholder="Ahmad, Haidar23, Fatima2026"
              autoCapitalize="none"
              autoComplete="off"
              pattern="[A-Za-z0-9]+"
              minLength={3}
              maxLength={64}
              title={t("Only English letters and digits are allowed. Spaces and special characters are not allowed.")}
              required
            />
          </label>
          <p className="admin-form-help">{t("Only English letters and digits are allowed. Spaces and special characters are not allowed.")}</p>
          <label>{t("Full name")}<input name="fullName" placeholder={t("Parent full name")} required /></label>
          <label>{t("Phone")}<input name="phone" placeholder="07xxxxxxxx" /></label>
          <button className="admin-primary" disabled={busy}>{t("Create parent & credential")}</button>
        </form>
      </article>
      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div>
            <h2>{t("Parents")}</h2>
            <p>{listedParents.length} / {overview.parents.length}</p>
          </div>
          <button
            type="button"
            className="admin-secondary academic-filter-clear"
            onClick={clearParentListFilters}
            disabled={!parentListHasFilters}
            data-admin-no-loading="true"
          >
            {t("Clear filters")}
          </button>
        </div>

        <div className="academic-timetable-filters family-list-filters" aria-label={t("Parent filters")}>
          <label>
            <span>{t("Username")}</span>
            <input
              type="search"
              value={parentUsernameFilter}
              onChange={(event) => setParentUsernameFilter(event.target.value)}
              placeholder={t("Search username")}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            <span>{t("Account status")}</span>
            <select value={parentStatusFilter} onChange={(event) => setParentStatusFilter(event.target.value)}>
              <option value="">{t("All statuses")}</option>
              {parentStatuses.map((status) => (
                <option key={status} value={status}>{t(status)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("Child count")}</span>
            <select value={parentChildFilter} onChange={(event) => setParentChildFilter(event.target.value)}>
              <option value="">{t("All child counts")}</option>
              <option value="NONE">{t("No children")}</option>
              <option value="ONE">{t("One child")}</option>
              <option value="MULTIPLE">{t("Multiple children")}</option>
            </select>
          </label>
        </div>

        <div
          className={`academic-rows family-list-rows ${listedParents.length > 4 ? "family-list-scroll" : ""}`}
        >
          {listedParents.map((parent) => (
            <div className="academic-row" key={parent.user.id}>
              <div>
                <strong>{parent.profile.fullName}</strong>
                <span>{parent.user.username} · {adminFormat(locale, "{count} child(ren)", { count: parent.childCount })} · {parent.profile.phone || t("No phone")}</span>
                <span>{t(parent.user.status)}{parent.user.lastLoginAt
  ? ` · ${adminFormat(locale, "last login {date}", { date: formatAdminHijriDateTime(locale, parent.user.lastLoginAt) })}`
  : ` · ${t("never logged in")}`}</span>
              </div>
              <div className="admin-actions">
                <button disabled={busy || parent.user.status === "ARCHIVED"} onClick={() => void parentAction(parent, "reset-password")}>{t("Reset password")}</button>
                {parent.user.status === "SUSPENDED" ? (
                  <button disabled={busy} onClick={() => void parentAction(parent, "reactivate")}>{t("Reactivate")}</button>
                ) : (
                  <button disabled={busy || parent.user.status === "ARCHIVED"} onClick={() => void parentAction(parent, "suspend")}>{t("Suspend")}</button>
                )}
                <button
                  className="admin-danger"
                  disabled={busy || parent.childCount > 0}
                  title={parent.childCount > 0 ? t("This parent cannot be deleted because students are linked to the account.") : t("Delete parent")}
                  onClick={() => void deleteParent(parent)}
                >
                  {t("Delete parent")}
                </button>
              </div>
            </div>
          ))}
          {overview.parents.length === 0 ? (
            <p className="admin-copy">{t("No parent accounts yet.")}</p>
          ) : listedParents.length === 0 ? (
            <p className="admin-copy">{t("No parents match the selected filters.")}</p>
          ) : null}
        </div>
      </article>
        </div>

        <div className="family-account-column">
      <article className="admin-panel academic-form-card">
        <div><h2>{t("Create student login")}</h2><p>{t("Creates a school-issued STUDENT account and links it to exactly one existing student record.")}</p></div>
        <form className="admin-form" onSubmit={createStudentAccount}>
          <label>
            {t("Student without login")}
            <select value={studentAccountId} onChange={(event) => setStudentAccountId(event.target.value)} required>
              <option value="">{t("Select student")}</option>
              {studentsWithoutLogin.map((item) => (
                <option key={item.student.id} value={item.student.id}>{item.student.fullName} · {item.student.studentCode}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Username")}
            <input
              name="username"
              placeholder="Ahmad, Haidar23, Fatima2026"
              autoCapitalize="none"
              autoComplete="off"
              pattern="[A-Za-z0-9]+"
              minLength={3}
              maxLength={64}
              title={t("Only English letters and digits are allowed. Spaces and special characters are not allowed.")}
              required
            />
          </label>
          <p className="admin-form-help">{t("Only English letters and digits are allowed. Spaces and special characters are not allowed.")}</p>
          <label>
            {t("Phone")}
            <input name="phone" placeholder="07xxxxxxxx" inputMode="tel" autoComplete="tel" />
          </label>
          <button
            className="admin-primary"
            disabled={busy || !studentAccountId}
            data-admin-no-loading="true"
            data-admin-pending={studentAccountSubmitting ? "true" : undefined}
            aria-busy={studentAccountSubmitting || undefined}
          >
            {t("Create student credential")}
          </button>
        </form>
      </article>
      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div>
            <h2>{t("Students")}</h2>
            <p>{listedStudents.length} / {selectedYearStudents.length}</p>
          </div>
          <button
            type="button"
            className="admin-secondary academic-filter-clear"
            onClick={clearStudentListFilters}
            disabled={!studentListHasFilters}
            data-admin-no-loading="true"
          >
            {t("Clear filters")}
          </button>
        </div>

        <div className="academic-timetable-filters family-list-filters" aria-label={t("Student filters")}>
          <label>
            <span>{t("Username")}</span>
            <input
              type="search"
              value={studentUsernameFilter}
              onChange={(event) => setStudentUsernameFilter(event.target.value)}
              placeholder={t("Search username")}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            <span>{t("Class")}</span>
            <select value={studentClassFilter} onChange={(event) => setStudentClassFilter(event.target.value)}>
              <option value="">{t("All classes")}</option>
              {studentClassOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("Parent")}</span>
            <select value={studentParentFilter} onChange={(event) => setStudentParentFilter(event.target.value)}>
              <option value="">{t("All parents")}</option>
              {studentParentOptions.map((parent) => (
                <option key={parent.user.id} value={parent.user.id}>{parent.profile.fullName}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("Student status")}</span>
            <select value={studentStatusFilter} onChange={(event) => setStudentStatusFilter(event.target.value)}>
              <option value="">{t("All statuses")}</option>
              {studentStatuses.map((status) => (
                <option key={status} value={status}>{t(status)}</option>
              ))}
            </select>
          </label>
        </div>

        <div
          className={`academic-rows family-list-rows ${listedStudents.length > 4 ? "family-list-scroll" : ""}`}
        >
          {listedStudents.map((item) => {
            const parent = parentMap.get(item.student.parentUserId);
            return (
              <div className="academic-row" key={item.student.id}>
                <div>
                  <strong>{item.student.fullName}</strong>
                  <span>{item.student.studentCode} · {item.classSection.name} · {item.academicYear.name}</span>
                  <span>{t("Parent")}: {parent?.profile.fullName ?? t("Unknown")} · {t(item.student.status)}</span>
                  <span>
                    {item.user
                      ? `${item.user.username} · ${t(item.user.status)}`
                      : t("No student login yet")}
                  </span>
                </div>
                <div className="admin-actions">
                  {item.user ? (
                    <>
                      <button
                        disabled={busy || item.user.status === "ARCHIVED"}
                        onClick={() => void studentAccountAction(item, "reset-password")}
                      >
                        {t("Reset password")}
                      </button>
                      {item.user.status === "SUSPENDED" ? (
                        <button disabled={busy} onClick={() => void studentAccountAction(item, "reactivate")}>
                          {t("Reactivate")}
                        </button>
                      ) : (
                        <button
                          disabled={busy || item.user.status === "ARCHIVED"}
                          onClick={() => void studentAccountAction(item, "suspend")}
                        >
                          {t("Suspend")}
                        </button>
                      )}
                    </>
                  ) : null}
                  <button
                    className="admin-danger"
                    disabled={busy}
                    onClick={() => void deleteStudent(item)}
                  >
                    {t("Delete")}
                  </button>
                </div>
              </div>
            );
          })}
          {selectedYearStudents.length === 0 ? (
            <p className="admin-copy">{t("No students in the selected academic year.")}</p>
          ) : listedStudents.length === 0 ? (
            <p className="admin-copy">{t("No students match the selected filters.")}</p>
          ) : null}
        </div>
      </article>
        </div>
      </div>

      <article className="admin-panel family-import-panel">
        <div className="admin-section-header">
          <div>
            <h2>{t("Bulk import")}</h2>
            <p>{t("CSV/XLSX · upload → map → validate → preview errors → confirm → import → credentials.")}</p>
          </div>
          <button className="admin-secondary" type="button" onClick={() => resetImport()} disabled={busy}>{t("Reset")}</button>
        </div>

        <div className="family-import-controls">
          <label>
            {t("Import type")}
            <select value={importEntity} onChange={(event) => resetImport(event.target.value as ImportEntity)} disabled={busy}>
              <option value="PARENT">{t("Parents")}</option>
              <option value="STUDENT">{t("Students")}</option>
              <option value="TEACHER">{t("Teachers")}</option>
            </select>
          </label>
          <label>
            {t("CSV or XLSX file")}
            <input
              type="file"
              accept=".csv,.tsv,.xlsx"
              onChange={(event) => void selectImportFile(event.target.files?.[0])}
              disabled={busy}
            />
          </label>
        </div>

        {preview ? (
          <>
            <p className="admin-copy"><strong>{importFileName}</strong> · {adminFormat(locale, "{rows} data row(s) · {columns} column(s)", {
              rows: preview.rows.length,
              columns: preview.headers.length
            })}</p>
            <div className="family-mapping-grid">
              {importFields[importEntity].map((field) => (
                <label key={field.key}>
                  {t(field.label)}{field.required ? " *" : ""}
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => {
                      setMapping((current) => ({ ...current, [field.key]: event.target.value }));
                      setValidation(null);
                    }}
                  >
                    <option value="">{t("Do not map")}</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="admin-actions family-import-actions">
              <button className="admin-primary" type="button" onClick={() => void validateImport()} disabled={busy}>{t("Validate rows")}</button>
              {validation?.valid ? (
                <button className="admin-secondary" type="button" onClick={() => void commitImport()} disabled={busy}>{t("Confirm import")}</button>
              ) : null}
            </div>
          </>
        ) : null}

        {validation ? (
          <div className={validation.valid ? "admin-success" : "admin-error"}>
            <strong>{t(validation.valid ? "Validation passed." : "Import not committed — fix the errors and validate again.")}</strong>
            <div>{adminFormat(locale, "{valid} of {total} row(s) valid.", {
              valid: validation.validRowCount,
              total: validation.rowCount
            })}</div>
            {validation.errors.length > 0 ? (
              <ul className="family-import-errors">
                {validation.errors.slice(0, 50).map((item, index) => (
                  <li key={`${item.row}-${item.field ?? "row"}-${index}`}>
                    {adminFormat(locale, "Row {row}", { row: item.row })}
                    {item.field ? ` · ${t(item.field)}` : ""}: {adminErrorText(locale, new Error(item.message), "Validation issue")}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="academic-summary">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
