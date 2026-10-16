import React, { useRef, useState } from "react";
import { Share2, FileText, Send, Download, Copy } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { useData, exportList, importList, ExportFile } from "../lib/store";
import { handoverText, handoverPdf } from "../lib/handover";
import { saveFile } from "../lib/saveFile";
import { WardPicker } from "./Screens";
import { card } from "./ui";

/** Handover: share as text or PDF, and pass the whole list (with progress and follow-ups) to a colleague's phone. */
export const HandoverScreen: React.FC<{ ward: string; setWard: (w: string) => void }> = ({ ward, setWard }) => {
  useData();
  const [includeDone, setIncludeDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const text = handoverText({ ward, includeDone });

  const shareText = async () => {
    setMsg(null);
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ title: "Ward jobs handover", text, dialogTitle: "Share handover" });
      else { await navigator.clipboard.writeText(text); setMsg("Copied to clipboard."); }
    } catch (e: any) { if (!/cancel/i.test(e?.message || "")) setMsg(e?.message || "Couldn't share."); }
  };
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  return (
    <div className="space-y-3">
      <WardPicker ward={ward} setWard={setWard} />
      <div className={`${card} p-3.5 space-y-2.5`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--c-text)]">Handover sheet</h2>
          <button type="button" onClick={() => setIncludeDone(!includeDone)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${includeDone ? "border-[var(--c-teal)] text-[var(--c-teal)]" : "border-[var(--c-border)] text-[var(--c-muted)]"}`}>
            {includeDone ? "✓ Including done" : "Outstanding only"}
          </button>
        </div>
        <pre className="text-[11.5px] leading-relaxed whitespace-pre-wrap font-mono bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl p-3 max-h-80 overflow-y-auto text-[var(--c-text2)]">{text}</pre>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={shareText} className="py-2.5 rounded-xl bg-[var(--c-teal)] text-white text-xs font-bold flex items-center justify-center gap-1.5">
            {Capacitor.isNativePlatform() ? <Share2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Share as text
          </button>
          <button type="button" onClick={() => saveFile(handoverPdf({ ward, includeDone }), `handover-${stamp}.pdf`).catch((e) => setMsg(e?.message))} className="py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] text-xs font-bold flex items-center justify-center gap-1.5">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
        <p className="text-[10.5px] text-[var(--c-muted)]">Share only through NHSmail or Teams. Shred printed copies.</p>
      </div>

      <div className={`${card} p-3.5 space-y-2.5`}>
        <h2 className="text-sm font-bold text-[var(--c-text)]">Pass the list to a colleague</h2>
        <p className="text-xs text-[var(--c-muted)] leading-relaxed">
          Sends the full list, with progress notes, timestamps and locked follow-ups, as a file they open in their own Ward Jobs app. If you both edit, each job keeps whichever change is most recent and the progress notes are combined.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => {
            const blob = new Blob([JSON.stringify(exportList(ward))], { type: "application/json" });
            saveFile(blob, `ward-jobs-${ward === "all" ? "all" : ward.replace(/\W+/g, "-")}-${stamp}.json`).catch((e) => setMsg(e?.message));
          }} className="py-2.5 rounded-xl bg-[var(--c-accent)] text-[var(--c-bg)] text-xs font-bold flex items-center justify-center gap-1.5">
            <Send className="w-4 h-4" /> Send list
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] text-xs font-bold flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" /> Open a list
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-file" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const r = importList(JSON.parse(await f.text()) as ExportFile);
            setMsg(`Merged: ${r.patients} new patient${r.patients === 1 ? "" : "s"}, ${r.jobs} new job${r.jobs === 1 ? "" : "s"}. Existing ones were updated.`);
          } catch (err: any) { setMsg(err?.message || "Couldn't read that file."); }
        }} />
        {msg && <p className="text-xs text-[var(--c-teal)]">{msg}</p>}
      </div>
    </div>
  );
};
