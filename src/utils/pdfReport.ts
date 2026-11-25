import { jsPDF } from 'jspdf';
import type {
  DoctorRecommendation,
  Hba1cRecord,
  PatientPrivatePii,
  PatientProfile,
} from '../types';
import { analyzeHbA1cTrend, evaluateHbA1cEligibility } from './clinicalAnalytics';

export interface GeneratePdfParams {
  profile: PatientProfile;
  pii: PatientPrivatePii | null;
  records: Hba1cRecord[];
  recommendations: DoctorRecommendation[];
}

const REMISSION_STAGE_EN: Record<PatientProfile['remissionStage'], string> = {
  sustained_remission: 'Sustained DM Remission (>= 3 Months)',
  in_remission: 'In DM Remission (< 6.5%)',
  improving: 'Improving Glycemic Control',
  active_dm: 'Active Diabetes Management',
};

const ECLAIM_EN: Record<Hba1cRecord['eClaimStatus'], string> = {
  synced: 'Synced (43-File)',
  pending: 'Pending',
  rep_error: 'REP Error',
  late_submission: 'Late (>30d)',
};

function hasNonLatin1(text: string): boolean {
  return /[^\u0000-\u00FF]/.test(text);
}

interface DrawTextOptions {
  fontSizePt?: number;
  bold?: boolean;
  color?: string;
  maxWidthMm?: number;
  align?: 'left' | 'right';
}

/**
 * Renders ASCII/Latin-1 natively with jsPDF vector text and safely rasterizes
 * Thai/Unicode text via high-DPI offscreen Canvas to prevent mojibake glyphs.
 * Returns the vertical height consumed in mm.
 */
function drawSmartText(
  doc: jsPDF,
  text: string,
  xMm: number,
  yMm: number,
  options: DrawTextOptions = {}
): number {
  const {
    fontSizePt = 10,
    bold = false,
    color = '#0F172A',
    maxWidthMm = 175,
    align = 'left',
  } = options;

  const clean = (text || '').trim();
  if (!clean) return 0;

  const lineHeightMm = fontSizePt * 0.45;

  if (!hasNonLatin1(clean) || typeof document === 'undefined') {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSizePt);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(clean, maxWidthMm) as string[];
    lines.forEach((line, idx) => {
      doc.text(line, xMm, yMm + idx * lineHeightMm, { align });
    });
    return lines.length * lineHeightMm;
  }

  // High-DPI Canvas rendering for Thai / Unicode strings
  const pxPerMm = 3.7795275591;
  const scale = 3;
  const fontPx = fontSizePt * 1.3333;
  const maxWidthPx = maxWidthMm * pxPerMm;

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) {
    doc.text(clean, xMm, yMm, { align });
    return lineHeightMm;
  }

  const fontSpec = `${bold ? '600' : '400'} ${fontPx}px "IBM Plex Sans Thai", "Plus Jakarta Sans", "Noto Sans Thai", sans-serif`;
  mCtx.font = fontSpec;

  // Wrap text by spaces or character chunks for Thai prose
  const wrappedLines: string[] = [];
  let currentLine = '';
  const tokens = clean.split(/(\s+)/);
  for (const token of tokens) {
    const candidate = currentLine + token;
    if (mCtx.measureText(candidate).width <= maxWidthPx || currentLine.length === 0) {
      if (mCtx.measureText(candidate).width > maxWidthPx) {
        // Split long Thai token character by character
        for (const ch of token) {
          if (mCtx.measureText(currentLine + ch).width > maxWidthPx && currentLine.length > 0) {
            wrappedLines.push(currentLine.trimEnd());
            currentLine = ch;
          } else {
            currentLine += ch;
          }
        }
      } else {
        currentLine = candidate;
      }
    } else {
      wrappedLines.push(currentLine.trimEnd());
      currentLine = token.trimStart();
    }
  }
  if (currentLine.trim().length > 0) {
    wrappedLines.push(currentLine.trim());
  }

  const lineHeightPx = fontPx * 1.42;
  const maxMeasuredPx = Math.max(
    10,
    ...wrappedLines.map((l) => Math.ceil(mCtx.measureText(l).width))
  );
  const canvasW = Math.min(Math.ceil(maxWidthPx) + 4, maxMeasuredPx + 6);
  const canvasH = Math.max(12, Math.ceil(wrappedLines.length * lineHeightPx + 4));

  const canvas = document.createElement('canvas');
  canvas.width = canvasW * scale;
  canvas.height = canvasH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return lineHeightMm;

  ctx.scale(scale, scale);
  ctx.font = fontSpec;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  wrappedLines.forEach((line, idx) => {
    ctx.fillText(line, 0, idx * lineHeightPx + 1);
  });

  const widthMm = canvasW / pxPerMm;
  const heightMm = canvasH / pxPerMm;
  const drawX = align === 'right' ? xMm - widthMm : xMm;
  const drawY = yMm - fontSizePt * 0.3;

  doc.addImage(canvas.toDataURL('image/png'), 'PNG', drawX, drawY, widthMm, heightMm);
  return wrappedLines.length * lineHeightMm;
}

export function generateHba1cSummaryPdf({
  profile,
  pii,
  records,
  recommendations,
}: GeneratePdfParams): { filename: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 16;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > 276) {
      doc.addPage();
      y = 18;
    }
  };

  const sortedRecords = [...records].sort((a, b) => a.testDate.localeCompare(b.testDate));
  const trend = analyzeHbA1cTrend(sortedRecords, profile.medsFreeMonths);
  const eligibility = evaluateHbA1cEligibility(sortedRecords);
  const generatedStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // Header
  doc.setFillColor(13, 148, 136);
  doc.rect(margin, y - 5, 3, 12, 'F');
  drawSmartText(doc, 'RemissionCare', margin + 6, y, {
    fontSizePt: 16,
    bold: true,
    color: '#0F172A',
  });
  drawSmartText(doc, 'DM Remission, HbA1c History & Medication-Free Progress Report', margin + 6, y + 5.5, {
    fontSizePt: 9,
    color: '#475569',
  });
  drawSmartText(doc, `Generated: ${generatedStamp}`, pageWidth - margin, y, {
    fontSizePt: 8.5,
    color: '#64748B',
    align: 'right',
  });

  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Patient Profile Summary Block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 28, 2.5, 2.5, 'FD');

  drawSmartText(doc, 'Patient:', margin + 4, y + 6, { fontSizePt: 8.5, color: '#64748B' });
  drawSmartText(doc, profile.displayName, margin + 20, y + 6, {
    fontSizePt: 9.5,
    bold: true,
    maxWidthMm: 78,
  });

  drawSmartText(doc, 'CID (Masked):', margin + 102, y + 6, { fontSizePt: 8.5, color: '#64748B' });
  drawSmartText(doc, pii?.cidMasked || 'N/A', margin + 127, y + 6, {
    fontSizePt: 9,
    bold: true,
    maxWidthMm: 46,
  });

  drawSmartText(doc, 'Clinic:', margin + 4, y + 13, { fontSizePt: 8.5, color: '#64748B' });
  drawSmartText(doc, profile.clinicName || '-', margin + 20, y + 13, {
    fontSizePt: 8.5,
    maxWidthMm: 78,
  });

  drawSmartText(doc, 'Physician:', margin + 102, y + 13, { fontSizePt: 8.5, color: '#64748B' });
  drawSmartText(doc, profile.attendingDoctor || '-', margin + 127, y + 13, {
    fontSizePt: 8.5,
    maxWidthMm: 46,
  });

  drawSmartText(
    doc,
    `Diagnosis: ICD-10 ${profile.icd10Code}  |  Type Area ${profile.typeArea}  |  Scheme: ${pii?.insuranceScheme || 'UCS'}  |  Activity Code: ${profile.activityCode120 ? '120 (Special PP)' : 'Standard'}`,
    margin + 4,
    y + 21.5,
    { fontSizePt: 8, color: '#475569', maxWidthMm: contentWidth - 8 }
  );

  y += 34;

  // 4 Key Clinical Metric Cards
  const cardGap = 3.5;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const cardH = 21;

  const cards = [
    {
      label: 'Latest HbA1c',
      value: trend.latestValue !== null ? `${trend.latestValue.toFixed(1)}%` : '--',
      sub: `Target < ${profile.targetHba1c.toFixed(1)}%`,
      accent: trend.latestValue !== null && trend.latestValue < 6.5 ? '#0D9488' : '#D97706',
    },
    {
      label: 'Baseline Change',
      value:
        trend.overallDelta !== null
          ? `${trend.overallDelta > 0 ? '+' : ''}${trend.overallDelta.toFixed(1)}%`
          : '--',
      sub: sortedRecords.length > 1 ? `From ${sortedRecords[0].value.toFixed(1)}%` : 'Single test',
      accent: trend.overallDelta !== null && trend.overallDelta <= 0 ? '#16A34A' : '#DC2626',
    },
    {
      label: 'Medication-Free',
      value: `${profile.medsFreeMonths} mo`,
      sub: profile.medsFreeMonths >= 3 ? 'Sustained >= 3 mo' : 'Goal: 3-6 months',
      accent: '#0F172A',
    },
    {
      label: '90-Day Lab Quota',
      value: `${eligibility.testsInCurrentFiscalYear} / ${eligibility.maxTestsPerFiscalYear}`,
      sub: eligibility.isEligibleNow ? 'Eligible now' : `Wait ${eligibility.daysRemainingToWait}d`,
      accent: '#0F172A',
    },
  ];

  cards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');
    drawSmartText(doc, c.label, cx + 3.5, y + 5.5, { fontSizePt: 7.5, color: '#64748B' });
    drawSmartText(doc, c.value, cx + 3.5, y + 12.5, {
      fontSizePt: 12.5,
      bold: true,
      color: c.accent,
    });
    drawSmartText(doc, c.sub, cx + 3.5, y + 18, { fontSizePt: 7.2, color: '#64748B' });
  });

  y += cardH + 7;

  // Medication-Free Remission Progress Bar
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  drawSmartText(doc, 'Medication-Free Remission Progress', margin + 4, y + 6, {
    fontSizePt: 9.5,
    bold: true,
  });
  drawSmartText(doc, REMISSION_STAGE_EN[trend.computedStage], pageWidth - margin - 4, y + 6, {
    fontSizePt: 8.5,
    bold: true,
    color: '#0D9488',
    align: 'right',
  });

  const barX = margin + 4;
  const barY = y + 10.5;
  const barW = contentWidth - 8;
  const barH = 4;
  const progressRatio = Math.min(1, Math.max(0, profile.medsFreeMonths / 6));

  doc.setFillColor(226, 232, 240);
  doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'F');
  if (progressRatio > 0) {
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(barX, barY, Math.max(4, barW * progressRatio), barH, 1.5, 1.5, 'F');
  }
  drawSmartText(
    doc,
    `0 mo          3 mo (Sustained Remission Milestone)          6+ mo (${profile.medsFreeMonths} months achieved)`,
    barX,
    y + 20,
    { fontSizePt: 7.5, color: '#64748B' }
  );

  y += 30;

  // Vector HbA1c Trend Chart (when >= 1 record exists)
  if (sortedRecords.length > 0) {
    ensureSpace(58);
    drawSmartText(doc, 'HbA1c Longitudinal Trend (%)', margin, y, {
      fontSizePt: 10.5,
      bold: true,
    });
    y += 4;

    const chartX = margin;
    const chartY = y;
    const chartW = contentWidth;
    const chartH = 44;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(chartX, chartY, chartW, chartH, 2, 2, 'FD');

    const plotLeft = chartX + 14;
    const plotRight = chartX + chartW - 8;
    const plotTop = chartY + 6;
    const plotBottom = chartY + chartH - 10;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    const minY = 4.5;
    const maxY = Math.max(9.0, ...sortedRecords.map((r) => Math.ceil(r.value + 0.5)));

    const valToY = (v: number) =>
      plotBottom - ((Math.max(minY, Math.min(maxY, v)) - minY) / (maxY - minY)) * plotH;

    // Shaded < 6.5% Remission zone
    const y65 = valToY(6.5);
    doc.setFillColor(236, 253, 245);
    doc.rect(plotLeft, y65, plotW, plotBottom - y65, 'F');

    // Threshold line at 6.5%
    doc.setDrawColor(13, 148, 136);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(plotLeft, y65, plotRight, y65);
    doc.setLineDashPattern([], 0);
    drawSmartText(doc, '6.5%', plotLeft - 2, y65 + 1, {
      fontSizePt: 7,
      color: '#0F766E',
      align: 'right',
    });

    // Plot line & points
    const pts = sortedRecords.map((r, i) => ({
      rec: r,
      px: sortedRecords.length === 1 ? plotLeft + plotW / 2 : plotLeft + (i / (sortedRecords.length - 1)) * plotW,
      py: valToY(r.value),
    }));

    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.6);
    for (let i = 1; i < pts.length; i += 1) {
      doc.line(pts[i - 1].px, pts[i - 1].py, pts[i].px, pts[i].py);
    }
    doc.setLineWidth(0.2);

    pts.forEach(({ rec, px, py }) => {
      if (rec.value < 6.5) doc.setFillColor(13, 148, 136);
      else if (rec.value < 7.5) doc.setFillColor(217, 119, 6);
      else doc.setFillColor(220, 38, 38);

      doc.circle(px, py, 1.4, 'F');
      drawSmartText(doc, `${rec.value.toFixed(1)}%`, px - 3, py - 2.6, {
        fontSizePt: 7,
        bold: true,
        color: '#0F172A',
      });
      drawSmartText(doc, rec.testDate, px - 6, plotBottom + 5, {
        fontSizePt: 6.5,
        color: '#64748B',
      });
    });

    y = chartY + chartH + 8;
  }

  // Clinical Analysis Summary
  ensureSpace(22);
  drawSmartText(doc, 'Clinical Trend Analysis', margin, y, { fontSizePt: 10.5, bold: true });
  y += 5;
  const h1 = drawSmartText(doc, trend.clinicalSummaryTh, margin, y, {
    fontSizePt: 8.8,
    color: '#334155',
    maxWidthMm: contentWidth,
  });
  y += h1 + 2;
  const h2 = drawSmartText(doc, trend.recommendedActionTh, margin, y, {
    fontSizePt: 8.3,
    color: '#475569',
    maxWidthMm: contentWidth,
  });
  y += h2 + 6;

  // HbA1c History Table
  ensureSpace(24);
  drawSmartText(doc, `HbA1c Laboratory History (${sortedRecords.length} records)`, margin, y, {
    fontSizePt: 10.5,
    bold: true,
  });
  y += 4;

  const colX = [margin + 2, margin + 27, margin + 45, margin + 64, margin + 82, margin + 104, margin + 134];
  const renderTableHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    const headers = ['Date', 'HbA1c', 'LOINC', 'ICD-10', 'Activity', 'e-Claim', 'Facility'];
    headers.forEach((h, i) => {
      drawSmartText(doc, h, colX[i], y + 4.8, { fontSizePt: 7.8, bold: true, color: '#334155' });
    });
    y += 8.5;
  };

  renderTableHeader();

  if (sortedRecords.length === 0) {
    drawSmartText(doc, 'No HbA1c laboratory records recorded yet.', margin + 2, y + 3, {
      fontSizePt: 8.5,
      color: '#64748B',
    });
    y += 9;
  } else {
    [...sortedRecords].reverse().forEach((rec, idx) => {
      if (y + 8 > 274) {
        doc.addPage();
        y = 18;
        renderTableHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 3.2, contentWidth, 6.5, 'F');
      }
      drawSmartText(doc, rec.testDate, colX[0], y + 1, { fontSizePt: 8, color: '#0F172A' });
      drawSmartText(doc, `${rec.value.toFixed(1)}%`, colX[1], y + 1, {
        fontSizePt: 8,
        bold: true,
        color: rec.value < 6.5 ? '#0D9488' : '#D97706',
      });
      drawSmartText(doc, rec.loincCode, colX[2], y + 1, { fontSizePt: 8, color: '#475569' });
      drawSmartText(doc, rec.icd10Code, colX[3], y + 1, { fontSizePt: 8, color: '#475569' });
      drawSmartText(doc, rec.activityCode === '120' ? 'Code 120' : 'Standard', colX[4], y + 1, {
        fontSizePt: 8,
        color: '#475569',
      });
      drawSmartText(doc, ECLAIM_EN[rec.eClaimStatus], colX[5], y + 1, {
        fontSizePt: 8,
        color: '#475569',
      });
      drawSmartText(doc, rec.facilityName, colX[6], y + 1, {
        fontSizePt: 7.8,
        color: '#334155',
        maxWidthMm: pageWidth - margin - colX[6] - 1,
      });
      y += 6.8;
    });
  }

  y += 6;

  // Physician Recommendations Section
  ensureSpace(22);
  drawSmartText(doc, `Physician Recommendations (${recommendations.length})`, margin, y, {
    fontSizePt: 10.5,
    bold: true,
  });
  y += 5;

  if (recommendations.length === 0) {
    drawSmartText(doc, 'No physician recommendations recorded.', margin, y, {
      fontSizePt: 8.5,
      color: '#64748B',
    });
  } else {
    const sortedRecs = [...recommendations].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate));
    sortedRecs.slice(0, 6).forEach((rec) => {
      ensureSpace(20);
      const titleHeight = drawSmartText(doc, rec.title, margin + 3, y + 3, {
        fontSizePt: 9,
        bold: true,
        maxWidthMm: contentWidth - 45,
      });
      drawSmartText(
        doc,
        `${rec.issuedDate} | ${rec.acknowledged ? 'Acknowledged' : 'Pending'}`,
        pageWidth - margin - 2,
        y + 3,
        { fontSizePt: 7.5, color: '#64748B', align: 'right' }
      );
      const metaY = y + 3 + Math.max(4, titleHeight);
      const docHeight = drawSmartText(doc, rec.doctorName, margin + 3, metaY, {
        fontSizePt: 7.8,
        color: '#0D9488',
        maxWidthMm: contentWidth - 6,
      });
      const adviceY = metaY + Math.max(4, docHeight) + 0.5;
      const adviceHeight = drawSmartText(doc, rec.advice, margin + 3, adviceY, {
        fontSizePt: 8.2,
        color: '#334155',
        maxWidthMm: contentWidth - 6,
      });

      const boxH = adviceY - y + Math.max(4, adviceHeight) + 2;
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y - 1, contentWidth, boxH, 1.5, 1.5, 'S');
      y += boxH + 3.5;
    });
  }

  // Page Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 284, pageWidth - margin, 284);
    drawSmartText(
      doc,
      'Confidential Patient Health Summary · RemissionCare Cloud Platform',
      margin,
      289,
      { fontSizePt: 7.5, color: '#64748B' }
    );
    drawSmartText(doc, `Page ${p} of ${totalPages}`, pageWidth - margin, 289, {
      fontSizePt: 7.5,
      color: '#64748B',
      align: 'right',
    });
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `RemissionCare_HbA1c_Report_${dateStamp}.pdf`;
  doc.save(filename);
  return { filename };
}
