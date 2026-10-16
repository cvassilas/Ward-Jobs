import React, { useEffect, useRef, useState } from "react";
import { ListChecks, Lock, Users, ClipboardList, Settings as SettingsIcon } from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useData, housekeeping, isOverdue } from "./lib/store";
import { checkForUpdate, installUpdate, UpdateInfo } from "./lib/updates";
import { JobsScreen, FollowUpScreen, PatientsScreen } from "./components/Screens";
import { HandoverScreen } from "./components/Handover";
import { SettingsScreen } from "./components/Settings";

type Tab = "jobs" | "follow" | "patients" | "handover" | "settings";
const TITLES: Record<Tab, string> = { jobs: "Ward jobs", follow: "Follow-up", patients: "Patients", handover: "Handover", settings: "Settings" };
const WARD_KEY = "ward_jobs_current_ward";

export default function App() {
  const data = useData();
  const [tab, setTab] = useState<Tab>("jobs");
  const [ward, setWardState] = useState<string>(() => { try { return localStorage.getItem(WARD_KEY) || "all"; } catch { return "all"; } });
  const setWard = (w: string) => { setWardState(w); try { localStorage.setItem(WARD_KEY, w); } catch { /* */ } };
  const [locked, setLocked] = useState<boolean>(!!data.settings.pin);
  const hiddenAt = useRef<number | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  // Theme
  useEffect(() => { document.documentElement.classList.toggle("theme-light", data.settings.theme === "light"); }, [data.settings.theme]);

  // Housekeeping now and every 10 minutes
  useEffect(() => {
    housekeeping();
    const t = setInterval(housekeeping, 10 * 60e3);
    return () => clearInterval(t);
  }, []);

  // Lock with the PIN after time in the background
  useEffect(() => {
    const onHide = () => { hiddenAt.current = Date.now(); };
    const onShow = () => {
      const s = data.settings;
      if (s.pin && hiddenAt.current !== null && Date.now() - hiddenAt.current >= s.lockAfterMinutes * 60e3) setLocked(true);
      hiddenAt.current = null;
      housekeeping();
    };
    const vis = () => (document.hidden ? onHide() : onShow());
    document.addEventListener("visibilitychange", vis);
    let sub: any;
    if (Capacitor.isNativePlatform()) CapApp.addListener("appStateChange", (st) => (st.isActive ? onShow() : onHide())).then((h) => { sub = h; });
    return () => { document.removeEventListener("visibilitychange", vis); sub?.remove?.(); };
  }, [data.settings.pin, data.settings.lockAfterMinutes]);

  useEffect(() => {
    const t = setTimeout(() => { checkForUpdate(false).then(setUpdate).catch(() => {}); }, 4000);
    return () => clearTimeout(t);
  }, []);

  if (locked && data.settings.pin) return <PinLock pin={data.settings.pin} onUnlock={() => setLocked(false)} />;

  const followCount = data.jobs.filter((j) => j.followUp && j.status !== "done").length;
  const followOverdue = data.jobs.some((j) => j.followUp && j.status !== "done" && isOverdue(j));
  const openCount = data.jobs.filter((j) => !j.followUp && j.status !== "done" && !data.patients.find((p) => p.id === j.patientId)?.discharged).length;

  const tabs: Array<[Tab, string, React.ElementType, number?, boolean?]> = [
    ["jobs", "Jobs", ListChecks, openCount],
    ["follow", "Follow-up", Lock, followCount, followOverdue],
    ["patients", "Patients", Users],
    ["handover", "Handover", ClipboardList],
    ["settings", "Settings", SettingsIcon],
  ];

  return (
    <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)] font-sans">
      <main className="w-full max-w-md mx-auto px-4 pt-4 pb-28 space-y-3">
        <header className="flex items-end justify-between pt-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{TITLES[tab]}</h1>
            <p className="text-xs text-[var(--c-muted)]">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}{data.settings.myName ? ` · ${data.settings.myName}` : ""}</p>
          </div>
        </header>
        {tab === "jobs" && <JobsScreen ward={ward} setWard={setWard} />}
        {tab === "follow" && <FollowUpScreen ward={ward} setWard={setWard} />}
        {tab === "patients" && <PatientsScreen ward={ward} setWard={setWard} />}
        {tab === "handover" && <HandoverScreen ward={ward} setWard={setWard} />}
        {tab === "settings" && <SettingsScreen />}
      </main>

      {update && (
        <div className="fixed left-3 right-3 bottom-[84px] z-50 bg-[var(--c-surface2)] border border-[var(--c-accent)]/60 rounded-2xl p-3 shadow-2xl flex items-center gap-2 max-w-md mx-auto">
          <span className="flex-1 text-xs font-bold">Update {update.latest} available</span>
          <button type="button" onClick={() => installUpdate(update).catch(() => {})} className="bg-[var(--c-accent)] text-[var(--c-bg)] text-xs font-bold rounded-xl px-3 py-2">Install</button>
          <button type="button" onClick={() => setUpdate(null)} aria-label="Dismiss" className="text-[var(--c-muted)] px-1">✕</button>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[var(--c-surface)] border-t border-[var(--c-border)] z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around h-16">
          {tabs.map(([t, label, Icon, badge, alert]) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 ${tab === t ? "text-[var(--c-teal)]" : "text-[var(--c-muted)]"}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10.5px] font-semibold">{label}</span>
              {!!badge && (
                <span className={`absolute top-1.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${alert ? "bg-[#E05A4F] text-white" : "bg-[var(--c-surface2)] text-[var(--c-text)] border border-[var(--c-border)]"}`}>{badge}</span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

const PinLock: React.FC<{ pin: string; onUnlock: () => void }> = ({ pin, onUnlock }) => {
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);
  const press = (d: string) => {
    const next = (entry + d).slice(0, 6);
    setWrong(false);
    setEntry(next);
    if (next.length === pin.length) {
      if (next === pin) onUnlock();
      else { setWrong(true); setTimeout(() => setEntry(""), 300); }
    }
  };
  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col items-center justify-center gap-6 px-8">
      <Lock className="w-8 h-8 text-[var(--c-teal)]" />
      <p className="text-sm font-semibold text-[var(--c-text)]">Enter PIN</p>
      <div className="flex gap-3">
        {Array.from({ length: pin.length }).map((_, i) => (
          <span key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${wrong ? "border-red-400" : "border-[var(--c-teal)]"} ${i < entry.length ? (wrong ? "bg-red-400" : "bg-[var(--c-teal)]") : ""}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
          k === "" ? <span key={i} /> : (
            <button key={i} type="button" onClick={() => (k === "⌫" ? setEntry(entry.slice(0, -1)) : press(k))}
              className="h-16 rounded-2xl bg-[var(--c-surface)] border border-[var(--c-border)] text-xl font-semibold text-[var(--c-text)] active:scale-95">{k}</button>
          )
        ))}
      </div>
    </div>
  );
};
