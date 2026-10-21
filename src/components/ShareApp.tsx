import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Share2, Copy, Check } from "lucide-react";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { card } from "./ui";

export const WEB_APP_URL = "https://cvassilas.github.io/ward-jobs-web/";

/** QR code and link so colleagues can open the web app (iPhone: Safari → Add to Home Screen). */
export const ShareAppSection: React.FC = () => {
  const [svg, setSvg] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toString(WEB_APP_URL, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(setSvg); }, []);

  const share = async () => {
    const text = "Ward Jobs: open this link. On iPhone, open it in Safari and tap Share → Add to Home Screen. Ask me in person for the team code.";
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ title: "Ward Jobs", text, url: WEB_APP_URL, dialogTitle: "Share Ward Jobs" });
      else if (navigator.share) await navigator.share({ title: "Ward Jobs", text, url: WEB_APP_URL });
      else await copy();
    } catch { /* cancelled */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(WEB_APP_URL); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ }
  };

  return (
    <div className={`${card} p-4 space-y-3`}>
      <h2 className="text-xs font-bold text-[var(--c-text)] uppercase tracking-wider border-b border-[var(--c-border)] pb-2 flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> Share the app</h2>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 text-left">
        <span className="w-16 h-16 shrink-0 rounded-lg bg-white p-1 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--c-text)]">Ward Jobs web app</span>
          <span className="block text-[11px] text-[var(--c-muted)]">Colleagues scan this to open it on any phone. Tap to enlarge.</span>
        </span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={share} className="py-2.5 rounded-xl bg-[var(--c-teal)] text-white text-xs font-bold flex items-center justify-center gap-1.5"><Share2 className="w-4 h-4" /> Share link</button>
        <button type="button" onClick={copy} className="py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] text-xs font-bold flex items-center justify-center gap-1.5">{copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy link</>}</button>
      </div>
      <p className="text-[10.5px] text-[var(--c-muted)] leading-snug">iPhone: open in Safari, then Share → Add to Home Screen. This only opens the app; to see your team's list they also need the team code, which you give them in person (Team sync).</p>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col items-center justify-center p-6" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs space-y-3 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full aspect-square [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="text-lg font-bold text-black">Ward Jobs</p>
            <p className="text-xs text-neutral-600 break-all">{WEB_APP_URL.replace("https://", "")}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-5 px-6 py-2.5 rounded-full bg-white/15 text-white text-sm font-bold">Close</button>
        </div>
      )}
    </div>
  );
};
