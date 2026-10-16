/**
 * Live team sync with end-to-end encryption.
 *
 * A team list has a random id and a random 256-bit key, shared between phones as an invite code
 * (shown as a QR code). Every patient and job is encrypted on the phone with AES-GCM before it is
 * sent; the server (Supabase, two SQL functions in supabase/setup.sql) only stores the team id,
 * record ids and ciphertext, so it can't read anything. Phones push their changes straight away
 * and pull everyone else's every few seconds while the app is open.
 *
 * Conflicts: the most recently changed version of a patient or job wins, and job progress notes
 * from every phone are combined, so nobody's update is lost.
 */
import { useEffect, useState } from "react";
import { Patient, Job, getData, applyRemote, onLocalChange } from "./store";
import { SYNC_URL, SYNC_KEY } from "../config";

const TEAM_KEY = "ward_jobs_team_v1";
const POLL_MS = 4000;

export interface Team {
  name: string;
  spaceId: string; // sent to the server
  key: string; // base64url AES key; never leaves the phones
  lastSeq: number;
  pending: Record<string, "patient" | "job" | "tomb">; // id → what to upload
  tombs: Record<string, { type: "patient" | "job"; at: number }>;
  lastSync?: number;
  error?: string;
  joinedAt: number;
}

type Payload =
  | { t: "patient"; v: Patient }
  | { t: "job"; v: Job }
  | { t: "tomb"; type: "patient" | "job"; at: number };

// ---------- state ----------
let team: Team | null = loadTeam();
const listeners = new Set<() => void>();
function loadTeam(): Team | null {
  try { const raw = localStorage.getItem(TEAM_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveTeam(t: Team | null) {
  team = t;
  try { t ? localStorage.setItem(TEAM_KEY, JSON.stringify(t)) : localStorage.removeItem(TEAM_KEY); } catch { /* */ }
  listeners.forEach((l) => l());
}
export const getTeam = () => team;
export function useTeam(): Team | null {
  const [, f] = useState(0);
  useEffect(() => { const l = () => f((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return team;
}

// ---------- server config ----------
const CONF_KEY = "ward_jobs_sync_server_v1";
export function serverConfig(): { url: string; key: string } {
  try {
    const o = JSON.parse(localStorage.getItem(CONF_KEY) || "{}");
    if (o.url && o.key) return o;
  } catch { /* */ }
  return { url: SYNC_URL, key: SYNC_KEY };
}
export function setServerConfig(url: string, key: string) {
  try { localStorage.setItem(CONF_KEY, JSON.stringify({ url: url.trim().replace(/\/+$/, ""), key: key.trim() })); } catch { /* */ }
  listeners.forEach((l) => l());
}
export const syncConfigured = () => { const c = serverConfig(); return !!(c.url && c.key); };

async function rpc<T>(fn: string, body: any): Promise<T> {
  const { url, key } = serverConfig();
  if (!url || !key) throw new Error("Sync server not set up yet");
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: key };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Sync server error ${r.status}${txt ? `: ${txt.slice(0, 120)}` : ""}`);
  }
  return r.json();
}

// ---------- crypto ----------
const b64u = {
  enc(bytes: Uint8Array) { let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec(str: string) { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); },
};
let keyCache: { raw: string; key: CryptoKey } | null = null;
async function cryptoKey(raw: string): Promise<CryptoKey> {
  if (keyCache?.raw === raw) return keyCache.key;
  const key = await crypto.subtle.importKey("raw", b64u.dec(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
  keyCache = { raw, key };
  return key;
}
async function encrypt(raw: string, id: string, payload: Payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // The record id is bound in as associated data, so a record can't be swapped for another.
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(id) }, await cryptoKey(raw), new TextEncoder().encode(JSON.stringify(payload)));
  return { id, iv: b64u.enc(iv), data: b64u.enc(new Uint8Array(ct)) };
}
async function decrypt(raw: string, row: { id: string; iv: string; data: string }): Promise<Payload | null> {
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64u.dec(row.iv), additionalData: new TextEncoder().encode(row.id) }, await cryptoKey(raw), b64u.dec(row.data));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null; // wrong key or tampered: ignore
  }
}

// ---------- invite codes ----------
const PREFIX = "WJ1";
export function inviteCode(t: Team): string {
  const name = b64u.enc(new TextEncoder().encode(t.name.slice(0, 40)));
  return `${PREFIX}.${t.spaceId}.${t.key}.${name}`;
}
export function parseInvite(text: string): { spaceId: string; key: string; name: string } {
  const m = /WJ1\.([A-Za-z0-9_-]{20,})\.([A-Za-z0-9_-]{40,})\.?([A-Za-z0-9_-]*)/.exec(text.trim());
  if (!m) throw new Error("That isn't a Ward Jobs team code.");
  let name = "Team list";
  try { if (m[3]) name = new TextDecoder().decode(b64u.dec(m[3])); } catch { /* */ }
  return { spaceId: m[1], key: m[2], name };
}

// ---------- team lifecycle ----------
function markEverythingPending(t: Team): Team {
  const d = getData();
  const pending = { ...t.pending };
  d.patients.forEach((p) => (pending[p.id] = "patient"));
  d.jobs.forEach((j) => (pending[j.id] = "job"));
  return { ...t, pending };
}

export async function createTeam(name: string): Promise<Team> {
  const t: Team = {
    name: name.trim() || "Ward team",
    spaceId: b64u.enc(crypto.getRandomValues(new Uint8Array(18))),
    key: b64u.enc(crypto.getRandomValues(new Uint8Array(32))),
    lastSeq: 0, pending: {}, tombs: {}, joinedAt: Date.now(),
  };
  saveTeam(markEverythingPending(t));
  syncNow();
  return team!;
}

export async function joinTeam(code: string): Promise<Team> {
  const { spaceId, key, name } = parseInvite(code);
  await cryptoKey(key); // validates the key
  saveTeam(markEverythingPending({ name, spaceId, key, lastSeq: 0, pending: {}, tombs: {}, joinedAt: Date.now() }));
  await syncNow();
  return team!;
}

export function leaveTeam() { saveTeam(null); }

// ---------- local changes → pending ----------
// A change counter per record, so an upload only clears what hasn't changed again while it was in flight.
let ver = 0;
const touched = new Map<string, number>();
const touch = (id: string) => touched.set(id, ++ver);

onLocalChange((changed, removed) => {
  if (!team) return;
  const d = getData();
  const pending = { ...team.pending };
  const tombs = { ...team.tombs };
  for (const id of changed) {
    touch(id);
    pending[id] = d.patients.some((p) => p.id === id) ? "patient" : "job";
    delete tombs[id];
  }
  for (const r of removed) { touch(r.id); pending[r.id] = "tomb"; tombs[r.id] = { type: r.type, at: Date.now() }; }
  saveTeam({ ...team, pending, tombs });
  schedulePush();
});

let pushTimer: any = null;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { syncNow().catch(() => {}); }, 400);
}

// ---------- merge ----------
function mergeLogs(a: Job["log"], b: Job["log"]) {
  const seen = new Set<string>();
  return [...a, ...b]
    .filter((l) => { const k = `${l.at}|${l.by}|${l.text}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => x.at - y.at);
}

// ---------- sync loop ----------
let running: Promise<void> | null = null;
export function syncNow(): Promise<void> {
  if (!team || !syncConfigured()) return Promise.resolve();
  if (running) return running.then(() => (team && Object.keys(team.pending).length ? syncNow() : undefined));
  running = (async () => {
    try {
      await push();
      await pull();
      if (team) saveTeam({ ...team, lastSync: Date.now(), error: undefined });
    } catch (e: any) {
      if (team) saveTeam({ ...team, error: navigator.onLine === false ? "Offline – changes will sync when you're back online" : e?.message || "Sync failed" });
    } finally {
      running = null;
    }
  })();
  return running;
}

async function push() {
  const t = team!;
  const ids = Object.keys(t.pending);
  if (!ids.length) return;
  const startVer = ver;
  const d = getData();
  const rows: any[] = [];
  for (const id of ids.slice(0, 400)) {
    const kind = t.pending[id];
    let payload: Payload | null = null;
    if (kind === "patient") { const p = d.patients.find((x) => x.id === id); if (p) payload = { t: "patient", v: p }; }
    else if (kind === "job") { const j = d.jobs.find((x) => x.id === id); if (j) payload = { t: "job", v: j }; }
    if (!payload) { const tomb = t.tombs[id] || { type: "job" as const, at: Date.now() }; payload = { t: "tomb", type: tomb.type, at: tomb.at }; }
    rows.push(await encrypt(t.key, id, payload));
  }
  await rpc("ward_push", { p_space: t.spaceId, p_rows: rows });
  const sent = new Set(rows.map((r) => r.id));
  // Only clear what we sent and hasn't changed again since
  const cur = team!;
  const pending = { ...cur.pending };
  for (const id of sent) if ((touched.get(id) || 0) <= startVer && cur.pending[id] === t.pending[id]) delete pending[id];
  saveTeam({ ...cur, pending });
}

async function pull() {
  for (let page = 0; page < 20; page++) {
    const t0 = team!;
    const rows = await rpc<Array<{ id: string; seq: number; iv: string; data: string }>>("ward_pull", { p_space: t0.spaceId, p_since: t0.lastSeq });
    if (!rows.length) break;
    // Decrypt first (async), then merge in one synchronous step so no local tap is lost meanwhile.
    const msgs: Array<{ id: string; msg: Payload | null }> = [];
    for (const row of rows) msgs.push({ id: row.id, msg: await decrypt(t0.key, row) });
    const maxSeq = Math.max(t0.lastSeq, ...rows.map((r) => Number(r.seq)));

    const t = team!;
    const d = getData();
    const patients = new Map(d.patients.map((p) => [p.id, p]));
    const jobs = new Map(d.jobs.map((j) => [j.id, j]));
    const pending = { ...t.pending };
    const tombs = { ...t.tombs };
    const resurrect = (id: string, at: number) => {
      if (tombs[id] && tombs[id].at < at) { delete tombs[id]; if (pending[id] === "tomb") delete pending[id]; }
    };
    for (const { id, msg } of msgs) {
      if (!msg) continue;
      if (msg.t === "tomb") {
        const local = msg.type === "patient" ? patients.get(id) : jobs.get(id);
        if (local && local.updatedAt > msg.at) { pending[id] = msg.type; touch(id); continue; } // edited after the delete: keep it
        if (msg.type === "patient") patients.delete(id); else jobs.delete(id);
        if (pending[id] !== "tomb") delete pending[id];
        tombs[id] = { type: msg.type, at: msg.at };
      } else if (msg.t === "patient") {
        if (tombs[id] && tombs[id].at >= msg.v.updatedAt) continue;
        resurrect(id, msg.v.updatedAt);
        const local = patients.get(id);
        if (!local || msg.v.updatedAt >= local.updatedAt) {
          patients.set(id, msg.v);
          if (pending[id] === "patient") delete pending[id];
        } else { pending[id] = "patient"; touch(id); }
      } else if (msg.t === "job") {
        if (tombs[id] && tombs[id].at >= msg.v.updatedAt) continue;
        resurrect(id, msg.v.updatedAt);
        const local = jobs.get(id);
        if (!local) { jobs.set(id, msg.v); if (pending[id] === "job") delete pending[id]; continue; }
        const newer = msg.v.updatedAt >= local.updatedAt ? msg.v : local;
        const log = mergeLogs(local.log, msg.v.log);
        jobs.set(id, { ...newer, log });
        if (newer === local || log.length !== msg.v.log.length) { pending[id] = "job"; touch(id); } // server is missing some of ours
        else if (pending[id] === "job") delete pending[id];
      }
    }
    applyRemote([...patients.values()], [...jobs.values()]);
    saveTeam({ ...team!, lastSeq: maxSeq, pending, tombs });
    if (rows.length < 500) break;
  }
  if (team && Object.keys(team.pending).length) await push();
}

// Poll while the app is open and visible
let pollTimer: any = null;
let loopStarted = false;
export function startSyncLoop() {
  if (loopStarted) return;
  loopStarted = true;
  const tick = () => {
    clearTimeout(pollTimer);
    if (!document.hidden && team) syncNow().catch(() => {});
    pollTimer = setTimeout(tick, POLL_MS);
  };
  tick();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  window.addEventListener("online", () => tick());
}

