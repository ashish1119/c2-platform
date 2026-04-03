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

export async function exportPDF(records: TelecomRecord[], filename = "telecom_intelligence.pdf") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(17, 193, 202);
  doc.text("Telecom Intelligence Report", 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated: ${new Date().toLocaleString("en-IN")}  |  Records: ${records.length}`,
    14, 22
  );

  autoTable(doc, {
    startY: 28,
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
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [17, 193, 202], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 255] },
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
