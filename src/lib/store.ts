/**
 * Ward jobs data, kept on this phone only (localStorage). Nothing is sent to any server.
 * Patients are identified by ward, bed and initials. Jobs carry timestamps, a status and a
 * progress log. Follow-up jobs are "locked": clean-ups and discharge never remove them, and
 * they can only be closed by unlocking and recording an outcome.
 */
import { useEffect, useState } from "react";

export type Priority = "Urgent" | "Today" | "Routine";
export type Status = "todo" | "doing" | "waiting" | "done";
export const STATUS_LABEL: Record<Status, string> = { todo: "To do", doing: "In progress", waiting: "Awaiting", done: "Done" };
export const PRIORITIES: Priority[] = ["Urgent", "Today", "Routine"];
export const CATEGORIES = ["Bloods", "Imaging", "Referral", "Prescribing", "Review", "Procedure", "Communication", "Discharge", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface LogItem { at: number; by: string; text: string; status?: Status }

export interface Patient {
  id: string;
  ward: string;
  bed: string;
  initials: string;
  summary?: string; // one-line, no identifiers
  discharged?: number; // timestamp
  createdAt: number;
  updatedAt: number;
}

export interface Job {
  id: string;
  patientId: string;
  text: string;
  category: Category;
  priority: Priority;
  status: Status;
  dueTime?: string; // HH:MM today
  assignee?: string;
  followUp?: boolean; // locked long-term follow-up
  expectedBy?: string; // YYYY-MM-DD for follow-ups
  outcome?: string; // recorded when a follow-up is closed
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  doneAt?: number;
  doneBy?: string;
  log: LogItem[];
}

export interface Settings {
  myName: string; // initials or role shown on jobs you create / complete
  wards: string[];
  theme: "dark" | "light";
  clearDoneAfterHours: number;
  removeDischargedAfterHours: number;
  pin?: string; // 4-6 digits; app locks after being in the background
  lockAfterMinutes: number;
  notify?: NotifyPrefs;
  links?: ResourceLink[];
}

export interface ResourceLink { id: string; title: string; url: string }
export const DEFAULT_LINKS: ResourceLink[] = [
  { id: "r-wx-anaes", title: "Whipps Cross Anaesthetics & ICU (Box)", url: "https://whippscrossanaestheticdepartme.box.com/s/wd090mzh7mrtdn4vgpzarvuy2coyxa2d" },
  { id: "r-barts", title: "Barts Health (Box)", url: "https://barts.box.com/s/i58b8k6ivraunruvs9duk5zkbk5ld0dt" },
];

export interface NotifyPrefs {
  urgent: boolean; // urgent jobs added by others
  assigned: boolean; // jobs assigned to me
  completed: boolean; // jobs completed by others
  followups: boolean; // follow-ups added / closed by others
  reminders: boolean; // due times and follow-up expected dates
  details: boolean; // show bed and job text (never initials) in notifications
  quiet: boolean; // quiet hours
  quietFrom: string;
  quietTo: string;
  push?: boolean; // web push turned on for this phone
}
export const DEFAULT_NOTIFY: NotifyPrefs = { urgent: true, assigned: true, completed: false, followups: true, reminders: true, details: true, quiet: false, quietFrom: "21:00", quietTo: "07:30" };

export interface Data { patients: Patient[]; jobs: Job[]; settings: Settings }

const KEY = "ward_jobs_v1";
const DEFAULT_SETTINGS: Settings = {
  myName: "",
  wards: ["ICU"],
  theme: "dark",
  clearDoneAfterHours: 24,
  removeDischargedAfterHours: 24,
  lockAfterMinutes: 2,
};

let data: Data = load();
const listeners = new Set<() => void>();

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { patients: d.patients || [], jobs: d.jobs || [], settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) } };
    }
  } catch { /* fall through */ }
  return { patients: [], jobs: [], settings: { ...DEFAULT_SETTINGS } };
}

// Records changed on this phone (for team sync). Remote changes are applied with remote = true.
export type ChangeListener = (changed: string[], removed: Array<{ id: string; type: "patient" | "job" }>) => void;
const changeListeners = new Set<ChangeListener>();
export const onLocalChange = (l: ChangeListener) => { changeListeners.add(l); return () => { changeListeners.delete(l); }; };

function diff(prev: Data, next: Data) {
  const changed: string[] = [];
  const removed: Array<{ id: string; type: "patient" | "job" }> = [];
  const scan = <T extends { id: string }>(a: T[], b: T[], type: "patient" | "job") => {
    if (a === b) return;
    const before = new Map(a.map((x) => [x.id, x]));
    const after = new Set<string>();
    for (const x of b) {
      after.add(x.id);
      const old = before.get(x.id);
      if (old !== x && (!old || JSON.stringify(old) !== JSON.stringify(x))) changed.push(x.id);
    }
    for (const x of a) if (!after.has(x.id)) removed.push({ id: x.id, type });
  };
  scan(prev.patients, next.patients, "patient");
  scan(prev.jobs, next.jobs, "job");
  return { changed, removed };
}

function commit(next: Data, opts: { remote?: boolean } = {}) {
  const prev = data;
  data = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full */ }
  if (!opts.remote && changeListeners.size) {
    const { changed, removed } = diff(prev, next);
    if (changed.length || removed.length) changeListeners.forEach((l) => l(changed, removed));
  }
  listeners.forEach((l) => l());
}

/** Apply changes that came from the team server (doesn't trigger another upload). */
export function applyRemote(patients: Patient[], jobs: Job[]) {
  const wards = [...new Set([...data.settings.wards, ...patients.map((p) => p.ward)])];
  commit({ ...data, patients, jobs, settings: { ...data.settings, wards } }, { remote: true });
}

export function useData(): Data {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return data;
}
export const getData = () => data;

export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const me = () => data.settings.myName.trim() || "Me";

// ---------- settings ----------
export function updateSettings(patch: Partial<Settings>) {
  commit({ ...data, settings: { ...data.settings, ...patch } });
}

// ---------- patients ----------
export function savePatient(p: Partial<Patient> & { ward: string; bed: string; initials: string }): Patient {
  const now = Date.now();
  const existing = p.id ? data.patients.find((x) => x.id === p.id) : undefined;
  const patient: Patient = existing
    ? { ...existing, ...p, initials: p.initials.toUpperCase(), updatedAt: now } as Patient
    : { summary: "", ...p, id: uid("p"), initials: p.initials.toUpperCase(), createdAt: now, updatedAt: now } as Patient;
  const patients = existing ? data.patients.map((x) => (x.id === patient.id ? patient : x)) : [...data.patients, patient];
  const wards = data.settings.wards.includes(patient.ward) ? data.settings.wards : [...data.settings.wards, patient.ward];
  commit({ ...data, patients, settings: { ...data.settings, wards } });
  return patient;
}

export function dischargePatient(id: string, undo = false) {
  const now = Date.now();
  commit({ ...data, patients: data.patients.map((p) => (p.id === id ? { ...p, discharged: undo ? undefined : now, updatedAt: now } : p)) });
}

/** Delete a patient and their jobs. Refused while they have open follow-ups. */
export function deletePatient(id: string): boolean {
  if (data.jobs.some((j) => j.patientId === id && j.followUp && j.status !== "done")) return false;
  commit({ ...data, patients: data.patients.filter((p) => p.id !== id), jobs: data.jobs.filter((j) => j.patientId !== id) });
  return true;
}

// ---------- jobs ----------
const CATEGORY_WORDS: Array<[Category, RegExp]> = [
  ["Bloods", /\b(bloods?|fbc|u ?& ?e|ues?|lfts?|crp|vbg|abg|cultures?|coag|inr|trop|troponin|lactate|mg|phos|level|levels|vanc|gent|tdm|serology|hiv|hep|antibod|anti-?\w+|ana|anca|gbm|ck|bnp|procalcitonin|pct|ferritin|b12|folate|tft|cortisol)\b/i],
  ["Imaging", /\b(ct|cxr|x-?ray|xr|mri|uss|ultrasound|echo|ctpa|scan|imaging|angio|doppler)\b/i],
  ["Referral", /\b(refer|referral|r\/v by|discuss with|d\/w|consult|tertiary|outreach|surgeons?|team)\b/i],
  ["Prescribing", /\b(prescribe|chart|abx|antibiotics?|meds|drug|fluids?|kcl|potassium|insulin|warfarin|lmwh|tto)\b/i],
  ["Procedure", /\b(line|cvc|art line|drain|lp|cannula|catheter|ng|tube|trach|bronch|vascath|picc)\b/i],
  ["Communication", /\b(family|nok|relatives?|call|phone|update|gp|meeting|dnacpr|treps|respect)\b/i],
  ["Discharge", /\b(discharge|d\/c|step ?down|transfer|summary|tto)\b/i],
  ["Review", /\b(review|see|r\/v|reassess|examine|wean)\b/i],
];
export function guessCategory(text: string): Category {
  for (const [c, re] of CATEGORY_WORDS) if (re.test(text)) return c;
  return "Other";
}

export function addJob(j: { patientId: string; text: string; category?: Category; priority?: Priority; dueTime?: string; assignee?: string; followUp?: boolean; expectedBy?: string }): Job {
  const now = Date.now();
  const job: Job = {
    id: uid("j"),
    patientId: j.patientId,
    text: j.text.trim(),
    category: j.category || guessCategory(j.text),
    priority: j.priority || "Today",
    status: j.followUp ? "waiting" : "todo",
    dueTime: j.dueTime || undefined,
    assignee: j.assignee || undefined,
    followUp: !!j.followUp,
    expectedBy: j.expectedBy || undefined,
    createdAt: now,
    createdBy: me(),
    updatedAt: now,
    log: [{ at: now, by: me(), text: j.followUp ? "Added to follow-up (locked)" : "Job added", status: j.followUp ? "waiting" : "todo" }],
  };
  commit({ ...data, jobs: [...data.jobs, job] });
  return job;
}

function patchJob(id: string, fn: (j: Job) => Job) {
  commit({ ...data, jobs: data.jobs.map((j) => (j.id === id ? fn(j) : j)) });
}

/** Change status, with an optional progress note. Locked follow-ups can't be marked done here. */
export function setStatus(id: string, status: Status, note?: string) {
  const now = Date.now();
  patchJob(id, (j) => {
    if (j.followUp && status === "done") return j;
    return {
      ...j,
      status,
      updatedAt: now,
      doneAt: status === "done" ? now : undefined,
      doneBy: status === "done" ? me() : undefined,
      log: [...j.log, { at: now, by: me(), text: note?.trim() || `Marked ${STATUS_LABEL[status].toLowerCase()}`, status }],
    };
  });
}

export function addNote(id: string, text: string) {
  if (!text.trim()) return;
  const now = Date.now();
  patchJob(id, (j) => ({ ...j, updatedAt: now, log: [...j.log, { at: now, by: me(), text: text.trim() }] }));
}

export function editJob(id: string, patch: Partial<Pick<Job, "text" | "category" | "priority" | "dueTime" | "assignee" | "expectedBy">>) {
  const now = Date.now();
  patchJob(id, (j) => ({ ...j, ...patch, updatedAt: now }));
}

export function lockAsFollowUp(id: string, expectedBy?: string) {
  const now = Date.now();
  patchJob(id, (j) => ({ ...j, followUp: true, expectedBy: expectedBy || j.expectedBy, status: j.status === "done" ? "waiting" : j.status === "todo" ? "waiting" : j.status, updatedAt: now, log: [...j.log, { at: now, by: me(), text: `Moved to follow-up (locked)${expectedBy ? `, expected ${expectedBy}` : ""}`, status: "waiting" }] }));
}

/** Unlock a follow-up and close it with the outcome (e.g. "Result negative, team informed"). */
export function closeFollowUp(id: string, outcome: string) {
  const now = Date.now();
  patchJob(id, (j) => ({ ...j, followUp: false, outcome: outcome.trim(), status: "done", doneAt: now, doneBy: me(), updatedAt: now, log: [...j.log, { at: now, by: me(), text: `Follow-up closed: ${outcome.trim()}`, status: "done" }] }));
}

export function deleteJob(id: string): boolean {
  const j = data.jobs.find((x) => x.id === id);
  if (!j || (j.followUp && j.status !== "done")) return false;
  commit({ ...data, jobs: data.jobs.filter((x) => x.id !== id) });
  return true;
}

// ---------- housekeeping ----------
/** Remove finished jobs and discharged patients after the set number of hours. Follow-ups are never touched. */
export function housekeeping(): { jobs: number; patients: number } {
  const now = Date.now();
  const s = data.settings;
  const jobs = data.jobs.filter((j) => !(j.status === "done" && !j.followUp && j.doneAt && now - j.doneAt > s.clearDoneAfterHours * 3600e3));
  const openFollow = new Set(jobs.filter((j) => j.followUp && j.status !== "done").map((j) => j.patientId));
  const patients = data.patients.filter((p) => !(p.discharged && now - p.discharged > s.removeDischargedAfterHours * 3600e3 && !openFollow.has(p.id)));
  const keepIds = new Set(patients.map((p) => p.id));
  const jobs2 = jobs.filter((j) => keepIds.has(j.patientId));
  const removed = { jobs: data.jobs.length - jobs2.length, patients: data.patients.length - patients.length };
  if (removed.jobs || removed.patients) commit({ ...data, patients, jobs: jobs2 });
  return removed;
}

export function clearCompletedNow() {
  commit({ ...data, jobs: data.jobs.filter((j) => j.status !== "done" || j.followUp) });
}

export function wipeEverything() {
  commit({ patients: [], jobs: [], settings: data.settings });
}

// ---------- sharing between phones ----------
export interface ExportFile { app: "ward-jobs"; version: 1; exportedAt: number; exportedBy: string; ward: string; patients: Patient[]; jobs: Job[] }

export function exportList(ward: string | "all"): ExportFile {
  const patients = data.patients.filter((p) => ward === "all" || p.ward === ward);
  const ids = new Set(patients.map((p) => p.id));
  return { app: "ward-jobs", version: 1, exportedAt: Date.now(), exportedBy: me(), ward, patients, jobs: data.jobs.filter((j) => ids.has(j.patientId)) };
}

/** Merge a list from a colleague: newest version of each patient / job wins, progress logs are combined. */
export function importList(file: ExportFile): { patients: number; jobs: number } {
  if (!file || file.app !== "ward-jobs") throw new Error("That isn't a Ward Jobs file.");
  const pById = new Map(data.patients.map((p) => [p.id, p]));
  let np = 0, nj = 0;
  for (const p of file.patients || []) {
    const cur = pById.get(p.id);
    if (!cur) np++;
    if (!cur || p.updatedAt > cur.updatedAt) pById.set(p.id, p);
  }
  const jById = new Map(data.jobs.map((j) => [j.id, j]));
  for (const j of file.jobs || []) {
    const cur = jById.get(j.id);
    if (!cur) { nj++; jById.set(j.id, j); continue; }
    const newer = j.updatedAt > cur.updatedAt ? j : cur;
    const seen = new Set<string>();
    const log = [...cur.log, ...j.log].filter((l) => { const k = `${l.at}|${l.by}|${l.text}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.at - b.at);
    jById.set(j.id, { ...newer, log });
  }
  const wards = [...new Set([...data.settings.wards, ...(file.patients || []).map((p) => p.ward)])];
  commit({ ...data, patients: [...pById.values()], jobs: [...jById.values()], settings: { ...data.settings, wards } });
  return { patients: np, jobs: nj };
}

// ---------- helpers ----------
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export function fmtStamp(t: number) {
  const d = new Date(t);
  const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const day = d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${day} ${fmtTime(t)}`;
}
export function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const bedSort = (a: Patient, b: Patient) => a.ward.localeCompare(b.ward) || a.bed.localeCompare(b.bed, undefined, { numeric: true });
export function isOverdue(j: Job): boolean {
  if (j.status === "done") return false;
  if (j.followUp) return !!j.expectedBy && j.expectedBy < todayIso();
  if (!j.dueTime) return false;
  const [h, m] = j.dueTime.split(":").map(Number);
  const due = new Date(j.createdAt); due.setHours(h, m, 0, 0);
  if (due.getTime() < j.createdAt - 3600e3) due.setDate(due.getDate() + 1); // due time earlier than creation → tomorrow
  return Date.now() > due.getTime();
}
