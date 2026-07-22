import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { ReviewSummary } from "./domain";
import type { PilotChild } from "./models";
import { creditPresentation, formatDate, formatDateTime } from "./presentation";

interface FinalRecordProjection {
  readonly assessment: {
    readonly observationDate: string;
    readonly ageMonthsAtObservation: number;
    readonly finalizedAt: string | null;
    readonly finalizedBy?: string | null;
  };
  readonly child: PilotChild;
  readonly summary: ReviewSummary;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 46;

function ascii(value: string): string {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "");
}

function wrappedLines(text: string, font: PDFFont, size: number, maximumWidth: number): string[] {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const chunks: string[] = [];
    let chunk = "";
    for (const character of word) {
      const nextChunk = `${chunk}${character}`;
      if (chunk && font.widthOfTextAtSize(nextChunk, size) > maximumWidth) {
        chunks.push(chunk);
        chunk = character;
      } else {
        chunk = nextChunk;
      }
    }
    if (chunk) chunks.push(chunk);
    for (const current of chunks) {
      const next = line ? `${line} ${current}` : current;
      if (font.widthOfTextAtSize(next, size) <= maximumWidth) line = next;
      else {
        if (line) lines.push(line);
        line = current;
      }
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

export async function createFinalRecordPdf(projection: FinalRecordProjection): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage;
  let y = 0;

  function newPage() {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText("HELP AI Crediting Companion", { x: MARGIN, y, font: bold, size: 9, color: rgb(0.04, 0.35, 0.31) });
    y -= 24;
  }

  function ensureSpace(height: number) {
    if (y - height < MARGIN) newPage();
  }

  function line(text: string, options: { bold?: boolean; size?: number; indent?: number; color?: ReturnType<typeof rgb> } = {}) {
    const size = options.size ?? 10;
    const font = options.bold ? bold : regular;
    const indent = options.indent ?? 0;
    const lines = wrappedLines(text, font, size, PAGE_WIDTH - (MARGIN * 2) - indent);
    ensureSpace(lines.length * (size + 4));
    for (const value of lines) {
      page.drawText(value, { x: MARGIN + indent, y, font, size, color: options.color ?? rgb(0.09, 0.19, 0.23) });
      y -= size + 4;
    }
  }

  function gap(points = 8) {
    y -= points;
  }

  newPage();
  line("Final assessment record", { bold: true, size: 22 });
  gap(4);
  line(`${projection.child.externalChildId} | ${projection.assessment.ageMonthsAtObservation} months at observation`);
  line(`Observation: ${formatDate(projection.assessment.observationDate)}`);
  if (projection.assessment.finalizedAt) {
    line(`Confirmed: ${formatDateTime(projection.assessment.finalizedAt)}${projection.assessment.finalizedBy ? ` by ${projection.assessment.finalizedBy}` : ""}`);
  }
  gap(10);
  line("Coverage", { bold: true, size: 14 });
  line(`${projection.summary.coverage.developmentalDomainCount} developmental domains | ${projection.summary.coverage.strandCount} strands | ${projection.summary.coverage.skillCount} included skills`);
  line(`${projection.summary.coverage.regulatorySensorySkillCount} regulatory/sensory skills | ${projection.summary.concernFlags} O concern flags`);
  gap(8);
  line("Credit totals", { bold: true, size: 14 });
  line([
    `Present ${projection.summary.credits.PRESENT}`,
    `Emerging ${projection.summary.credits.EMERGING}`,
    `Not observed ${projection.summary.credits.NOT_OBSERVED}`,
    `Blank ${projection.summary.credits.BLANK}`,
    `N/A ${projection.summary.credits.NOT_APPLICABLE}`,
    `Atypical ${projection.summary.credits.ATYPICAL + projection.summary.credits.ATYPICAL_PLUS + projection.summary.credits.ATYPICAL_MINUS + projection.summary.credits.ATYPICAL_EMERGING}`
  ].join(" | "));
  gap(10);
  line("Final skills", { bold: true, size: 14 });
  gap(2);
  for (const { suggestion, decision } of projection.summary.included) {
    if (!decision.finalCredit) continue;
    ensureSpace(decision.note ? 70 : 48);
    line(`${suggestion.skillCode}  ${suggestion.skillName}`, { bold: true, size: 10 });
    line(`${suggestion.domain}${suggestion.strand ? ` | ${suggestion.strand}` : ""}`, { size: 9, color: rgb(0.3, 0.4, 0.42) });
    line(`Credit: ${creditPresentation[decision.finalCredit].label}${decision.concernFlag ? " + O concern flag" : ""} | Decision: ${decision.origin.replaceAll("_", " ").toLowerCase()}`, { size: 9 });
    if (decision.note) line(`Note: ${decision.note}`, { size: 9, indent: 10 });
    gap(5);
  }
  if (projection.summary.dismissed.length > 0) {
    gap(6);
    line(`Dismissed suggestions: ${projection.summary.dismissed.length}`, { bold: true, size: 11 });
  }

  document.setTitle(`HELP AI Crediting Companion - ${projection.child.externalChildId}`);
  document.setSubject("Human-approved HELP assessment record");
  document.setCreator("HELP AI Crediting Companion");
  return document.save();
}
