import React, { useEffect, useState } from "react";
import { Moon, Sun, Check, X, ShieldCheck } from "lucide-react";
import { useData, updateSettings, clearCompletedNow, wipeEverything } from "../lib/store";
import { appVersion, checkForUpdate, installUpdate, updatesEnabled, UpdateInfo } from "../lib/updates";
import { card, inputCls, labelCls } from "./ui";
import { TeamSyncSection } from "./TeamSync";

export const SettingsScreen: React.FC = () => {
  const { settings, patients, jobs } = useData();
  const [newWard, setNewWard] = useState("");
  const [pin, setPin] = useState("");
  const [wipe, setWipe] = useState(false);
  const [version, setVersion] = useState("");
  const [upd, setUpd] = useState<UpdateInfo | null>(null);
  const [updMsg, setUpdMsg] = useState<string | null>(null);
  useEffect(() => { appVersion().then(setVersion); }, []);

  const section = (title: string, children: React.ReactNode) => (
    <div className={`${card} p-4 space-y-3`}>
      <h2 className="text-xs font-bold text-[var(--c-text)] uppercase tracking-wider border-b border-[var(--c-border)] pb-2">{title}</h2>
      {children}
    </div>
  );

  return (
    <div className="space-y-3">
      {section("You", (
        <div>
          <label className={labelCls}>Your initials or role (shown on jobs you add or complete)</label>
          <input aria-label="My initials" defaultValue={settings.myName} placeholder="e.g. CV or ICU reg" onBlur={(e) => updateSettings({ myName: e.target.value.trim() })} className={inputCls} />
        </div>
      ))}

      <TeamSyncSection />

      {section("Appearance", (
        <div className="grid grid-cols-2 gap-2">
          {([["dark", "Dark", Moon], ["light", "Light", Sun]] as const).map(([v, l, Icon]) => (
            <button key={v} type="button" onClick={() => updateSettings({ theme: v })}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold ${settings.theme === v ? "border-[var(--c-teal)] bg-[var(--c-teal)]/15 text-[var(--c-teal)]" : "border-[var(--c-border)] text-[var(--c-muted)]"}`}>
              <Icon className="w-4 h-4" /> {l} {settings.theme === v && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      ))}

      {section("Wards", (
        <>
          <div className="flex flex-wrap gap-1.5">
            {settings.wards.map((w) => {
              const used = patients.some((p) => p.ward === w);
              return (
                <span key={w} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-[var(--c-bg)] border border-[var(--c-border)] text-xs text-[var(--c-text)]">
                  {w}
                  {!used && settings.wards.length > 1 && <button type="button" aria-label={`Remove ${w}`} onClick={() => updateSettings({ wards: settings.wards.filter((x) => x !== w) })} className="p-0.5 text-[var(--c-muted)]"><X className="w-3.5 h-3.5" /></button>}
                </span>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input value={newWard} onChange={(e) => setNewWard(e.target.value)} placeholder="Add a ward, e.g. HDU, Ward 4" className={inputCls} />
            <button type="button" disabled={!newWard.trim()} onClick={() => { if (!settings.wards.includes(newWard.trim())) updateSettings({ wards: [...settings.wards, newWard.trim()] }); setNewWard(""); }} className="px-4 rounded-xl bg-[var(--c-teal)] text-white text-xs font-bold disabled:opacity-40">Add</button>
          </div>
        </>
      ))}

      {section("Privacy and clean-up", (
        <>
          <div className="flex gap-2 text-[11px] text-[var(--c-muted)] leading-snug">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[var(--c-teal)]" />
            <span>Without team sync, the list stays only on this phone. With team sync, it's encrypted on the phone before it's sent, and the server can't read it. Use bed and initials only.</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Clear done jobs after</label>
              <select aria-label="Clear done jobs after" value={settings.clearDoneAfterHours} onChange={(e) => updateSettings({ clearDoneAfterHours: Number(e.target.value) })} className={inputCls}>
                {[12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} hours</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Remove discharged after</label>
              <select aria-label="Remove discharged after" value={settings.removeDischargedAfterHours} onChange={(e) => updateSettings({ removeDischargedAfterHours: Number(e.target.value) })} className={inputCls}>
                {[12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} hours</option>)}
              </select>
            </div>
          </div>
          <p className="text-[10.5px] text-[var(--c-muted)]">Locked follow-ups are never cleared automatically, and nor are patients who still have one.</p>
          <div>
            <label className={labelCls}>App PIN {settings.pin ? "(on)" : "(off)"}</label>
            <div className="flex gap-2">
              <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder={settings.pin ? "New PIN" : "4–6 digits"} className={inputCls} />
              <button type="button" disabled={pin.length < 4} onClick={() => { updateSettings({ pin }); setPin(""); }} className="px-4 rounded-xl bg-[var(--c-teal)] text-white text-xs font-bold disabled:opacity-40">Set</button>
              {settings.pin && <button type="button" onClick={() => updateSettings({ pin: undefined })} className="px-3 rounded-xl border border-[var(--c-border)] text-[var(--c-muted)] text-xs font-bold">Remove</button>}
            </div>
          </div>
          {settings.pin && (
            <div>
              <label className={labelCls}>Lock after the app has been in the background for</label>
              <select aria-label="Lock after" value={settings.lockAfterMinutes} onChange={(e) => updateSettings({ lockAfterMinutes: Number(e.target.value) })} className={inputCls}>
                {[0, 1, 2, 5, 15].map((m) => <option key={m} value={m}>{m === 0 ? "Immediately" : `${m} min`}</option>)}
              </select>
            </div>
          )}
          <button type="button" onClick={clearCompletedNow} className="w-full py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] text-xs font-bold">Clear all done jobs now</button>
          {wipe ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => { wipeEverything(); setWipe(false); }} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold">Delete all {patients.length} patients and {jobs.length} jobs</button>
              <button type="button" onClick={() => setWipe(false)} className="px-4 rounded-xl border border-[var(--c-border)] text-[var(--c-muted)] text-xs">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setWipe(true)} className="w-full py-2.5 rounded-xl text-red-400 text-xs font-bold">Delete everything on this phone</button>
          )}
        </>
      ))}

      {section("Updates", (
        updatesEnabled() ? (
          <>
            <div className="flex justify-between text-xs"><span className="text-[var(--c-muted)]">Installed version</span><span className="font-semibold text-[var(--c-text)]">{version || "–"}</span></div>
            {upd ? (
              <button type="button" onClick={() => installUpdate(upd).catch((e) => setUpdMsg(e?.message))} className="w-full py-2.5 rounded-xl bg-[var(--c-accent)] text-[var(--c-bg)] text-xs font-bold">Install {upd.latest}</button>
            ) : (
              <button type="button" onClick={async () => { setUpdMsg(null); try { const u = await checkForUpdate(true); setUpd(u); if (!u) setUpdMsg("You're on the latest version."); } catch (e: any) { setUpdMsg(e?.message || "Couldn't check."); } }} className="w-full py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] text-xs font-bold">Check for updates</button>
            )}
            {updMsg && <p className="text-[11px] text-[var(--c-muted)]">{updMsg}</p>}
          </>
        ) : <p className="text-[11px] text-[var(--c-muted)]">Off in this build. Add the APP_GH_TOKEN secret to the Ward-Jobs repo and rebuild.</p>
      ))}
    </div>
  );
};
