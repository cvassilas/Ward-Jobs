import React from "react";
import { Lock } from "lucide-react";
import { Job, Patient, Priority, Status, STATUS_LABEL } from "../lib/store";

export const card = "bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl";
export const inputCls = "w-full bg-[var(--c-bg)] text-[var(--c-text)] placeholder-[var(--c-muted)]/60 border border-[var(--c-border)] focus:border-[var(--c-teal)] rounded-xl px-3 py-2.5 text-sm outline-none [color-scheme:var(--c-scheme)]";
export const labelCls = "block text-[11px] font-semibold text-[var(--c-muted)] mb-1";

export const PRIORITY_COLOR: Record<Priority, string> = { Urgent: "#E05A4F", Today: "#D9A441", Routine: "#7D8E97" };
export const STATUS_COLOR: Record<Status, string> = { todo: "#7D8E97", doing: "#4A8FE7", waiting: "#9B7BE0", done: "#2FA37A" };

export const Chip: React.FC<{ color: string; children: React.ReactNode; solid?: boolean }> = ({ color, children, solid }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border whitespace-nowrap"
    style={solid ? { background: color, borderColor: color, color: "#fff" } : { color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
  >
    {children}
  </span>
);

export const StatusChip: React.FC<{ s: Status }> = ({ s }) => <Chip color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Chip>;

export const PatientLabel: React.FC<{ p?: Patient; showWard?: boolean }> = ({ p, showWard }) =>
  p ? (
    <span className="font-bold text-[var(--c-text)]">
      {showWard && <span className="text-[var(--c-muted)] font-semibold">{p.ward} · </span>}
      Bed {p.bed} · {p.initials}
      {p.discharged && <span className="ml-1.5 text-[10px] font-bold text-[var(--c-muted)] uppercase">discharged</span>}
    </span>
  ) : (
    <span className="text-[var(--c-muted)]">Unknown patient</span>
  );

export const ProgressBar: React.FC<{ done: number; total: number; thin?: boolean }> = ({ done, total, thin }) => (
  <div className={`w-full ${thin ? "h-1.5" : "h-2"} rounded-full bg-[var(--c-bg)] overflow-hidden border border-[var(--c-border)]/50`}>
    <div className="h-full rounded-full transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: STATUS_COLOR.done }} />
  </div>
);

export const LockBadge: React.FC = () => (
  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color: STATUS_COLOR.waiting }}>
    <Lock className="w-3 h-3" /> Follow-up
  </span>
);

export const Sheet: React.FC<{ onClose: () => void; title: React.ReactNode; children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center" onClick={onClose}>
    <div className="bg-[var(--c-surface)] w-full max-w-md rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl animate-fadeIn" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--c-border)]">
        <div className="text-base font-bold text-[var(--c-text)] min-w-0">{title}</div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--c-muted)] text-xl px-2">✕</button>
      </div>
      <div className="overflow-y-auto p-4 pb-8 space-y-4">{children}</div>
    </div>
  </div>
);

export function jobProgress(jobs: Job[]) {
  const counted = jobs.filter((j) => !j.followUp);
  return { done: counted.filter((j) => j.status === "done").length, total: counted.length };
}
