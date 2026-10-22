import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { suggestGuidelines, sourceForWorkplace } from "../lib/guidelineMatch";
import { Disclaimer } from "./DeptSearch";
import { DEPTS, DeptSource } from "../lib/deptSearch";

/** "Local guidelines" for a diagnosis, matched on the phone against the department Box folders. */
export const GuidelineSuggestions: React.FC<{ diagnosis?: string; workplace?: string; prefer?: DeptSource; className?: string }> = ({ diagnosis, workplace, prefer, className }) => {
  const [text, setText] = useState(diagnosis || "");
  const [more, setMore] = useState(false);
  useEffect(() => { const t = setTimeout(() => setText(diagnosis || ""), 350); return () => clearTimeout(t); }, [diagnosis]);
  const hits = useMemo(() => suggestGuidelines(text, { prefer: prefer || sourceForWorkplace(workplace), limit: 8 }), [text, workplace, prefer]);
  if (!text.trim() || hits.length === 0) return null;
  const shown = more ? hits : hits.slice(0, 3);
  return (
    <div className={`bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl p-2.5 space-y-1.5 ${className || ""}`}>
      <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--c-accent)]"><BookOpen className="w-3.5 h-3.5" /> Local guidelines</p>
      {shown.map((h) => (
        <a key={`${h.doc.src}-${h.doc.id}`} href={h.doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--c-surface2)]">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-[var(--c-text)] leading-snug break-words">{h.doc.name}</span>
            <span className="block text-[10px] text-[var(--c-muted)] truncate"><span className="font-bold">{DEPTS[h.doc.src].short}</span>{h.doc.path ? ` · ${h.doc.path}` : ""}</span>
          </span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[var(--c-muted)]" />
        </a>
      ))}
      {hits.length > 3 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setMore((v) => !v); }} className="w-full text-[11px] font-bold text-[var(--c-teal)] flex items-center justify-center gap-1 py-0.5">
          {more ? <>Fewer <ChevronUp className="w-3.5 h-3.5" /></> : <>{hits.length - 3} more <ChevronDown className="w-3.5 h-3.5" /></>}
        </button>
      )}
      <Disclaimer className="pt-0.5" />
    </div>
  );
};
