import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import {
  Patient, Priority, PRIORITIES, CATEGORIES, Category, addJob, guessCategory, savePatient, useData, bedSort, todayIso,
} from "../lib/store";
import { Sheet, inputCls, labelCls, PRIORITY_COLOR, STATUS_COLOR } from "./ui";

const QUICK = ["Bloods", "VBG", "CXR", "Review", "Refer", "Update family", "Chase result", "TTO"];

/** Add one or more jobs for a patient. Type several lines to add several jobs at once. */
export const AddJobSheet: React.FC<{ patientId?: string; ward?: string; followUp?: boolean; onClose: () => void }> = ({ patientId, ward, followUp: initialFollow, onClose }) => {
  const data = useData();
  const patients = useMemo(() => data.patients.filter((p) => !p.discharged && (!ward || ward === "all" || p.ward === ward)).sort(bedSort), [data.patients, ward]);
  const [pid, setPid] = useState(patientId || patients[0]?.id || "");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("Today");
  const [category, setCategory] = useState<Category | "">("");
  const [dueTime, setDueTime] = useState("");
  const [assignee, setAssignee] = useState("");
  const [followUp, setFollowUp] = useState(!!initialFollow);
  const [expectedBy, setExpectedBy] = useState("");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const guessed = lines[0] ? guessCategory(lines[0]) : "";

  const save = () => {
    for (const l of lines) addJob({ patientId: pid, text: l, priority, category: (category || undefined) as Category | undefined, dueTime, assignee, followUp, expectedBy });
    onClose();
  };

  if (!patients.length && !patientId) {
    return (
      <Sheet onClose={onClose} title="Add job">
        <p className="text-sm text-[var(--c-muted)]">Add a patient first (Patients tab), then add their jobs.</p>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title={followUp ? "Add follow-up" : "Add job"}>
      <div>
        <label className={labelCls}>Patient</label>
        <select aria-label="Patient" value={pid} onChange={(e) => setPid(e.target.value)} className={inputCls}>
          {(patientId && !patients.some((p) => p.id === patientId) ? [...patients, data.patients.find((p) => p.id === patientId)!] : patients).map((p) => (
            <option key={p.id} value={p.id}>{p.ward} · Bed {p.bed} · {p.initials}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>{followUp ? "What are you waiting for?" : "Job (one per line to add several)"}</label>
        <textarea autoFocus aria-label="Job text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={followUp ? "e.g. Anti-GBM / ANCA – sent to reference lab" : "e.g. Repeat VBG at 2pm\nCT head – chase report"} className={`${inputCls} resize-y`} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setText((t) => (t.trim() ? `${t.replace(/\s+$/, "")}\n${q} ` : `${q} `))} className="px-2.5 py-1 rounded-full text-[11px] border border-[var(--c-border)] text-[var(--c-text2)] bg-[var(--c-bg)]">{q}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Priority</label>
        <div className="grid grid-cols-3 gap-1.5">
          {PRIORITIES.map((p) => (
            <button key={p} type="button" onClick={() => setPriority(p)} className="py-2 rounded-xl text-xs font-bold border"
              style={priority === p ? { background: PRIORITY_COLOR[p], borderColor: PRIORITY_COLOR[p], color: "#fff" } : { borderColor: "var(--c-border)", color: "var(--c-muted)" }}>{p}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Type</label>
          <select aria-label="Type" value={category} onChange={(e) => setCategory(e.target.value as any)} className={inputCls}>
            <option value="">{guessed ? `Auto (${guessed})` : "Auto"}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Who's doing it</label>
          <input aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="optional" className={inputCls} />
        </div>
        {!followUp && (
          <div>
            <label className={labelCls}>Due by</label>
            <input type="time" aria-label="Due by" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className={inputCls} />
          </div>
        )}
        {followUp && (
          <div>
            <label className={labelCls}>Expected by</label>
            <input type="date" aria-label="Expected by" min={todayIso()} value={expectedBy} onChange={(e) => setExpectedBy(e.target.value)} className={inputCls} />
          </div>
        )}
      </div>
      <button type="button" onClick={() => setFollowUp(!followUp)} className="w-full flex items-center justify-between rounded-xl border p-3 text-left"
        style={{ borderColor: followUp ? STATUS_COLOR.waiting : "var(--c-border)" }}>
        <span className="flex items-center gap-2">
          <Lock className="w-4 h-4" style={{ color: STATUS_COLOR.waiting }} />
          <span>
            <span className="block text-xs font-bold text-[var(--c-text)]">Long-term follow-up</span>
            <span className="block text-[10.5px] text-[var(--c-muted)]">Locked until you record the result. Kept after discharge.</span>
          </span>
        </span>
        <span className={`w-9 h-5 rounded-full p-0.5 shrink-0 ${followUp ? "" : "bg-[var(--c-border2)]"}`} style={followUp ? { background: STATUS_COLOR.waiting } : undefined}>
          <span className={`block w-4 h-4 rounded-full bg-white transition ${followUp ? "translate-x-4" : ""}`} />
        </span>
      </button>
      <button type="button" disabled={!lines.length || !pid} onClick={save} className="w-full py-3.5 rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)] font-bold disabled:opacity-40">
        Add {lines.length > 1 ? `${lines.length} jobs` : followUp ? "follow-up" : "job"}
      </button>
      <p className="text-[10.5px] text-[var(--c-muted)]">Don't type names, hospital numbers or dates of birth. Bed and initials only.</p>
    </Sheet>
  );
};

export const PatientSheet: React.FC<{ patient?: Patient; ward?: string; onClose: () => void; onSaved?: (p: Patient) => void }> = ({ patient, ward, onClose, onSaved }) => {
  const data = useData();
  const [w, setW] = useState(patient?.ward || (ward && ward !== "all" ? ward : data.settings.wards[0] || ""));
  const [newWard, setNewWard] = useState("");
  const [bed, setBed] = useState(patient?.bed || "");
  const [initials, setInitials] = useState(patient?.initials || "");
  const [summary, setSummary] = useState(patient?.summary || "");
  const wardValue = w === "__new" ? newWard.trim() : w;
  const clash = data.patients.find((p) => !p.discharged && p.id !== patient?.id && p.ward === wardValue && p.bed.toLowerCase() === bed.trim().toLowerCase());
  const ok = wardValue && bed.trim() && /^[A-Za-z]{1,4}$/.test(initials.trim());

  return (
    <Sheet onClose={onClose} title={patient ? "Edit patient" : "Add patient"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Ward</label>
          <select aria-label="Ward" value={w} onChange={(e) => setW(e.target.value)} className={inputCls}>
            {data.settings.wards.map((x) => <option key={x} value={x}>{x}</option>)}
            <option value="__new">+ New ward…</option>
          </select>
          {w === "__new" && <input autoFocus value={newWard} onChange={(e) => setNewWard(e.target.value)} placeholder="Ward name" className={`${inputCls} mt-2`} />}
        </div>
        <div>
          <label className={labelCls}>Bed</label>
          <input aria-label="Bed" value={bed} onChange={(e) => setBed(e.target.value)} placeholder="e.g. 4 or SR2" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Initials</label>
          <input aria-label="Initials" value={initials} maxLength={4} onChange={(e) => setInitials(e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())} placeholder="e.g. JS" className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>One-line summary (optional)</label>
          <input aria-label="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Day 3 urosepsis, weaning norad" className={inputCls} />
        </div>
      </div>
      {clash && <p className="text-xs text-amber-400">Bed {clash.bed} on {clash.ward} already has {clash.initials}. Discharge them first if the bed has changed hands.</p>}
      <button type="button" disabled={!ok} onClick={() => { const p = savePatient({ id: patient?.id, ward: wardValue, bed: bed.trim(), initials: initials.trim(), summary: summary.trim() }); onSaved?.(p); onClose(); }}
        className="w-full py-3.5 rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)] font-bold disabled:opacity-40">
        {patient ? "Save" : "Add patient"}
      </button>
      <p className="text-[10.5px] text-[var(--c-muted)]">Initials only (letters, up to 4). No names, hospital numbers or dates of birth.</p>
    </Sheet>
  );
};
