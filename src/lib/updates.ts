/**
 * Update checks (GitHub Releases) for the Android app. There is deliberately no cloud backup:
 * the jobs list holds patient information and stays on the phone.
 * The token comes from the APP_GH_TOKEN secret at build time (VITE_GH_TOKEN).
 */
import { registerPlugin, Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

interface AppUpdaterPlugin {
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(opts: { url: string; token: string }): Promise<void>;
}
const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

const env = (import.meta as any).env || {};
const TOKEN: string = env.VITE_GH_TOKEN || "";
const REPO = "cvassilas/Ward-Jobs";
const API = "https://api.github.com";
const STATE_KEY = "ward_jobs_update_v1";

export const updatesEnabled = () => !!TOKEN;
const headers = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${TOKEN}`, ...extra });

export interface CloudState { lastBackup?: string; lastSig?: string; lastUpdateCheck?: string; restoreChecked?: boolean }
export function loadCloudState(): CloudState {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch { return {}; }
}
function saveCloudState(s: CloudState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ---------- Updates ----------
export interface UpdateInfo { latest: string; current: string; assetUrl: string; notes: string }

const versionNumber = (v: string) => {
  const p = String(v || "").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  while (p.length < 3) p.push(0);
  return p[0] * 1e8 + p[1] * 1e5 + p[2];
};

export async function appVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return "";
  try { return (await App.getInfo()).version; } catch { return ""; }
}

/** Returns update info when a newer release exists, otherwise null. */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  if (!TOKEN || !Capacitor.isNativePlatform()) return null;
  const st = loadCloudState();
  if (!force && st.lastUpdateCheck && Date.now() - Date.parse(st.lastUpdateCheck) < 6 * 3600e3) return null;
  const r = await fetch(`${API}/repos/${REPO}/releases/latest`, { headers: headers({ Accept: "application/vnd.github+json" }) });
  if (!r.ok) throw new Error(`GitHub said ${r.status}`);
  const j = await r.json();
  saveCloudState({ ...loadCloudState(), lastUpdateCheck: new Date().toISOString() });
  const asset = (j.assets || []).find((a: any) => /\.apk$/i.test(a.name));
  const current = await appVersion();
  const latest = String(j.tag_name || "").replace(/^v/, "");
  if (!asset || versionNumber(latest) <= versionNumber(current)) return null;
  return { latest, current, assetUrl: asset.url, notes: j.body || "" };
}

export async function installUpdate(info: UpdateInfo): Promise<void> {
  const perm = await AppUpdater.canInstall();
  if (!perm.allowed) {
    await AppUpdater.openInstallSettings();
    throw new Error('Allow "Install unknown apps" for Ward Jobs, then tap Install again.');
  }
  await AppUpdater.downloadAndInstall({ url: info.assetUrl, token: TOKEN });
}

