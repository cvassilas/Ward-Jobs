import React, { useMemo, useState } from "react";
import { Search, X, FileText, Folder, Link2, ExternalLink } from "lucide-react";
import { searchDept, DEPTS, DeptSource, DEPT_INDEX_DATE, deptDocs } from "../lib/deptSearch";

const KindIcon: React.FC<{ kind: string }> = ({ kind }) => {
  const C = kind === "folder" ? Folder : kind === "link" ? Link2 : FileText;
  return <C className="w-4 h-4 shrink-0 text-[var(--c-muted)]" />;
};

/**
 * Search box for the department guideline folders. `renderExtra` lets an app
 * show its own matches (your links, your documents) above the department ones.
 */
export const DeptSearch: React.FC<{
  autoFocus?: boolean;
  renderExtra?: (q: string) => React.ReactNode;
  children?: React.ReactNode; // shown when the box is empty
}> = ({ autoFocus, renderExtra, children }) => {
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<DeptSource | "all">("all");
  const hits = useMemo(() => searchDept(q, src), [q, src]);
  const total = useMemo(() => deptDocs().filter((d) => d.kind === "file").length, []);
  const active = q.trim().length > 0;
  const extra = active && renderExtra ? renderExtra(q) : null;

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-muted)]" />
        <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} type="text" enterKeyHint="search"
          placeholder={`Search ${total} guidelines and documents`} aria-label="Search guidelines"
          className="w-full bg-[var(--c-bg)] text-[var(--c-text)] placeholder-[var(--c-muted)]/70 border border-[var(--c-border)] focus:border-[var(--c-teal)] rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none" />
        {active && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--c-muted)]"><X className="w-4 h-4" /></button>}
      </div>
      {active && (
        <div className="flex gap-1.5">
          {(["all", "wx", "accu"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSrc(s)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border ${src === s ? "border-[var(--c-teal)] bg-[var(--c-teal)]/15 text-[var(--c-teal)]" : "border-[var(--c-border)] text-[var(--c-muted)]"}`}>
              {s === "all" ? "All" : DEPTS[s].short}
            </button>
          ))}
        </div>
      )}
      {!active && children}
      {active && (
        <div className="space-y-1.5">
          {extra}
          {hits.length === 0 && !extra && <p className="text-xs text-[var(--c-muted)] px-1">Nothing matches “{q.trim()}”. Try fewer or shorter words.</p>}
          {hits.map((d) => (
            <a key={`${d.src}-${d.id}`} href={d.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 bg-[var(--c-bg)] border border-[var(--c-border)] hover:border-[var(--c-accent)] rounded-xl px-3 py-2.5">
              <KindIcon kind={d.kind} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[var(--c-text)] leading-snug break-words">{d.name}</span>
                <span className="block text-[10.5px] text-[var(--c-muted)] truncate">
                  <span className="font-bold text-[var(--c-accent)]">{DEPTS[d.src].short}</span>
                  {d.path ? ` · ${d.path}` : ""}{d.ext ? ` · ${d.ext.toUpperCase()}` : d.kind === "folder" ? " · folder" : ""}
                </span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[var(--c-muted)]" />
            </a>
          ))}
          {hits.length > 0 && <p className="text-[10px] text-[var(--c-muted)] px-1">Opens in Box. Index of folder contents as of {new Date(DEPT_INDEX_DATE).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}; new files added since then are in the folders but not in search until the index is refreshed.</p>}
        </div>
      )}
    </div>
  );
};

/** Small row used for an app's own matches in the results list. */
export const MineRow: React.FC<{ title: string; sub: string; href?: string; onClick?: () => void; icon?: React.ReactNode }> = ({ title, sub, href, onClick, icon }) => {
  const inner = (
    <>
      {icon ?? <Link2 className="w-4 h-4 shrink-0 text-[var(--c-teal)]" />}
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-semibold text-[var(--c-text)] leading-snug break-words">{title}</span>
        <span className="block text-[10.5px] text-[var(--c-muted)] truncate"><span className="font-bold text-[var(--c-teal)]">Mine</span> · {sub}</span>
      </span>
      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[var(--c-muted)]" />
    </>
  );
  const cls = "w-full flex items-center gap-2.5 bg-[var(--c-bg)] border border-[var(--c-teal)]/40 rounded-xl px-3 py-2.5";
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
};
