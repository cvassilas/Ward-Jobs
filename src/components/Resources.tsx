import React, { useState } from "react";
import { FolderOpen, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useData, updateSettings, DEFAULT_LINKS } from "../lib/store";
import { Sheet, card, inputCls } from "./ui";
import { DeptSearch, MineRow } from "./DeptSearch";
import { searchLinks } from "../lib/deptSearch";

/** Folder button for the header: opens the list of guideline / resource links. */
export const ResourcesButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { settings } = useData();
  const links = settings.links ?? DEFAULT_LINKS;
  return (
    <>
      <button type="button" aria-label="Resources" onClick={() => setOpen(true)} className="w-9 h-9 rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] flex items-center justify-center text-[var(--c-accent)]">
        <FolderOpen className="w-4.5 h-4.5" />
      </button>
      {open && (
        <Sheet title="Resources" onClose={() => setOpen(false)}>
          <DeptSearch renderExtra={(q) => searchLinks(q, links).map((l) => <MineRow key={l.id} title={l.title} sub={l.url.replace(/^https?:\/\//, "").split("/")[0]} href={l.url} />)}>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--c-muted)] px-1 pt-1">Folders</p>
            {links.length === 0 && <p className="text-xs text-[var(--c-muted)]">No links yet. Add them in Settings → Resources.</p>}
            {links.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[var(--c-text)] truncate">{l.title}</span>
                  <span className="block text-[11px] text-[var(--c-muted)] truncate">{l.url.replace(/^https?:\/\//, "").split("/")[0]}</span>
                </span>
                <ExternalLink className="w-4 h-4 text-[var(--c-muted)] shrink-0" />
              </a>
            ))}
          </DeptSearch>
        </Sheet>
      )}
    </>
  );
};

/** Settings section to add, rename and remove links. */
export const ResourcesSettings: React.FC = () => {
  const { settings } = useData();
  const links = settings.links ?? DEFAULT_LINKS;
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const save = (next: typeof links) => updateSettings({ links: next });
  return (
    <div className={`${card} p-4 space-y-3`}>
      <h2 className="text-xs font-bold text-[var(--c-text)] uppercase tracking-wider border-b border-[var(--c-border)] pb-2 flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Resources</h2>
      <p className="text-[11px] text-[var(--c-muted)]">Links in the folder button at the top of every screen.</p>
      {links.map((l) => (
        <div key={l.id} className="flex items-center gap-2">
          <input aria-label="Link name" defaultValue={l.title} onBlur={(e) => e.target.value.trim() && save(links.map((x) => (x.id === l.id ? { ...x, title: e.target.value.trim() } : x)))} className={inputCls} />
          <button type="button" aria-label={`Remove ${l.title}`} onClick={() => save(links.filter((x) => x.id !== l.id))} className="p-2 text-[var(--c-muted)]"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <div className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name, e.g. ICU guidelines" className={inputCls} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link, e.g. https://…" className={inputCls} />
        <button type="button" disabled={!url.trim()} onClick={() => {
          let u = url.trim(); if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
          save([...links, { id: `r-${Date.now()}`, title: title.trim() || u.replace(/^https?:\/\//, "").split("/")[0], url: u }]);
          setTitle(""); setUrl("");
        }} className="w-full py-2.5 rounded-xl bg-[var(--c-teal)] text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"><Plus className="w-4 h-4" /> Add link</button>
      </div>
    </div>
  );
};
