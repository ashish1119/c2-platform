import type { TelecomRecord } from "../model";

export function exportCSV(records: TelecomRecord[], filename = "telecom_intelligence.csv") {
  const headers = [
    "Date Time", "MSISDN", "Target", "Type", "Duration (s)",
    "Start Time", "End Time", "Place", "Latitude", "Longitude",
    "Operator", "Network", "Band", "RAN", "Mode",
    "IMSI", "IMEI", "Device Model", "Country",
    "SMS Status", "Fake", "Silent Call Type",
  ];

  const rows = records.map((r) => [
    r.dateTime, r.msisdn, r.target, r.callType, r.duration,
    r.startTime, r.endTime, r.place, r.latitude, r.longitude,
    r.operator, r.network, r.band, r.ran, r.mode,
    r.imsi, r.imei, r.deviceModel, r.country,
    r.smsStatus ?? "", r.fake ? "Yes" : "No", r.silentCallType,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Logo loader — cached promise so we only fetch once per session ────────────
let _logoDataUrl: string | null = null;
let _logoPromise: Promise<string | null> | null = null;

function loadLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrl) return Promise.resolve(_logoDataUrl);
  if (_logoPromise) return _logoPromise;

  _logoPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        _logoDataUrl = canvas.toDataURL("image/png");
        resolve(_logoDataUrl);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    // Try public path first, fall back to root-relative
    img.src = "/dynaspede_logo.png";
  });

  return _logoPromise;
}

// ── Watermark — translate to center FIRST, then rotate, draw at (0,0) ────────
// This mirrors the ReportLab pattern exactly:
//   canvas.translate(w/2, h/2) → canvas.rotate(45) → drawCentredString(0, 0, ...)
// In jsPDF we achieve this with raw PDF stream operators via doc.internal.write().
function addWatermark(doc: any, pageWidth: number, pageHeight: number) {
  // jsPDF works in mm; PDF stream operators work in pt (1mm = 72/25.4 pt)
  const mmToPt = 72 / 25.4;
  const cxPt   = (pageWidth  / 2) * mmToPt;
  const cyPt   = (pageHeight / 2) * mmToPt;

  // Rotation angle: 45° CCW
  const rad  = 45 * (Math.PI / 180);
  const cosA = Math.cos(rad);   //  0.7071
  const sinA = Math.sin(rad);   //  0.7071

  // PDF CTM for "translate to center then rotate 45°":
  //   [cos  sin  -sin  cos  tx  ty]
  const a = cosA, b = sinA, c = -sinA, d = cosA;

  // GState opacity — 0.25 keeps it visible but non-distracting
  try {
    doc.setGState(new (doc.GState as any)({ opacity: 0.25, "stroke-opacity": 0.25 }));
  } catch { /* older jsPDF — color lightness handles subtlety */ }

  // Write raw PDF operators:
  //   q          → save graphics state
  //   <cm>       → set current transformation matrix (translate + rotate)
  //   BT         → begin text
  //   /F1 65 Tf  → Helvetica-Bold 65pt  (F1 is jsPDF's internal Helvetica ref)
  //   0.7 0.7 0.7 rg  → fill color #B2B2B2
  //   <Td>       → move text position to (0, 0) — already at page center after cm
  //   (CONFIDENTIAL) Tj  → draw text
  //   ET         → end text
  //   Q          → restore graphics state
  doc.internal.write(
    "q",
    `${a.toFixed(6)} ${b.toFixed(6)} ${c.toFixed(6)} ${d.toFixed(6)} ${cxPt.toFixed(4)} ${cyPt.toFixed(4)} cm`,
    "BT",
    "/F1 65 Tf",
    "0.7 0.7 0.7 rg",
  );

  // Measure text width in pt so we can shift left by half → true centering at (0,0)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(65);
  const textWidthMm = doc.getTextWidth("CONFIDENTIAL");
  const halfWidthPt = (textWidthMm * mmToPt) / 2;
  // Approximate cap-height for vertical centering: ~70% of font size in pt
  const halfHeightPt = (65 * 0.70) / 2;

  doc.internal.write(
    `${(-halfWidthPt).toFixed(4)} ${(-halfHeightPt).toFixed(4)} Td`,
    "(CONFIDENTIAL) Tj",
    "ET",
    "Q",
  );

  // Reset jsPDF's own state so subsequent calls are unaffected
  try {
    doc.setGState(new (doc.GState as any)({ opacity: 1, "stroke-opacity": 1 }));
  } catch { /* ignore */ }
  doc.setTextColor(0, 0, 0);
}

// ── Logo — drawn via canvas.drawImage pattern (works on every page) ──────────
function addLogo(doc: any, logoDataUrl: string) {
  // Top-left: x=14, y=8, width=40mm, height=12mm
  doc.addImage(logoDataUrl, "PNG", 14, 8, 40, 12);
}

// ── Full page header: watermark first (behind), then logo + title on top ─────
function drawPageHeader(
  doc: any,
  pageWidth: number,
  pageHeight: number,
  logoDataUrl: string | null,
  records: number,
  isFirstPage: boolean,
) {
  // 1. Watermark (drawn first so content sits on top)
  addWatermark(doc, pageWidth, pageHeight);

  // 2. Logo on every page
  if (logoDataUrl) {
    addLogo(doc, logoDataUrl);
  }

  // 3. Title + meta only on page 1 (subsequent pages just get logo + watermark)
  if (isFirstPage) {
    const textX = logoDataUrl ? 14 + 40 + 6 : 14;

    doc.setFontSize(15);
    doc.setTextColor(17, 193, 202);
    doc.setFont("helvetica", "bold");
    doc.text("Cellular Interception Report", textX, 13);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated: ${new Date().toLocaleString("en-IN")}  |  Records: ${records}`,
      textX, 19,
    );
  }

  // 4. Separator line
  doc.setDrawColor(17, 193, 202);
  doc.setLineWidth(0.3);
  doc.line(14, 25, pageWidth - 14, 25);

  // Reset draw color
  doc.setDrawColor(0, 0, 0);
}

export async function exportPDF(records: TelecomRecord[], filename = "telecom_intelligence.pdf") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Load logo once (cached after first call)
  const logoDataUrl = await loadLogoDataUrl();

  // Track whether didDrawPage is firing for page 1
  let pageIndex = 0;

  // ── Table (didDrawPage handles header + watermark on EVERY page) ──────────
  autoTable(doc, {
    startY: 29,   // below the header drawn by didDrawPage
    head: [["Date/Time", "MSISDN", "Target", "Type", "Duration", "Place", "Operator", "Network", "Fake", "Silent"]],
    body: records.map((r) => [
      new Date(r.startTime).toLocaleString("en-IN"),
      r.msisdn,
      r.target || "—",
      r.callType,
      `${Math.floor(r.duration / 60)}m ${r.duration % 60}s`,
      r.place || "—",
      r.operator,
      r.network,
      r.fake ? "YES" : "No",
      r.silentCallType,
    ]),
    styles:              { fontSize: 8, cellPadding: 2 },
    headStyles:          { fillColor: [17, 193, 202], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles:  { fillColor: [245, 248, 255] },
    margin:              { top: 29 },   // keep table below header on every page

    // ── This fires for EVERY page (including page 1) ──────────────────────
    didDrawPage: () => {
      drawPageHeader(doc, pageWidth, pageHeight, logoDataUrl, records.length, pageIndex === 0);
      pageIndex++;
    },

    didParseCell: (data: any) => {
      if (data.section === "body") {
        const row = records[data.row.index];
        if (row?.fake || row?.silentCallType === "Spy") {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  doc.save(filename);
}

// ── Analytics PDF types ───────────────────────────────────────────────────────

export interface AnalyticsPDFPayload {
  // KPIs
  totalCalls: number;
  totalSMS: number;
  uniqueContacts: number;
  suspiciousCount: number;
  totalDurationSec: number;
  // Filter context
  msisdn?: string;
  dateFrom?: string;
  dateTo?: string;
  dataMode: string;
  recordCount: number;
  // Extended KPIs
  avgDurationSec: number;
  mostActiveOperator: string;
  mostUsedNetwork: string;
  suspiciousPct: string;
  uniqueLocations: number;
  nightActivityCount: number;
  peakHour: number | null;
  peakHourCount: number;
  mostContactedNumber: string;
  mostContactedCount: number;
  // Chart data
  dailyVolume: { date: string; calls: number; sms: number; total: number }[];
  callTypeDist: { name: string; value: number; pct: string }[];
  operatorDist: { name: string; value: number; pct: string }[];
  topContacts: { target: string; count: number; totalDuration: number; suspicious: boolean }[];
  durationTrend: { time: string; duration: number; suspicious: boolean }[];
  // Insights
  insights: { id: string; level: string; title: string; detail: string }[];
  // Geo
  cities: string[];
}

function fmtSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

export async function exportAnalyticsPDF(
  payload: AnalyticsPDFPayload,
  filename = "telecom_analytics_report.pdf",
) {
  const { jsPDF } = await import("jspdf");
  const autoTable  = (await import("jspdf-autotable")).default;

  const doc        = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();

  // ── Shared page-header helper (reuses existing drawPageHeader) ────────────
  let pageIndex = 0;
  const stampHeader = (isFirst: boolean) => {
    addWatermark(doc, pageWidth, pageHeight);
    if (logoDataUrl) addLogo(doc, logoDataUrl);

    if (isFirst) {
      const tx = logoDataUrl ? 60 : 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(17, 193, 202);
      doc.text("Cellular Interception Analytics Report", tx, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const meta: string[] = [
        `Generated: ${new Date().toLocaleString("en-IN")}`,
        `Records: ${payload.recordCount}`,
      ];
      if (payload.msisdn)  meta.push(`MSISDN: ${payload.msisdn}`);
      if (payload.dateFrom) meta.push(`From: ${payload.dateFrom}`);
      if (payload.dateTo)   meta.push(`To: ${payload.dateTo}`);
      doc.text(meta.join("  |  "), tx, 19);
    }

    doc.setDrawColor(17, 193, 202);
    doc.setLineWidth(0.3);
    doc.line(14, 25, pageWidth - 14, 25);
    doc.setDrawColor(0, 0, 0);
  };

  // ── Helper: section title ─────────────────────────────────────────────────
  const sectionTitle = (text: string, y: number): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 193, 202);
    doc.text(text, 14, y);
    doc.setDrawColor(17, 193, 202);
    doc.setLineWidth(0.2);
    doc.line(14, y + 1.5, pageWidth - 14, y + 1.5);
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);
    return y + 6;
  };

  // ── Helper: KPI box ───────────────────────────────────────────────────────
  const kpiBox = (
    label: string, value: string,
    x: number, y: number, w: number, h: number,
    accent: [number, number, number],
  ) => {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, h, 2, 2, "S");
    // Bottom accent bar
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.roundedRect(x, y + h - 1.5, w, 1.5, 0.5, 0.5, "F");
    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + w / 2, y + 5, { align: "center" });
    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(value, x + w / 2, y + 12, { align: "center" });
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Header + KPI Summary + Extended Metrics
  // ═══════════════════════════════════════════════════════════════════════════
  stampHeader(true);
  pageIndex++;

  let curY = 30;

  // ── 1. KPI Summary cards ──────────────────────────────────────────────────
  curY = sectionTitle("1. OVERVIEW SUMMARY", curY);

  const kpiBoxW = (pageWidth - 28 - 16) / 5;
  const kpiBoxH = 18;
  const kpiItems: [string, string, [number, number, number]][] = [
    ["TOTAL CALLS",    String(payload.totalCalls),                    [59, 130, 246]],
    ["TOTAL SMS",      String(payload.totalSMS),                      [17, 193, 202]],
    ["UNIQUE CONTACTS",String(payload.uniqueContacts),                [34, 197, 94]],
    ["SUSPICIOUS",     String(payload.suspiciousCount),               [239, 68, 68]],
    ["TOTAL DURATION", fmtSec(payload.totalDurationSec),              [245, 158, 11]],
  ];
  kpiItems.forEach(([label, value, accent], i) => {
    kpiBox(label, value, 14 + i * (kpiBoxW + 4), curY, kpiBoxW, kpiBoxH, accent);
  });
  curY += kpiBoxH + 8;

  // ── 2. Extended metrics table ─────────────────────────────────────────────
  curY = sectionTitle("2. BEHAVIORAL METRICS", curY);

  autoTable(doc, {
    startY: curY,
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Avg Duration",      fmtSec(payload.avgDurationSec),   "Peak Hour",         payload.peakHour !== null ? `${payload.peakHour}:00 (${payload.peakHourCount} calls)` : "—"],
      ["Top Operator",      payload.mostActiveOperator,        "Top Network",       payload.mostUsedNetwork],
      ["Suspicious %",      `${payload.suspiciousPct}%`,       "Unique Locations",  String(payload.uniqueLocations)],
      ["Night Activity",    String(payload.nightActivityCount), "Most Contacted",    payload.mostContactedNumber !== "—" ? `${payload.mostContactedNumber} (${payload.mostContactedCount})` : "—"],
    ],
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [17, 193, 202], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => { stampHeader(pageIndex === 0); pageIndex++; },
  });
  curY = (doc as any).lastAutoTable.finalY + 8;

  // ── 3. Call Volume by Day ─────────────────────────────────────────────────
  if (payload.dailyVolume.length > 0) {
    if (curY > pageHeight - 60) { doc.addPage(); stampHeader(false); pageIndex++; curY = 30; }
    curY = sectionTitle("3. CALL FREQUENCY BY DATE", curY);

    autoTable(doc, {
      startY: curY,
      head: [["Date", "Calls", "SMS", "Total", "Duration (s)"]],
      body: payload.dailyVolume.map((d) => [d.date, d.calls, d.sms, d.total, d.duration]),
      styles:     { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => { stampHeader(false); pageIndex++; },
    });
    curY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Distribution tables + Top Contacts
  // ═══════════════════════════════════════════════════════════════════════════
  if (curY > pageHeight - 80) { doc.addPage(); stampHeader(false); pageIndex++; curY = 30; }

  // ── 4. Call Type Distribution ─────────────────────────────────────────────
  curY = sectionTitle("4. CALL TYPE DISTRIBUTION", curY);
  autoTable(doc, {
    startY: curY,
    head: [["Call Type", "Count", "Percentage"]],
    body: payload.callTypeDist.map((d) => [d.name, d.value, `${d.pct}%`]),
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [17, 193, 202], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    margin: { left: 14, right: 14 },
    tableWidth: (pageWidth - 28) / 2 - 4,
    didDrawPage: () => { stampHeader(false); pageIndex++; },
  });
  const afterCallType = (doc as any).lastAutoTable.finalY;

  // ── 5. Operator Distribution (side by side) ───────────────────────────────
  const opStartY = curY;
  autoTable(doc, {
    startY: opStartY,
    head: [["Operator", "Count", "Percentage"]],
    body: payload.operatorDist.slice(0, 10).map((d) => [d.name, d.value, `${d.pct}%`]),
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    margin: { left: pageWidth / 2 + 2, right: 14 },
    tableWidth: (pageWidth - 28) / 2 - 4,
    didDrawPage: () => { stampHeader(false); pageIndex++; },
  });
  curY = Math.max(afterCallType, (doc as any).lastAutoTable.finalY) + 8;

  // ── 6. Top 6 High Frequency Contacts ─────────────────────────────────────
  if (curY > pageHeight - 60) { doc.addPage(); stampHeader(false); pageIndex++; curY = 30; }
  curY = sectionTitle("5. TOP HIGH FREQUENCY CONTACTS", curY);

  autoTable(doc, {
    startY: curY,
    head: [["#", "Target Number", "Call Count", "Total Duration", "Risk"]],
    body: payload.topContacts.slice(0, 6).map((c, i) => [
      i + 1,
      c.target,
      c.count,
      fmtSec(c.totalDuration),
      c.suspicious ? "HIGH RISK" : c.count >= 5 ? "FREQUENT" : "NORMAL",
    ]),
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 4) {
        const val = data.cell.raw as string;
        if (val === "HIGH RISK") {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "FREQUENT") {
          data.cell.styles.textColor = [245, 158, 11];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    didDrawPage: () => { stampHeader(false); pageIndex++; },
  });
  curY = (doc as any).lastAutoTable.finalY + 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — Suspicious Alerts + Geo Summary + Duration Trend
  // ═══════════════════════════════════════════════════════════════════════════
  if (curY > pageHeight - 80) { doc.addPage(); stampHeader(false); pageIndex++; curY = 30; }

  // ── 7. Suspicious Alerts ─────────────────────────────────────────────────
  // Device Movement items are capped at 6 (highest location count first);
  // all other critical/warning alerts are shown in full.
  const movementInsights = payload.insights
    .filter((i) => i.id.startsWith("move-"))
    .slice(0, 6);
  const otherInsights = payload.insights.filter(
    (i) => (i.level === "critical" || i.level === "warning") && !i.id.startsWith("move-")
  );
  const suspiciousInsights = [...otherInsights, ...movementInsights];
  if (suspiciousInsights.length > 0) {
    curY = sectionTitle("6. SUSPICIOUS ACTIVITY ALERTS", curY);
    autoTable(doc, {
      startY: curY,
      head: [["Severity", "Alert", "Detail"]],
      body: suspiciousInsights.map((i) => [
        i.level.toUpperCase(),
        i.title,
        i.detail,
      ]),
      styles:     { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 245, 245] },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 55 } },
      margin: { left: 14, right: 14 },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 0) {
          const val = data.cell.raw as string;
          data.cell.styles.textColor = val === "CRITICAL" ? [239, 68, 68] : [245, 158, 11];
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => { stampHeader(false); pageIndex++; },
    });
    curY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 8. Geo Summary ────────────────────────────────────────────────────────
  if (payload.cities.length > 0) {
    if (curY > pageHeight - 50) { doc.addPage(); stampHeader(false); pageIndex++; curY = 30; }
    curY = sectionTitle("7. GEO INTELLIGENCE SUMMARY", curY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Unique Locations: ${payload.uniqueLocations}`, 14, curY);
    curY += 5;
    const cityText = payload.cities.slice(0, 20).join(", ") + (payload.cities.length > 20 ? ` +${payload.cities.length - 20} more` : "");
    const lines = doc.splitTextToSize(`Cities / Places: ${cityText}`, pageWidth - 28) as string[];
    doc.text(lines, 14, curY);
    curY += lines.length * 4 + 6;
    doc.setTextColor(0, 0, 0);
  }

  // ── 9. Duration Trend (last 20 buckets) ───────────────────────────────────
  if (payload.durationTrend.length > 0) {
    if (curY > pageHeight - 60) { doc.addPage(); stampHeader(false); pageIndex++; curY = 30; }
    curY = sectionTitle("8. CALL DURATION TREND (RECENT)", curY);

    const trendSlice = payload.durationTrend.slice(-20);
    autoTable(doc, {
      startY: curY,
      head: [["Time Bucket", "Duration (min)", "Suspicious"]],
      body: trendSlice.map((d) => [d.time, d.duration, d.suspicious ? "YES" : "No"]),
      styles:     { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 250, 235] },
      margin: { left: 14, right: 14 },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 2 && data.cell.raw === "YES") {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => { stampHeader(false); pageIndex++; },
    });
  }

  doc.save(filename);
}
