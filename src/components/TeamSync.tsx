import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { Users, QrCode, ScanLine, Copy, LogOut, ShieldCheck, RefreshCw, X, Server } from "lucide-react";
import { useTeam, createTeam, joinTeam, leaveTeam, inviteCode, syncNow, syncConfigured, serverConfig, setServerConfig } from "../lib/sync";
import { ago } from "../lib/store";
import { card, inputCls, labelCls, Sheet } from "./ui";

/** Small status pill for the header. */
export const SyncPill: React.FC = () => {
  const team = useTeam();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  if (!team) return null;
  const pending = Object.keys(team.pending).length;
  const ok = !team.error && team.lastSync && Date.now() - team.lastSync < 30000;
  const color = team.error ? "#E0A040" : ok ? "#2FA37A" : "#7D8E97";
  return (
    <button type="button" onClick={() => syncNow()} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold" style={{ borderColor: color, color }} title={team.error || ""}>
      <span className={`w-2 h-2 rounded-full ${ok ? "animate-pulse" : ""}`} style={{ background: color }} />
      {team.error ? (navigator.onLine === false ? "Offline" : "Sync issue") : ok ? "Live" : "Connecting"}
      {pending > 0 && <span className="opacity-70">· {pending}</span>}
    </button>
  );
};

export const TeamSyncSection: React.FC = () => {
  const team = useTeam();
  const [mode, setMode] = useState<null | "create" | "join" | "invite" | "scan" | "server">(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const configured = syncConfigured();

  const doJoin = async (text: string) => {
    setBusy(true); setMsg(null);
    try { await joinTeam(text); setMode(null); setCode(""); }
    catch (e: any) { setMsg(e?.message || "Couldn't join."); }
    finally { setBusy(false); }
  };

  // Joining from a link (…#join=WJ1.…)
  useEffect(() => {
    const m = /#join=(WJ1\.[^&]+)/.exec(location.hash);
    if (m && !team) { setCode(decodeURIComponent(m[1])); setMode("join"); history.replaceState(null, "", location.pathname); }
  }, []);

  return (
    <div className={`${card} p-4 space-y-3`}>
      <h2 className="text-xs font-bold text-[var(--c-text)] uppercase tracking-wider border-b border-[var(--c-border)] pb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Team sync</h2>
      <div className="flex gap-2 text-[11px] text-[var(--c-muted)] leading-snug">
        <ShieldCheck className="w-4 h-4 shrink-0 text-[var(--c-teal)]" />
        <span>Everyone on the team sees changes live. Each patient and job is encrypted on the phone before it's sent, using a key that only the team's phones hold, so the server can't read anything. Share the team code in person only.</span>
      </div>

      {!configured && (
        <p className="text-xs text-amber-400">The sync server isn't set up in this version yet. <button type="button" className="underline" onClick={() => setMode("server")}>Enter server details</button></p>
      )}

      {team ? (
        <>
          <div className="rounded-xl bg-[var(--c-bg)] border border-[var(--c-border)] p-3 space-y-1">
            <p className="text-sm font-bold text-[var(--c-text)]">{team.name}</p>
            <p className="text-[11px] text-[var(--c-muted)]">
              {team.error ? <span className="text-amber-400">{team.error}</span> : team.lastSync ? `Last synced ${ago(team.lastSync)}` : "Not synced yet"}
              {Object.keys(team.pending).length > 0 && ` · ${Object.keys(team.pending).length} change(s) waiting to send`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("invite")} className="py-2.5 rounded-xl bg-[var(--c-teal)] text-white text-xs font-bold flex items-center justify-center gap-1.5"><QrCode className="w-4 h-4" /> Add a colleague</button>
            <button type="button" onClick={() => syncNow()} className="py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] text-xs font-bold flex items-center justify-center gap-1.5"><RefreshCw className="w-4 h-4" /> Sync now</button>
          </div>
          {confirmLeave ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => { leaveTeam(); setConfirmLeave(false); }} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold">Leave team</button>
              <button type="button" onClick={() => setConfirmLeave(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-muted)] text-xs">Stay</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmLeave(true)} className="w-full text-xs text-[var(--c-muted)] flex items-center justify-center gap-1.5 py-1"><LogOut className="w-3.5 h-3.5" /> Leave team (keeps a copy on this phone)</button>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!configured} onClick={() => setMode("create")} className="py-2.5 rounded-xl bg-[var(--c-accent)] text-[var(--c-bg)] text-xs font-bold disabled:opacity-40">Start a team list</button>
          <button type="button" disabled={!configured} onClick={() => setMode("join")} className="py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] text-xs font-bold disabled:opacity-40">Join a team</button>
        </div>
      )}
      <button type="button" onClick={() => setMode("server")} className="text-[10.5px] text-[var(--c-muted)] flex items-center gap-1"><Server className="w-3 h-3" /> Server settings</button>
      {msg && <p className="text-xs text-red-400">{msg}</p>}

      {mode === "create" && (
        <Sheet title="Start a team list" onClose={() => setMode(null)}>
          <div>
            <label className={labelCls}>Team name (shown to colleagues)</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Whipps ICU" className={inputCls} />
          </div>
          <p className="text-xs text-[var(--c-muted)]">Your current patients and jobs become the team's list.</p>
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); await createTeam(name); setBusy(false); setMode("invite"); }} className="w-full py-3 rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)] font-bold disabled:opacity-40">Create team</button>
        </Sheet>
      )}
      {mode === "invite" && team && <InviteSheet code={inviteCode(team)} onClose={() => setMode(null)} />}
      {mode === "join" && (
        <Sheet title="Join a team" onClose={() => setMode(null)}>
          <button type="button" onClick={() => setMode("scan")} className="w-full py-3 rounded-2xl bg-[var(--c-teal)] text-white font-bold flex items-center justify-center gap-2"><ScanLine className="w-5 h-5" /> Scan your colleague's QR code</button>
          <div>
            <label className={labelCls}>Or paste the team code</label>
            <textarea rows={3} value={code} onChange={(e) => setCode(e.target.value)} placeholder="WJ1.…" className={`${inputCls} font-mono text-xs`} />
          </div>
          <p className="text-xs text-[var(--c-muted)]">Anything already on this phone is added to the team list.</p>
          <button type="button" disabled={busy || !code.trim()} onClick={() => doJoin(code)} className="w-full py-3 rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)] font-bold disabled:opacity-40">{busy ? "Joining…" : "Join team"}</button>
          {msg && <p className="text-xs text-red-400">{msg}</p>}
        </Sheet>
      )}
      {mode === "scan" && <Scanner onCode={(c) => { setMode("join"); setCode(c); doJoin(c); }} onClose={() => setMode("join")} />}
      {mode === "server" && <ServerSheet onClose={() => setMode(null)} />}
    </div>
  );
};

const InviteSheet: React.FC<{ code: string; onClose: () => void }> = ({ code, onClose }) => {
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toString(code, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg); }, [code]);
  return (
    <Sheet title="Add a colleague" onClose={onClose}>
      <p className="text-xs text-[var(--c-muted)]">On their phone: Ward Jobs → Settings → Team sync → Join a team → Scan. Show this in person; anyone with the code can read the list.</p>
      <div className="bg-white rounded-2xl p-4 mx-auto w-64 h-64" dangerouslySetInnerHTML={{ __html: svg }} />
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* */ } }} className="w-full py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] text-xs font-bold flex items-center justify-center gap-1.5">
        <Copy className="w-4 h-4" /> {copied ? "Copied" : "Copy team code instead"}
      </button>
    </Sheet>
  );
};

const Scanner: React.FC<{ onCode: (c: string) => void; onClose: () => void }> = ({ onCode, onClose }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = video.current!;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        await v.play();
        const scan = () => {
          if (done) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (res && /WJ1\./.test(res.data)) { done = true; onCode(res.data); return; }
          }
          raf = requestAnimationFrame(scan);
        };
        scan();
      } catch {
        setErr("Couldn't open the camera. Allow camera access, or paste the team code instead.");
      }
    })();
    return () => { done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center">
      <video ref={video} className="w-full max-w-md" muted playsInline />
      <div className="absolute w-60 h-60 border-4 border-white/80 rounded-3xl pointer-events-none" />
      <p className="absolute bottom-24 text-white text-sm px-6 text-center">{err || "Point at your colleague's team QR code"}</p>
      <button type="button" onClick={onClose} aria-label="Close scanner" className="absolute top-6 right-6 text-white"><X className="w-8 h-8" /></button>
    </div>
  );
};

const ServerSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const c = serverConfig();
  const [url, setUrl] = useState(c.url);
  const [key, setKey] = useState(c.key);
  return (
    <Sheet title="Sync server" onClose={onClose}>
      <p className="text-xs text-[var(--c-muted)]">Supabase project URL and publishable (anon) key. Normally built in; only change this if asked to.</p>
      <div><label className={labelCls}>Project URL</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" className={inputCls} /></div>
      <div><label className={labelCls}>Publishable / anon key</label><input value={key} onChange={(e) => setKey(e.target.value)} className={`${inputCls} font-mono text-xs`} /></div>
      <button type="button" onClick={() => { setServerConfig(url, key); onClose(); }} className="w-full py-3 rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)] font-bold">Save</button>
    </Sheet>
  );
};
