import React, { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useData, updateSettings, DEFAULT_NOTIFY, NotifyPrefs } from "../lib/store";
import { permissionState, requestPermission, webPushSupported, enableWebPush, disableWebPush, useToasts } from "../lib/notifications";
import { useTeam, rpc } from "../lib/sync";
import { card, inputCls, labelCls } from "./ui";

export const NotifySection: React.FC = () => {
  const { settings } = useData();
  const team = useTeam();
  const p: NotifyPrefs = { ...DEFAULT_NOTIFY, ...(settings.notify || {}) };
  const set = (patch: Partial<NotifyPrefs>) => updateSettings({ notify: { ...p, ...patch } });
  const [perm, setPerm] = useState<string>("prompt");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { permissionState().then(setPerm); }, []);
  const native = Capacitor.isNativePlatform();
  const iosNotInstalled = /iPhone|iPad/.test(navigator.userAgent) && !(navigator as any).standalone;

  const Toggle: React.FC<{ k: keyof NotifyPrefs; label: string; hint?: string }> = ({ k, label, hint }) => (
    <button type="button" onClick={() => set({ [k]: !p[k] } as any)} className="w-full flex items-center justify-between py-1.5 text-left">
      <span>
        <span className="block text-xs font-semibold text-[var(--c-text)]">{label}</span>
        {hint && <span className="block text-[10.5px] text-[var(--c-muted)]">{hint}</span>}
      </span>
      <span className={`w-9 h-5 rounded-full p-0.5 shrink-0 transition ${p[k] ? "bg-[var(--c-teal)]" : "bg-[var(--c-border2)]"}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition ${p[k] ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );

  return (
    <div className={`${card} p-4 space-y-3`}>
      <h2 className="text-xs font-bold text-[var(--c-text)] uppercase tracking-wider border-b border-[var(--c-border)] pb-2 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Notifications</h2>

      {perm !== "granted" && (
        <button type="button" onClick={async () => { const ok = await requestPermission(); setPerm(ok ? "granted" : "denied"); }} className="w-full py-2.5 rounded-xl bg-[var(--c-teal)] text-white text-xs font-bold flex items-center justify-center gap-1.5">
          <Bell className="w-4 h-4" /> Allow notifications
        </button>
      )}
      {perm === "denied" && <p className="text-[11px] text-amber-400">Notifications are blocked. Turn them on for Ward Jobs in your phone's settings.</p>}

      <div className="divide-y divide-[var(--c-border)]/50">
        <Toggle k="urgent" label="Urgent jobs added by colleagues" />
        <Toggle k="assigned" label="Jobs assigned to me" hint={settings.myName ? `Matches "${settings.myName}" in "Who's doing it"` : "Set your initials above first"} />
        <Toggle k="completed" label="Jobs completed by colleagues" />
        <Toggle k="followups" label="Follow-ups added or closed" />
        <Toggle k="reminders" label="Reminders when jobs are due" hint={native ? "Also when the app is closed" : "While the app is open"} />
        <Toggle k="details" label="Show bed and job in notifications" hint="Initials are never shown. Turn off for a generic alert only." />
        <Toggle k="quiet" label="Quiet hours" hint="Except urgent jobs" />
      </div>
      {p.quiet && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>From</label><input type="time" value={p.quietFrom} onChange={(e) => set({ quietFrom: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>To</label><input type="time" value={p.quietTo} onChange={(e) => set({ quietTo: e.target.value })} className={inputCls} /></div>
        </div>
      )}

      {!native && (
        <div className="rounded-xl bg-[var(--c-bg)] border border-[var(--c-border)] p-3 space-y-2">
          <p className="text-xs font-bold text-[var(--c-text)]">Alerts when the app is closed</p>
          <p className="text-[10.5px] text-[var(--c-muted)] leading-snug">The sync server sends "Your team list has been updated". It can't read the list, so the alert has no patient details. Open the app to see what changed.</p>
          {iosNotInstalled ? (
            <p className="text-[11px] text-amber-400">On iPhone, first add Ward Jobs to your Home Screen (Share → Add to Home Screen) and open it from there.</p>
          ) : !team ? (
            <p className="text-[11px] text-[var(--c-muted)]">Join or start a team list first (Team sync, above).</p>
          ) : p.push ? (
            <button type="button" disabled={busy} onClick={async () => { setBusy(true); await disableWebPush(rpc); set({ push: false }); setBusy(false); }} className="w-full py-2 rounded-xl border border-[var(--c-border)] text-[var(--c-muted)] text-xs font-bold flex items-center justify-center gap-1.5"><BellOff className="w-4 h-4" /> Turn off</button>
          ) : (
            <button type="button" disabled={busy || !webPushSupported()} onClick={async () => {
              setBusy(true); setMsg(null);
              try { await enableWebPush(team.spaceId, rpc); set({ push: true }); setPerm("granted"); setMsg("On. You'll get an alert when colleagues update the list."); }
              catch (e: any) { setMsg(e?.message || "Couldn't turn on alerts."); }
              finally { setBusy(false); }
            }} className="w-full py-2 rounded-xl bg-[var(--c-accent)] text-[var(--c-bg)] text-xs font-bold disabled:opacity-40">{busy ? "Turning on…" : "Turn on"}</button>
          )}
          {msg && <p className="text-[11px] text-[var(--c-teal)]">{msg}</p>}
        </div>
      )}
    </div>
  );
};

/** In-app alert banners (when the app is open). */
export const Toasts: React.FC = () => {
  const [list, dismiss] = useToasts();
  if (!list.length) return null;
  return (
    <div className="fixed top-3 left-3 right-3 z-[80] max-w-md mx-auto space-y-2 pointer-events-none">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto bg-[var(--c-surface2)] border border-[var(--c-teal)]/60 rounded-2xl p-3 shadow-2xl flex gap-2 items-start animate-fadeIn">
          <Bell className="w-4 h-4 text-[var(--c-teal)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[var(--c-text)]">{t.title}</p>
            <p className="text-[11.5px] text-[var(--c-text2)]">{t.body}</p>
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-[var(--c-muted)]"><X className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
  );
};
