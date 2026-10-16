/** Handover sheet as plain text (to paste into Teams / NHSmail) or a PDF. */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getData, bedSort, STATUS_LABEL, Job, fmtStamp, isOverdue } from "./store";

export interface HandoverOpts { ward: string; includeDone: boolean }

function gather(o: HandoverOpts) {
  const d = getData();
  const patients = d.patients.filter((p) => !p.discharged && (o.ward === "all" || p.ward === o.ward)).sort(bedSort);
  const byPatient = patients.map((p) => ({
    p,
    jobs: d.jobs.filter((j) => j.patientId === p.id && !j.followUp && (o.includeDone || j.status !== "done"))
      .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.createdAt - b.createdAt),
  }));
  const pById = new Map(d.patients.map((p) => [p.id, p]));
  const follow = d.jobs.filter((j) => j.followUp && j.status !== "done" && (o.ward === "all" || pById.get(j.patientId)?.ward === o.ward))
    .sort((a, b) => (a.expectedBy || "9999").localeCompare(b.expectedBy || "9999"));
  return { byPatient, follow, pById, me: d.settings.myName || "" };
}

const lastNote = (j: Job) => (j.log.length > 1 ? j.log[j.log.length - 1].text : "");

export function handoverText(o: HandoverOpts): string {
  const { byPatient, follow, pById, me } = gather(o);
  const lines: string[] = [];
  lines.push(`Ward jobs handover – ${o.ward === "all" ? "all wards" : o.ward} – ${fmtStamp(Date.now())}${me ? ` – from ${me}` : ""}`);
  lines.push("");
  for (const { p, jobs } of byPatient) {
    if (!jobs.length) continue;
    lines.push(`${o.ward === "all" ? `${p.ward} ` : ""}Bed ${p.bed} – ${p.initials}${p.summary ? ` – ${p.summary}` : ""}`);
    for (const j of jobs) {
      const tag = j.status === "done" ? "[x]" : j.priority === "Urgent" ? "[!]" : "[ ]";
      const extra = [j.status !== "todo" && j.status !== "done" ? STATUS_LABEL[j.status] : "", j.dueTime ? `by ${j.dueTime}${isOverdue(j) ? " OVERDUE" : ""}` : "", j.assignee ? `→ ${j.assignee}` : "", lastNote(j)].filter(Boolean).join("; ");
      lines.push(`  ${tag} ${j.text}${extra ? ` (${extra})` : ""}`);
    }
    lines.push("");
  }
  if (follow.length) {
    lines.push("FOLLOW-UP (awaiting results)");
    for (const j of follow) {
      const p = pById.get(j.patientId);
      lines.push(`  • ${p ? `${p.ward} Bed ${p.bed} ${p.initials}${p.discharged ? " (discharged)" : ""}` : "?"}: ${j.text}${j.expectedBy ? ` – expected ${j.expectedBy}${isOverdue(j) ? " OVERDUE" : ""}` : ""}${lastNote(j) ? ` – ${lastNote(j)}` : ""}`);
    }
  }
  return lines.join("\n").trim();
}

export function handoverPdf(o: HandoverOpts): Blob {
  const { byPatient, follow, pById, me } = gather(o);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 36;
  doc.setFont("helvetica", "bold").setFontSize(16).text(`Ward jobs handover – ${o.ward === "all" ? "all wards" : o.ward}`, M, 48);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100).text(`${fmtStamp(Date.now())}${me ? `  ·  from ${me}` : ""}`, M, 64);
  const rows: any[] = [];
  for (const { p, jobs } of byPatient) {
    if (!jobs.length) continue;
    jobs.forEach((j, i) => rows.push([
      i === 0 ? `${o.ward === "all" ? `${p.ward} ` : ""}Bed ${p.bed}\n${p.initials}${p.summary ? `\n${p.summary}` : ""}` : "",
      `${j.priority === "Urgent" ? "URGENT: " : ""}${j.text}`,
      j.status === "done" ? `Done ${j.doneBy || ""}` : STATUS_LABEL[j.status] + (j.dueTime ? `\nby ${j.dueTime}` : ""),
      [j.assignee, lastNote(j)].filter(Boolean).join("\n"),
      "",
    ]));
  }
  autoTable(doc, {
    startY: 78,
    head: [["Patient", "Job", "Status", "Owner / latest", "Done"]],
    body: rows,
    theme: "grid",
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 4, valign: "top" },
    headStyles: { fillColor: [55, 71, 79] },
    columnStyles: { 0: { cellWidth: 90, fontStyle: "bold" }, 2: { cellWidth: 70 }, 3: { cellWidth: 110 }, 4: { cellWidth: 34 } },
  });
  if (follow.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 24,
      head: [["Follow-up (locked)", "Awaiting", "Expected", "Latest"]],
      body: follow.map((j) => {
        const p = pById.get(j.patientId);
        return [p ? `${p.ward} Bed ${p.bed} ${p.initials}${p.discharged ? " (d/c)" : ""}` : "?", j.text, j.expectedBy ? `${j.expectedBy}${isOverdue(j) ? " OVERDUE" : ""}` : "", lastNote(j)];
      }),
      theme: "grid",
      margin: { left: M, right: M },
      styles: { fontSize: 9, cellPadding: 4, valign: "top" },
      headStyles: { fillColor: [123, 92, 205] },
    });
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(120).text("Confidential – contains patient information. Dispose of securely.", M, doc.internal.pageSize.getHeight() - 16);
  }
  return doc.output("blob");
}
