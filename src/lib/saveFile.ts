/**
 * Hand a generated file (CSV, PDF) to the user.
 * In the Android app the WebView can't download files, so it's written to the cache and
 * opened in the share sheet (Save to Drive, email, Files…). In a browser it downloads.
 */
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const data = await toBase64(blob);
    const written = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title: filename, url: written.uri, dialogTitle: `Save or send ${filename}` });
    return;
  }
  // iPhone / web: share sheet when the browser supports sharing files, otherwise a download
  try {
    const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await nav.share({ files: [file], title: filename });
      return;
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
