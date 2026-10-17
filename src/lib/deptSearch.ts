/**
 * Search over the departmental Box folders (Whipps Cross anaesthetics and
 * Royal London ACCU). The index holds titles, folder paths and Box ids only,
 * never the documents themselves. Opening a result goes to Box through the
 * department's shared link, so Box access rules still apply.
 */
import raw from "./deptIndex.json";

export type DeptSource = "wx" | "accu";

export const DEPTS: Record<DeptSource, { label: string; short: string; shared: string }> = {
  wx: { label: "Whipps Cross Anaesthetics & ICU", short: "Whipps", shared: "https://whippscrossanaestheticdepartme.box.com/s/wd090mzh7mrtdn4vgpzarvuy2coyxa2d" },
  accu: { label: "Royal London ACCU", short: "RLH ACCU", shared: "https://barts.box.com/s/i58b8k6ivraunruvs9duk5zkbk5ld0dt" },
};
const ROOTS: Record<DeptSource, string> = { wx: "108514814200", accu: "48971929151" };

export interface DeptDoc {
  kind: "file" | "folder" | "link";
  id: string;
  name: string;
  ext: string;
  src: DeptSource;
  path: string;
  url: string;
  hay: string;
  nameNorm: string;
}

type RawIndex = { v: string; paths: [string, string][]; items: [string, string, string, number, string][] };
const data = raw as unknown as RawIndex;
export const DEPT_INDEX_DATE: string = data.v;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

let cache: DeptDoc[] | null = null;
export function deptDocs(): DeptDoc[] {
  if (cache) return cache;
  cache = data.items.map(([t, id, name, pi, parent]) => {
    const [src, path] = data.paths[pi] as [DeptSource, string];
    const shared = DEPTS[src].shared;
    const kind = t === "d" ? "folder" : t === "w" ? "link" : "file";
    const dot = name.lastIndexOf(".");
    const ext = kind === "file" && dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
    const title = ext ? name.slice(0, dot) : name;
    // Box web links have no page of their own under a shared link, so open the folder they sit in.
    const url = kind === "file" ? `${shared}/file/${id}`
      : kind === "folder" ? `${shared}/folder/${id}`
      : parent === ROOTS[src] ? shared : `${shared}/folder/${parent}`;
    const nameNorm = norm(title);
    return { kind, id, name: title, ext, src, path, url, nameNorm, hay: `${nameNorm} ${norm(path)}` };
  });
  return cache;
}

export interface SearchHit<T> { item: T; score: number }

/** Every word must appear in the title or folder path; title and word-start matches rank higher. */
export function scoreText(q: string[], nameNorm: string, hay: string): number {
  let score = 0;
  const words = ` ${nameNorm} `;
  for (const w of q) {
    if (!hay.includes(w)) return 0;
    if (words.includes(` ${w} `)) score += 6;
    else if (words.includes(` ${w}`)) score += 4;
    else if (nameNorm.includes(w)) score += 2;
    else score += 1;
  }
  return score;
}

export function queryWords(q: string): string[] { return norm(q).split(" ").filter(Boolean); }

export function searchDept(q: string, src: DeptSource | "all" = "all", limit = 60): DeptDoc[] {
  const words = queryWords(q);
  if (!words.length) return [];
  const hits: SearchHit<DeptDoc>[] = [];
  for (const d of deptDocs()) {
    if (src !== "all" && d.src !== src) continue;
    let s = scoreText(words, d.nameNorm, d.hay);
    if (!s) continue;
    if (d.kind === "folder") s += 1;
    hits.push({ item: d, score: s });
  }
  hits.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length);
  return hits.slice(0, limit).map((h) => h.item);
}

export function searchLinks<T extends { title: string; url: string }>(q: string, links: T[]): T[] {
  const words = queryWords(q);
  if (!words.length) return [];
  return links.filter((l) => { const n = norm(l.title); return scoreText(words, n, `${n} ${norm(l.url)}`) > 0; });
}
