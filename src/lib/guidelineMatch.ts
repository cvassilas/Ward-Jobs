/**
 * Suggest local guidelines for a patient's diagnosis by matching it against the
 * department guideline index (titles and folder names only). Runs entirely on the
 * phone: nothing about the patient is sent anywhere.
 */
import { deptDocs, DeptDoc, DeptSource } from "./deptSearch";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Families of words and abbreviations that mean the same thing in guideline titles. */
const GROUPS: string[][] = [
  ["sepsis", "septic", "neutropenic sepsis"],
  ["pneumonia", "cap", "hap", "vap", "chest infection", "lrti"],
  ["aki", "acute kidney", "renal failure", "renal", "crrt", "rrt", "haemofiltration", "filtration", "dialysis"],
  ["dka", "ketoacidosis", "diabetic ketoacidosis"],
  ["hhs", "hyperosmolar"],
  ["pe", "pulmonary embolism", "pulmonary embolus", "thrombolysis"],
  ["ards", "proning", "prone"],
  ["copd", "coad", "exacerbation of copd"],
  ["asthma"],
  ["gi bleed", "gastrointestinal bleed", "upper gi", "variceal", "varices", "haematemesis", "melaena", "bleeding", "bleed", "major haemorrhage"],
  ["major haemorrhage", "massive haemorrhage", "massive transfusion", "mhp", "haemorrhage"],
  ["cardiac arrest", "ohca", "ihca", "post arrest", "rosc", "ttm", "targeted temperature", "post resuscitation"],
  ["acs", "stemi", "nstemi", "myocardial infarction"],
  ["heart failure", "cardiogenic", "cardiogenic shock", "inotrope", "inotropes"],
  ["af", "atrial fibrillation", "arrhythmia", "svt", "vt"],
  ["stroke", "cva", "ich", "intracerebral"],
  ["seizure", "seizures", "status epilepticus", "epilepsy", "fitting"],
  ["tbi", "head injury", "traumatic brain"],
  ["sah", "subarachnoid"],
  ["delirium", "agitation", "cam icu", "icdsc"],
  ["pancreatitis"],
  ["trauma", "major trauma", "polytrauma"],
  ["burn", "burns"],
  ["overdose", "od", "poisoning", "toxbase"],
  ["paracetamol", "paracetamol overdose"],
  ["liver failure", "acute liver", "hepatic", "alf", "liver"],
  ["hyperkalaemia", "potassium"],
  ["hyponatraemia", "hypernatraemia", "sodium"],
  ["anaphylaxis"],
  ["tracheostomy", "trachy", "trache", "laryngectomy"],
  ["covid", "covid 19", "sars cov 2"],
  ["meningitis", "encephalitis"],
  ["spinal cord", "spinal injury", "spinal"],
  ["end of life", "eol", "palliative", "withdrawal of treatment", "organ donation", "donor", "brainstem", "bsd"],
  ["obstetric", "postpartum", "pph", "pre eclampsia", "eclampsia", "maternal", "pregnant", "pregnancy"],
  ["rhabdomyolysis", "rhabdo"],
  ["guillain barre", "gbs", "myasthenia", "neuromuscular"],
  ["immunotherapy", "checkpoint inhibitor"],
  ["frailty", "frail"],
  ["intubation", "airway", "difficult airway", "rsi"],
  ["extubation"],
  ["weaning", "slow wean"],
  ["vte", "dvt", "thromboprophylaxis", "anticoagulation", "heparin"],
  ["hypothermia"],
  ["malnutrition", "feeding", "enteral", "parenteral", "tpn", "refeeding"],
  ["transfer", "transport", "repatriation"],
];

const STOP = new Set(("secondary to with without and the for from of on in at to due likely query possible probable known background history " +
  "acute chronic severe mild moderate left right bilateral post pre new old ? patient pt admission review referral ward icu itu hdu " +
  "type grade stage day days hospital unit care critical intensive management requiring required needing needed treated presentation presented " +
  "chase chasing check book booked request requested refer referral discuss discussed repeat send sent call document prescribe start started stop stopped review reviewed today tomorrow tonight morning evening result results report pending await awaiting team plan please").split(" "));

interface Concept { label: string; alts: string[] }

function conceptsFor(text: string): Concept[] {
  const t = ` ${norm(text)} `;
  const out: Concept[] = [];
  const used = new Set<string>();
  for (const g of GROUPS) {
    const hit = g.find((alt) => t.includes(` ${alt} `));
    if (hit) { out.push({ label: g[0], alts: g }); hit.split(" ").forEach((w) => used.add(w)); g.forEach((a) => a.split(" ").forEach((w) => used.add(w))); }
  }
  for (const w of t.trim().split(" ")) {
    if (!w || used.has(w) || STOP.has(w) || w.length < 4 || /^\d+$/.test(w)) continue;
    used.add(w);
    out.push({ label: w, alts: [w] });
  }
  return out;
}

/** Whole-word match for short words and abbreviations; word-start match for longer ones. */
function has(hay: string, alt: string): boolean {
  if (alt.length <= 4) return hay.includes(` ${alt} `);
  return hay.includes(` ${alt}`);
}

export interface GuidelineHit { doc: DeptDoc; score: number; matched: string[] }

export function sourceForWorkplace(workplace?: string): DeptSource | undefined {
  const w = (workplace || "").toLowerCase();
  if (/whipps/.test(w)) return "wx";
  if (/royal london|rlh|accu/.test(w)) return "accu";
  return undefined;
}

export function suggestGuidelines(text: string, opts: { prefer?: DeptSource; limit?: number } = {}): GuidelineHit[] {
  const concepts = conceptsFor(text || "");
  const t = norm(text || "");
  if (!concepts.length) return [];
  const hits: GuidelineHit[] = [];
  for (const d of deptDocs()) {
    if (d.kind === "link" && !d.name) continue;
    const name = ` ${d.nameNorm} `;
    const path = ` ${d.hay.slice(d.nameNorm.length)} `;
    let score = 0;
    let inName = 0;
    const matched: string[] = [];
    for (const c of concepts) {
      if (c.alts.some((a) => has(name, a))) { score += 3; inName++; matched.push(c.label); }
      else if (c.alts.some((a) => has(path, a))) { score += 1; matched.push(c.label); }
    }
    if (!inName) continue;
    if (/\b(guideline|guidelines|protocol|pathway|sop|policy|bundle|algorithm|management)\b/.test(d.nameNorm)) score += 0.5;
    if (opts.prefer && d.src === opts.prefer) score += 1.5;
    if (d.kind === "folder") score += 0.25;
    if (!/\b(paed|paeds|paediatric|child|children|neonat)/.test(t) && /\b(paed|paeds|paediatric|child|children|neonat)/.test(d.hay)) score -= 2;
    if (!/\b(pregnan|obstetric|postpartum|maternal|eclampsia|pph)/.test(t) && /\b(pregnan|obstetric|obs|postpartum|puerper|maternal)/.test(d.hay)) score -= 2;
    if (score < 3) continue;
    hits.push({ doc: d, score, matched });
  }
  hits.sort((a, b) => b.score - a.score || a.doc.name.length - b.doc.name.length);
  const seen = new Set<string>();
  return hits.filter((h) => { const k = `${h.doc.src}|${h.doc.nameNorm}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, opts.limit ?? 8);
}
