import React from "react";
import { Check, Clock, Lock, Loader, Hourglass } from "lucide-react";
import { Job, setStatus, fmtTime, fmtStamp, isOverdue, ago } from "../lib/store";
import { Chip, PRIORITY_COLOR, STATUS_COLOR } from "./ui";

/** One job: tap the circle to tick it off (or reopen), tap the text for details and progress. */
export const JobRow: React.FC<{ job: Job; onOpen: () => void; showPatient?: React.ReactNode }> = ({ job, onOpen, showPatient }) => {
  const done = job.status === "done";
  const overdue = isOverdue(job);
  const last = job.log[job.log.length - 1];
  const Icon = job.status === "doing" ? Loader : job.status === "waiting" ? Hourglass : null;
  return (
    <div className={`flex items-start gap-2.5 py-2.5 ${done ? "opacity-55" : ""}`}>
      <button
        type="button"
        aria-label={done ? `Reopen ${job.text}` : `Mark done: ${job.text}`}
        disabled={job.followUp}
        onClick={() => setStatus(job.id, done ? "todo" : "done")}
        className="mt-0.5 w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition active:scale-90 disabled:opacity-100"
        style={{ borderColor: STATUS_COLOR[job.status], background: done ? STATUS_COLOR.done : "transparent" }}
        title={job.followUp ? "Locked follow-up: open it to close with the result" : undefined}
      >
        {done ? <Check className="w-4 h-4 text-white" strokeWidth={3} /> : job.followUp ? <Lock className="w-3.5 h-3.5" style={{ color: STATUS_COLOR.waiting }} /> : Icon ? <Icon className="w-3.5 h-3.5" style={{ color: STATUS_COLOR[job.status] }} /> : null}
      </button>
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
        {showPatient && <div className="text-[11px] mb-0.5">{showPatient}</div>}
        <p className={`text-sm leading-snug text-[var(--c-text)] ${done ? "line-through" : ""}`}>{job.text}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {!done && job.priority !== "Today" && <Chip color={PRIORITY_COLOR[job.priority]} solid={job.priority === "Urgent"}>{job.priority}</Chip>}
          {job.status === "doing" && <Chip color={STATUS_COLOR.doing}>In progress</Chip>}
          {job.status === "waiting" && !job.followUp && <Chip color={STATUS_COLOR.waiting}>Awaiting</Chip>}
          {job.dueTime && !done && <Chip color={overdue ? PRIORITY_COLOR.Urgent : "#7D8E97"}><Clock className="w-3 h-3" />{overdue ? "Overdue " : "by "}{job.dueTime}</Chip>}
          {job.followUp && job.expectedBy && <Chip color={overdue ? PRIORITY_COLOR.Urgent : STATUS_COLOR.waiting}>{overdue ? "Overdue · " : "Due "}{new Date(job.expectedBy).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</Chip>}
          <span className="text-[10.5px] text-[var(--c-muted)]">{job.category}</span>
          {job.assignee && <span className="text-[10.5px] font-semibold text-[var(--c-text2)]">→ {job.assignee}</span>}
        </div>
        <p className="text-[10.5px] text-[var(--c-muted)] mt-0.5">
          {done && job.doneAt ? `Done ${fmtTime(job.doneAt)} by ${job.doneBy}` : `Added ${fmtStamp(job.createdAt)} by ${job.createdBy}`}
          {!done && last && job.log.length > 1 && <> · <span className="text-[var(--c-text2)]">{last.text}</span> ({ago(last.at)})</>}
        </p>
      </button>
    </div>
  );
};
