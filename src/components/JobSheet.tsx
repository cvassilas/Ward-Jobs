import React, { useState } from "react";
import { Lock, Unlock, Trash2, Send } from "lucide-react";
import {
  Status, STATUS_LABEL, PRIORITIES, CATEGORIES, setStatus, addNote, editJob, lockAsFollowUp,
  closeFollowUp, deleteJob, fmtStamp, todayIso, useData,
} from "../lib/store";
import { Sheet, PatientLabel, inputCls, labelCls, STATUS_COLOR, PRIORITY_COLOR } from "./ui";

/** Job detail: status and progress notes with a timestamped timeline, edit, lock as follow-up. */
export const JobSheet: React.FC<{ jobId: string; onClose: () => void }> = ({ jobId, onClose }) => {
  const data = useData();
  const job = data.jobs.find((j) => j.id === jobId);
  const [note, setNote] = useState("");
  const [lockDate, setLockDate] = useState("");
  const [showLock, setShowLock] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [showClose, setShowClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!job) return null;
  const patient = data.patients.find((p) => p.id === job.patientId);
  const statuses: Status[] = job.followUp ? ["todo", "doing", "waiting"] : ["todo", "doing", "waiting", "done"];

  const changeStatus = (s: Status) => {
    if (s === job.status) return;
    setStatus(job.id, s, note.trim() ? `${STATUS_LABEL[s]}: ${note.trim()}` : undefined);
    setNote("");
  };

  return (
    <Sheet onClose={onClose} title={<PatientLabel p={patient} showWard />}>
      {job.followUp && (
        <div className="rounded-xl p-3 text-xs flex gap-2 items-start" style={{ background: `color-mix(in srgb, ${STATUS_COLOR.waiting} 12%, transparent)`, color: STATUS_COLOR.waiting }}>
          <Lock className="w-4 h-4 shrink-0" />
          <span>Locked follow-up. It stays on the list through clean-ups and after discharge until you unlock it and record the outcome.{job.expectedBy ? ` Expected by ${new Date(job.expectedBy).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` : ""}</span>
        </div>
      )}

      <div>
        <label className={labelCls}>Job</label>
        <textarea aria-label="Job" rows={2} defaultValue={job.text} onBlur={(e) => e.target.value.trim() && e.target.value !== job.text && editJob(job.id, { text: e.target.value })} className={`${inputCls} resize-y`} />
      </div>

      <div>
        <label className={labelCls}>Progress</label>
        <div className={`grid ${statuses.length === 3 ? "grid-cols-3" : "grid-cols-4"} gap-1.5`}>
          {statuses.map((s) => (
            <button key={s} type="button" onClick={() => changeStatus(s)}
              className="py-2 rounded-xl text-[11px] font-bold border"
              style={job.status === s ? { background: STATUS_COLOR[s], borderColor: STATUS_COLOR[s], color: "#fff" } : { borderColor: "var(--c-border)", color: "var(--c-muted)" }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Progress note, e.g. sent 10:40, chasing lab" className={inputCls}
            onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { addNote(job.id, note); setNote(""); } }} />
          <button type="button" aria-label="Add note" disabled={!note.trim()} onClick={() => { addNote(job.id, note); setNote(""); }} className="px-3 rounded-xl bg-[var(--c-teal)] text-white disabled:opacity-40"><Send className="w-4 h-4" /></button>
        </div>
        <p className="text-[10.5px] text-[var(--c-muted)] mt-1">Type a note then tap a status to record both together.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Priority</label>
          <select aria-label="Priority" value={job.priority} onChange={(e) => editJob(job.id, { priority: e.target.value as any })} className={inputCls} style={{ color: PRIORITY_COLOR[job.priority] }}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select aria-label="Type" value={job.category} onChange={(e) => editJob(job.id, { category: e.target.value as any })} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{job.followUp ? "Expected by" : "Due by"}</label>
          {job.followUp
            ? <input type="date" aria-label="Expected by" value={job.expectedBy || ""} onChange={(e) => editJob(job.id, { expectedBy: e.target.value })} className={inputCls} />
            : <input type="time" aria-label="Due by" value={job.dueTime || ""} onChange={(e) => editJob(job.id, { dueTime: e.target.value })} className={inputCls} />}
        </div>
        <div>
          <label className={labelCls}>Who's doing it</label>
          <input aria-label="Assignee" defaultValue={job.assignee || ""} placeholder="e.g. FY1, CV" onBlur={(e) => editJob(job.id, { assignee: e.target.value.trim() })} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Timeline</label>
        <ol className="relative border-l-2 border-[var(--c-border)] ml-1.5 space-y-2.5">
          {[...job.log].reverse().map((l, i) => (
            <li key={i} className="ml-3">
              <span className="absolute -left-[5px] w-2 h-2 rounded-full mt-1.5" style={{ background: l.status ? STATUS_COLOR[l.status] : "var(--c-muted)" }} />
              <p className="text-xs text-[var(--c-text)]">{l.text}</p>
              <p className="text-[10.5px] text-[var(--c-muted)]">{fmtStamp(l.at)} · {l.by}</p>
            </li>
          ))}
        </ol>
        <p className="text-[10.5px] text-[var(--c-muted)] mt-2">Added {fmtStamp(job.createdAt)} by {job.createdBy}{job.doneAt ? ` · done ${fmtStamp(job.doneAt)} by ${job.doneBy}` : ""}</p>
        {job.outcome && <p className="text-xs text-[var(--c-text)] mt-1"><strong>Outcome:</strong> {job.outcome}</p>}
      </div>

      {!job.followUp ? (
        showLock ? (
          <div className="rounded-xl border border-[var(--c-border)] p-3 space-y-2">
            <label className={labelCls}>Result or answer expected by (optional)</label>
            <input type="date" aria-label="Expected date" min={todayIso()} value={lockDate} onChange={(e) => setLockDate(e.target.value)} className={inputCls} />
            <button type="button" onClick={() => { lockAsFollowUp(job.id, lockDate); setShowLock(false); }} className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: STATUS_COLOR.waiting }}>
              <Lock className="w-4 h-4" /> Lock as follow-up
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowLock(true)} className="w-full py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5" style={{ borderColor: STATUS_COLOR.waiting, color: STATUS_COLOR.waiting }}>
            <Lock className="w-4 h-4" /> Move to follow-up (e.g. send-away bloods)
          </button>
        )
      ) : showClose ? (
        <div className="rounded-xl border border-[var(--c-border)] p-3 space-y-2">
          <label className={labelCls}>Outcome (required to unlock)</label>
          <textarea rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Anti-GBM negative, renal team informed" className={inputCls} />
          <button type="button" disabled={!outcome.trim()} onClick={() => { closeFollowUp(job.id, outcome); onClose(); }} className="w-full py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 flex items-center justify-center gap-1.5" style={{ background: STATUS_COLOR.done }}>
            <Unlock className="w-4 h-4" /> Unlock and close follow-up
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowClose(true)} className="w-full py-2.5 rounded-xl text-xs font-bold border border-[var(--c-border)] text-[var(--c-text)] flex items-center justify-center gap-1.5">
          <Unlock className="w-4 h-4" /> Result back – unlock and close
        </button>
      )}

      {!job.followUp && (confirmDelete ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => { deleteJob(job.id); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold">Delete job</button>
          <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-muted)] text-xs">Keep</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} className="w-full text-xs text-[var(--c-muted)] hover:text-red-400 flex items-center justify-center gap-1.5 py-1"><Trash2 className="w-3.5 h-3.5" /> Delete job</button>
      ))}
    </Sheet>
  );
};

