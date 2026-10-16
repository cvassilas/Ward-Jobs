/**
 * Notifications.
 *  - Alerts for changes colleagues make (urgent job added, job assigned to you, job completed,
 *    follow-up added or closed), raised when this phone receives the change.
 *  - Reminders for due times and follow-up expected dates. In the Android app these are scheduled
 *    with the phone, so they arrive even when the app is closed.
 *  - Web push (iPhone home-screen app, Chrome): a generic "your team list has been updated" alert
 *    sent by the sync server when the app is closed. The server can't read the list, so it can't
 *    say more, and no patient details appear on a locked screen.
 * Notification text never includes initials; the "details" setting controls bed + job text.
 */
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getData, Job, Patient, NotifyPrefs, DEFAULT_NOTIFY, useData } from "./store";
import { VAPID_PUBLIC_KEY } from "../config";

const native = () => Capacitor.isNativePlatform();
export const prefs = (): NotifyPrefs => ({ ...DEFAULT_NOTIFY, ...(getData().settings.notify || {}) });

// ---------- in-app toasts ----------
export interface Toast { id: number; title: string; body: string }
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
function pushToast(title: string, body: string) {
  const t = { id: Date.now() + Math.random(), title, body };
  toasts = [...toasts.slice(-2), t];
  toastListeners.forEach((l) => l());
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); toastListeners.forEach((l) => l()); }, 6000);
}
export function useToasts(): [Toast[], (id: number) => void] {
  const [, f] = useState(0);
  useEffect(() => { const l = () => f((n) => n + 1); toastListeners.add(l); return () => { toastListeners.delete(l); }; }, []);
  return [toasts, (id) => { toasts = toasts.filter((x) => x.id !== id); toastListeners.forEach((l) => l()); }];
}

// ---------- permission ----------
export async function permissionState(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
  if (native()) {
    try { const p = await LocalNotifications.checkPermissions(); return p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "prompt"; } catch { return "unsupported"; }
  }
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission === "default" ? "prompt" : (Notification.permission as any);
}
export async function requestPermission(): Promise<boolean> {
  if (native()) {
    try { return (await LocalNotifications.requestPermissions()).display === "granted"; } catch { return false; }
  }
  if (!("Notification" in window)) return false;
  return (await Notification.requestPermission()) === "granted";
}

// ---------- quiet hours ----------
function inQuietHours(p: NotifyPrefs): boolean {
  if (!p.quiet) return false;
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = p.quietFrom.split(":").map(Number);
  const [th, tm] = p.quietTo.split(":").map(Number);
  const from = fh * 60 + fm, to = th * 60 + tm;
  return from <= to ? m >= from && m < to : m >= from || m < to;
}

// ---------- show ----------
let nativeId = 1000;
async function show(title: string, body: string, opts: { urgent?: boolean; force?: boolean } = {}) {
  const p = prefs();
  if (!opts.force && inQuietHours(p) && !opts.urgent) return;
  if (!document.hidden) { pushToast(title, body); return; }
  try {
    if (native()) {
      await LocalNotifications.schedule({ notifications: [{ id: nativeId++ % 2_000_000_000, title, body, smallIcon: "ic_stat_notify", channelId: opts.urgent ? "urgent" : "updates" }] });
    } else if ("Notification" in window && Notification.permission === "granted") {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, { body, tag: `wj-${Date.now()}`, icon: "./icon-192.png", badge: "./icon-192.png" } as any);
      else new Notification(title, { body });
    }
  } catch { pushToast(title, body); }
}

export async function setupChannels() {
  if (!native()) return;
  try {
    await LocalNotifications.createChannel({ id: "updates", name: "Team updates", importance: 3, visibility: 0 });
    await LocalNotifications.createChannel({ id: "urgent", name: "Urgent jobs", importance: 5, visibility: 0, vibration: true });
    await LocalNotifications.createChannel({ id: "reminders", name: "Reminders", importance: 4, visibility: 0 });
  } catch { /* older Android */ }
}

const bedLabel = (p?: Patient) => (p ? `${p.ward} bed ${p.bed}` : "A patient");
const short = (t: string) => (t.length > 60 ? `${t.slice(0, 57)}…` : t);

// ---------- events from colleagues ----------
export interface RemoteEvent { type: "new" | "done" | "assigned" | "followup-closed"; job: Job; patient?: Patient }

export function remoteEvents(events: RemoteEvent[]) {
  if (!events.length) return;
  const p = prefs();
  const me = getData().settings.myName.trim().toLowerCase();
  for (const e of events) {
    const j = e.job;
    const where = p.details ? `${bedLabel(e.patient)}: ${short(j.text)}` : "Open Ward Jobs to see it";
    if (e.type === "assigned" && p.assigned && me) show(`Job for you${j.priority === "Urgent" ? " (urgent)" : ""}`, where, { urgent: j.priority === "Urgent" });
    else if (e.type === "new" && j.followUp && p.followups) show(`Follow-up added by ${j.createdBy}`, where);
    else if (e.type === "new" && j.priority === "Urgent" && p.urgent) show(`Urgent job added by ${j.createdBy}`, where, { urgent: true });
    else if (e.type === "done" && p.completed) show(`Done by ${j.doneBy || "a colleague"}`, where);
    else if (e.type === "followup-closed" && p.followups) show(`Follow-up closed by ${j.doneBy || "a colleague"}`, p.details ? `${where} → ${short(j.outcome || "")}` : where);
  }
}

// ---------- reminders ----------
function dueDate(j: Job): Date | null {
  if (j.status === "done") return null;
  if (j.followUp) {
    if (!j.expectedBy) return null;
    const d = new Date(`${j.expectedBy}T09:00:00`);
    return d;
  }
  if (!j.dueTime) return null;
  const [h, m] = j.dueTime.split(":").map(Number);
  const d = new Date(j.createdAt); d.setHours(h, m, 0, 0);
  if (d.getTime() < j.createdAt - 3600e3) d.setDate(d.getDate() + 1);
  return d;
}
const hashId = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (Math.abs(h) % 1_000_000_000) + 1_000_000; };

/** Android app: schedule a reminder for every open job with a due time / expected date. */
let reminderTimer: any = null;
export function scheduleReminders() {
  if (!native()) return;
  clearTimeout(reminderTimer);
  reminderTimer = setTimeout(async () => {
    try {
      const p = prefs();
      const pending = await LocalNotifications.getPending();
      const ours = pending.notifications.filter((n) => (n.extra as any)?.reminder);
      if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
      if (!p.reminders) return;
      const d = getData();
      const pById = new Map(d.patients.map((x) => [x.id, x]));
      const now = Date.now();
      const list = d.jobs.map((j) => ({ j, at: dueDate(j) })).filter((x) => x.at && x.at.getTime() > now + 30e3).slice(0, 60);
      if (!list.length) return;
      await LocalNotifications.schedule({
        notifications: list.map(({ j, at }) => ({
          id: hashId(j.id),
          title: j.followUp ? "Follow-up result expected today" : `Due now${j.priority === "Urgent" ? " (urgent)" : ""}`,
          body: p.details ? `${bedLabel(pById.get(j.patientId))}: ${short(j.text)}` : "Open Ward Jobs to see it",
          schedule: { at: at!, allowWhileIdle: true },
          channelId: "reminders",
          smallIcon: "ic_stat_notify",
          extra: { reminder: true },
        })),
      });
    } catch { /* ignore */ }
  }, 800);
}

/** Web version: reminders only while the app is open, checked every minute. */
const firedKey = "ward_jobs_reminders_fired";
export function checkRemindersWhileOpen() {
  if (native()) return;
  const p = prefs();
  if (!p.reminders) return;
  let fired: Record<string, number> = {};
  try { fired = JSON.parse(localStorage.getItem(firedKey) || "{}"); } catch { /* */ }
  const d = getData();
  const pById = new Map(d.patients.map((x) => [x.id, x]));
  const now = Date.now();
  for (const j of d.jobs) {
    const at = dueDate(j);
    if (!at || fired[j.id] === at.getTime()) continue;
    if (at.getTime() <= now && now - at.getTime() < 6 * 3600e3) {
      fired[j.id] = at.getTime();
      show(j.followUp ? "Follow-up result expected" : "Job due", p.details ? `${bedLabel(pById.get(j.patientId))}: ${short(j.text)}` : "Open Ward Jobs to see it", { urgent: j.priority === "Urgent" });
    }
  }
  try { localStorage.setItem(firedKey, JSON.stringify(fired)); } catch { /* */ }
}

// ---------- web push ----------
export const webPushSupported = () => !native() && "serviceWorker" in navigator && "PushManager" in window && location.protocol === "https:";
const b64uToBytes = (s: string) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };

export async function currentPushEndpoint(): Promise<string | null> {
  if (!webPushSupported()) return null;
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); return sub?.endpoint || null; } catch { return null; }
}

/** Subscribe this phone to "team list updated" pushes for the given team. */
export async function enableWebPush(spaceId: string, rpc: (fn: string, body: any) => Promise<any>): Promise<void> {
  if (!webPushSupported()) throw new Error(/iPhone|iPad/.test(navigator.userAgent) ? "On iPhone, add Ward Jobs to your Home Screen and open it from there first." : "This browser doesn't support push notifications.");
  if (!(await requestPermission())) throw new Error("Notifications are blocked. Allow them for Ward Jobs in your phone's settings.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON() as any;
  await rpc("ward_subscribe", { p_space: spaceId, p_endpoint: sub.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
}

export async function disableWebPush(rpc: (fn: string, body: any) => Promise<any>): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await rpc("ward_unsubscribe", { p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
}

/** Keep reminders in step with the list (Android app) and check due jobs (web). */
export function useNotificationEngine() {
  const data = useData();
  useEffect(() => { setupChannels(); }, []);
  useEffect(() => { scheduleReminders(); }, [data.jobs, data.settings.notify]);
  useEffect(() => {
    checkRemindersWhileOpen();
    const t = setInterval(checkRemindersWhileOpen, 60e3);
    return () => clearInterval(t);
  }, []);
}

