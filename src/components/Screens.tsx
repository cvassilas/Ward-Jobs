import React, { useMemo, useState } from "react";
import { Plus, Lock, UserPlus, LogOut, Undo2, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useData, bedSort, Job, Patient, dischargePatient, deletePatient, isOverdue, fmtStamp } from "../lib/store";
import { JobRow } from "./JobRow";
import { JobSheet } from "./JobSheet";
import { AddJobSheet, PatientSheet } from "./Forms";
import { card, ProgressBar, PatientLabel, jobProgress, STATUS_COLOR, PRIORITY_COLOR } from "./ui";

const PRIORITY_ORDER = { Urgent: 0, Today: 1, Routine: 2 } as const;
const STATUS_ORDER = { doing: 0, todo: 1, waiting: 2, done: 3 } as const;
const jobSort = (a: Job, b: Job) =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt - b.createdAt;

export const WardPicker: React.FC<{ ward: string; setWard: (w: string) => void }> = ({ ward, setWard }) => {
  const { settings } = useData();
  if (settings.wards.length < 2) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {["all", ...settings.wards].map((w) => (
        <button key={w} type="button" onClick={() => setWard(w)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${ward === w ? "bg-[var(--c-teal)] border-[var(--c-teal)] text-white" : "border-[var(--c-border)] text-[var(--c-muted)] bg-[var(--c-surface)]"}`}>
          {w === "all" ? "All wards" : w}
        </button>
      ))}
    </div>
  );
};

// ---------------- Jobs ----------------
export const JobsScreen: React.FC<{ ward: string; setWard: (w: string) => void }> = ({ ward, setWard }) => {
  const data = useData();
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null | "any">(null);
  const [showDone, setShowDone] = useState(true);
  const [mine, setMine] = useState(false);
  const [view, setView] = useState<"bed" | "priority">("bed");
  const [addPatient, setAddPatient] = useState(false);

  const patients = useMemo(() => data.patients.filter((p) => !p.discharged && (ward === "all" || p.ward === ward)).sort(bedSort), [data.patients, ward]);
  const pIds = new Set(patients.map((p) => p.id));
  const myName = data.settings.myName.trim().toLowerCase();
  const visible = (j: Job) => pIds.has(j.patientId) && (showDone || j.status !== "done") && (!mine || (j.assignee || "").toLowerCase() === myName);
  const allJobs = data.jobs.filter((j) => pIds.has(j.patientId));
  const prog = jobProgress(allJobs);
  const urgent = allJobs.filter((j) => j.status !== "done" && (j.priority === "Urgent" || isOverdue(j)) && !j.followUp).length;

  return (
    <div className="space-y-3">
      <WardPicker ward={ward} setWard={setWard} />
      <div className={`${card} p-3.5 space-y-2`}>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-[var(--c-text)]">{prog.done} of {prog.total} jobs done</span>
          <span className="text-[11px] text-[var(--c-muted)]">{patients.length} patient{patients.length === 1 ? "" : "s"}{urgent ? <> · <strong style={{ color: PRIORITY_COLOR.Urgent }}>{urgent} urgent/overdue</strong></> : null}</span>
        </div>
        <ProgressBar done={prog.done} total={prog.total} />
        <div className="flex gap-1.5 pt-1">
          {[
            ["By bed", view === "bed", () => setView("bed")],
            ["By priority", view === "priority", () => setView("priority")],
            [showDone ? "Hide done" : "Show done", !showDone, () => setShowDone(!showDone)],
            ...(myName ? [["Mine", mine, () => setMine(!mine)] as const] : []),
          ].map(([l, on, fn]: any) => (
            <button key={l} type="button" onClick={fn} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${on ? "border-[var(--c-teal)] text-[var(--c-teal)] bg-[var(--c-teal)]/10" : "border-[var(--c-border)] text-[var(--c-muted)]"}`}>{l}</button>
          ))}
        </div>
      </div>

      {!patients.length && (
        <div className={`${card} p-6 text-center space-y-3`}>
          <p className="text-sm text-[var(--c-text)] font-semibold">No patients on {ward === "all" ? "your list" : ward} yet</p>
          <button type="button" onClick={() => setAddPatient(true)} className="px-4 py-2.5 rounded-xl bg-[var(--c-accent)] text-[var(--c-bg)] text-sm font-bold inline-flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Add patient</button>
        </div>
      )}

      {view === "bed" ? patients.map((p) => {
        const jobs = data.jobs.filter((j) => j.patientId === p.id && visible(j)).sort(jobSort);
        const pr = jobProgress(data.jobs.filter((j) => j.patientId === p.id));
        return (
          <div key={p.id} className={`${card} px-3.5 pt-3 pb-1`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm"><PatientLabel p={p} showWard={ward === "all"} /></p>
                {p.summary && <p className="text-[11px] text-[var(--c-muted)] truncate">{p.summary}</p>}
              </div>
              <button type="button" aria-label={`Add job for bed ${p.bed}`} onClick={() => setAddFor(p.id)} className="shrink-0 w-8 h-8 rounded-full bg-[var(--c-teal)]/15 text-[var(--c-teal)] flex items-center justify-center"><Plus className="w-4 h-4" /></button>
            </div>
            {pr.total > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <ProgressBar thin done={pr.done} total={pr.total} />
                <span className="text-[10.5px] text-[var(--c-muted)] shrink-0 tabular-nums">{pr.done}/{pr.total}</span>
              </div>
            )}
            <div className="divide-y divide-[var(--c-border)]/60">
              {jobs.map((j) => <JobRow key={j.id} job={j} onOpen={() => setOpenJob(j.id)} />)}
              {!jobs.length && <p className="text-xs text-[var(--c-muted)] py-2.5">{pr.total ? "All done ✓" : "No jobs"}</p>}
            </div>
          </div>
        );
      }) : (
        (["Urgent", "Today", "Routine"] as const).map((pri) => {
          const jobs = allJobs.filter((j) => j.priority === pri && visible(j) && !j.followUp).sort(jobSort);
          if (!jobs.length) return null;
          return (
            <div key={pri} className={`${card} px-3.5 pt-3 pb-1`}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIORITY_COLOR[pri] }}>{pri} · {jobs.filter((j) => j.status !== "done").length} open</p>
              <div className="divide-y divide-[var(--c-border)]/60">
                {jobs.map((j) => <JobRow key={j.id} job={j} onOpen={() => setOpenJob(j.id)} showPatient={<PatientLabel p={data.patients.find((p) => p.id === j.patientId)} showWard={ward === "all"} />} />)}
              </div>
            </div>
          );
        })
      )}

      {patients.length > 0 && (
        <button type="button" onClick={() => setAddFor("any")} className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-[var(--c-accent)] text-[var(--c-bg)] shadow-2xl flex items-center justify-center active:scale-95" aria-label="Add job">
          <Plus className="w-7 h-7" />
        </button>
      )}
      {openJob && <JobSheet jobId={openJob} onClose={() => setOpenJob(null)} />}
      {addFor && <AddJobSheet patientId={addFor === "any" ? undefined : addFor} ward={ward} onClose={() => setAddFor(null)} />}
      {addPatient && <PatientSheet ward={ward} onClose={() => setAddPatient(false)} />}
    </div>
  );
};

// ---------------- Follow-up (locked) ----------------
export const FollowUpScreen: React.FC<{ ward: string; setWard: (w: string) => void }> = ({ ward, setWard }) => {
  const data = useData();
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const pById = new Map(data.patients.map((p) => [p.id, p]));
  const inWard = (j: Job) => ward === "all" || pById.get(j.patientId)?.ward === ward;
  const open = data.jobs.filter((j) => j.followUp && j.status !== "done" && inWard(j))
    .sort((a, b) => (a.expectedBy || "9999").localeCompare(b.expectedBy || "9999") || a.createdAt - b.createdAt);
  const overdue = open.filter(isOverdue);
  const pending = open.filter((j) => !isOverdue(j));
  const closed = data.jobs.filter((j) => !j.followUp && j.outcome && inWard(j)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  const List: React.FC<{ jobs: Job[] }> = ({ jobs }) => (
    <div className="divide-y divide-[var(--c-border)]/60">
      {jobs.map((j) => <JobRow key={j.id} job={j} onOpen={() => setOpenJob(j.id)} showPatient={<PatientLabel p={pById.get(j.patientId)} showWard />} />)}
    </div>
  );

  return (
    <div className="space-y-3">
      <WardPicker ward={ward} setWard={setWard} />
      <div className={`${card} p-3.5 flex gap-3 items-start`}>
        <Lock className="w-5 h-5 shrink-0 mt-0.5" style={{ color: STATUS_COLOR.waiting }} />
        <div className="text-xs text-[var(--c-muted)] leading-relaxed">
          <strong className="text-[var(--c-text)]">Locked follow-ups</strong>: results and answers that take days, like send-away bloods, cultures and histology. They aren't cleared with the day's jobs or on discharge. Close one by recording the outcome.
        </div>
      </div>
      {overdue.length > 0 && (
        <div className={`${card} px-3.5 pt-3 pb-1 border-[color:var(--c-border)]`} style={{ borderColor: PRIORITY_COLOR.Urgent }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIORITY_COLOR.Urgent }}>Overdue · {overdue.length}</p>
          <List jobs={overdue} />
        </div>
      )}
      <div className={`${card} px-3.5 pt-3 pb-1`}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: STATUS_COLOR.waiting }}>Awaiting · {pending.length}</p>
        {pending.length ? <List jobs={pending} /> : <p className="text-xs text-[var(--c-muted)] py-3">Nothing awaited.</p>}
      </div>
      {closed.length > 0 && (
        <div className={`${card} px-3.5 py-3`}>
          <button type="button" onClick={() => setShowClosed(!showClosed)} className="w-full flex items-center justify-between text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider">
            Closed recently · {closed.length} {showClosed ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showClosed && closed.map((j) => (
            <button key={j.id} type="button" onClick={() => setOpenJob(j.id)} className="w-full text-left py-2 border-b border-[var(--c-border)]/50 last:border-0">
              <p className="text-[11px]"><PatientLabel p={pById.get(j.patientId)} showWard /></p>
              <p className="text-xs text-[var(--c-text)]">{j.text}</p>
              <p className="text-[11px] text-[var(--c-muted)]">→ {j.outcome} · {j.doneAt ? fmtStamp(j.doneAt) : ""} by {j.doneBy}</p>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setAdding(true)} className="fixed bottom-24 right-4 z-40 h-14 px-5 rounded-full text-white shadow-2xl flex items-center gap-2 font-bold active:scale-95" style={{ background: STATUS_COLOR.waiting }} aria-label="Add follow-up">
        <Plus className="w-5 h-5" /> Follow-up
      </button>
      {openJob && <JobSheet jobId={openJob} onClose={() => setOpenJob(null)} />}
      {adding && <AddJobSheet followUp ward={ward} onClose={() => setAdding(false)} />}
    </div>
  );
};

// ---------------- Patients ----------------
export const PatientsScreen: React.FC<{ ward: string; setWard: (w: string) => void }> = ({ ward, setWard }) => {
  const data = useData();
  const [editing, setEditing] = useState<Patient | null | "new">(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const list = data.patients.filter((p) => ward === "all" || p.ward === ward).sort(bedSort);
  const current = list.filter((p) => !p.discharged);
  const gone = list.filter((p) => p.discharged);
  const openFollow = (id: string) => data.jobs.filter((j) => j.patientId === id && j.followUp && j.status !== "done").length;
  const outstanding = (id: string) => data.jobs.filter((j) => j.patientId === id && !j.followUp && j.status !== "done").length;

  const Row: React.FC<{ p: Patient }> = ({ p }) => (
    <div className="py-2.5 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm"><PatientLabel p={p} showWard={ward === "all"} /></p>
        <p className="text-[11px] text-[var(--c-muted)] truncate">
          {p.summary || "No summary"} · {outstanding(p.id)} open{openFollow(p.id) ? ` · ${openFollow(p.id)} follow-up` : ""}
          {p.discharged ? ` · discharged ${fmtStamp(p.discharged)}` : ""}
        </p>
      </div>
      {!p.discharged ? (
        <>
          <button type="button" aria-label={`Edit bed ${p.bed}`} onClick={() => setEditing(p)} className="p-2 text-[var(--c-muted)]"><Pencil className="w-4 h-4" /></button>
          <button type="button" aria-label={`Discharge bed ${p.bed}`} onClick={() => dischargePatient(p.id)} className="p-2 text-[var(--c-muted)]"><LogOut className="w-4 h-4" /></button>
        </>
      ) : (
        <>
          <button type="button" aria-label={`Undo discharge bed ${p.bed}`} onClick={() => dischargePatient(p.id, true)} className="p-2 text-[var(--c-muted)]"><Undo2 className="w-4 h-4" /></button>
          {confirm === p.id ? (
            <button type="button" onClick={() => { if (!deletePatient(p.id)) setMsg("This patient has open follow-ups. Close them first."); setConfirm(null); }} className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold">Delete</button>
          ) : (
            <button type="button" aria-label={`Delete bed ${p.bed}`} onClick={() => setConfirm(p.id)} className="p-2 text-[var(--c-muted)]"><Trash2 className="w-4 h-4" /></button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <WardPicker ward={ward} setWard={setWard} />
      <button type="button" onClick={() => setEditing("new")} className="w-full py-3 rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)] font-bold flex items-center justify-center gap-2"><UserPlus className="w-4 h-4" /> Add patient</button>
      {msg && <p className="text-xs text-amber-400">{msg}</p>}
      <div className={`${card} px-3.5 py-1 divide-y divide-[var(--c-border)]/60`}>
        {current.length ? current.map((p) => <Row key={p.id} p={p} />) : <p className="text-xs text-[var(--c-muted)] py-3">No current patients.</p>}
      </div>
      {gone.length > 0 && (
        <div className={`${card} px-3.5 py-2`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)] pt-1">Discharged</p>
          <div className="divide-y divide-[var(--c-border)]/60">{gone.map((p) => <Row key={p.id} p={p} />)}</div>
          <p className="text-[10.5px] text-[var(--c-muted)] pb-1">Removed automatically after {data.settings.removeDischargedAfterHours} h, unless they have open follow-ups.</p>
        </div>
      )}
      {editing && <PatientSheet patient={editing === "new" ? undefined : editing} ward={ward} onClose={() => setEditing(null)} />}
    </div>
  );
};

