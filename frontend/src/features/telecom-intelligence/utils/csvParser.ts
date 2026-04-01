import type { TelecomRecord } from "../model";

// Column name aliases — maps CSV header variants → canonical field
const ALIASES: Record<string, string> = {
  "date time": "dateTime", datetime: "dateTime", date: "dateTime", timestamp: "dateTime",
  imsi: "imsi", imei: "imei",
  msisdn: "msisdn", "mobile number": "msisdn", caller: "msisdn",
  target: "target", receiver: "target", "target number": "target",
  type: "callType", "call type": "callType",
  model: "deviceModel", "device model": "deviceModel",
  operator: "operator", network: "network", country: "country",
  place: "place", city: "place", location: "place",
  band: "band", ran: "ran", mode: "mode",
  latitude: "latitude", lat: "latitude",
  longitude: "longitude", lng: "longitude", lon: "longitude",
  "start time": "startTime", starttime: "startTime", start: "startTime",
  "end time": "endTime", endtime: "endTime", end: "endTime",
  duration: "duration",
  "sms status": "smsStatus", smsstatus: "smsStatus",
  fake: "fake",
  "silent call type": "silentCallType", silentcalltype: "silentCallType", "silent type": "silentCallType",
  // ── Extended columns ──────────────────────────────────────────────────────
  "supi-nai": "supiNai", supinai: "supiNai", supi: "supiNai",
  suci: "suci",
  mac: "mac", "mac address": "mac",
  sv: "sv", "software version": "sv",
  originator: "originator",
  recipient: "recipient",
  "sms sender": "smsSender", smssender: "smsSender",
  "sms receiver": "smsReceiver", smsreceiver: "smsReceiver",
  dtmf: "dtmf",
  arfcn: "arfcn",
  "transmission operator": "transmissionOperator", transmissionoperator: "transmissionOperator",
  "transmission network": "transmissionNetwork", transmissionnetwork: "transmissionNetwork",
  "equivalent network": "equivalentNetwork", equivalentnetwork: "equivalentNetwork",
  "last lac": "lastLac", lastlac: "lastLac", lac: "lastLac",
  "last tac": "lastTac", lasttac: "lastTac", tac: "lastTac",
  "gps latitude": "gpsLatitude", gpslat: "gpsLatitude", gpslatiude: "gpsLatitude",
  "gps longitude": "gpsLongitude", gpslng: "gpsLongitude",
  "gps city": "gpsCity", gpscity: "gpsCity",
  "gps region": "gpsRegion", gpsregion: "gpsRegion",
  "gps street": "gpsStreet", gpsstreet: "gpsStreet",
  "rx level": "rxLevel", rxlevel: "rxLevel", "rx lvl": "rxLevel",
  power: "power",
  timeslot: "timeslot",
  "a5/1": "a51", a51: "a51",
  "a5/2": "a52", a52: "a52",
  "a5/3": "a53", a53: "a53",
  operation: "operation",
  "join count": "joinCount", joincount: "joinCount",
  name: "name",
  group: "targetGroup", "target group": "targetGroup", targetgroup: "targetGroup",
  notes: "notes",
};

function normalizeHeader(h: string): string {
  return ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase();
}

function parseBool(v: string): boolean {
  return ["yes", "true", "1", "y"].includes(v.trim().toLowerCase());
}

function parseDuration(v: string): number {
  const n = parseFloat(v);
  if (!isNaN(n)) return Math.round(n);
  // "5m 30s" or "5:30" format
  const mMatch = v.match(/(\d+)\s*m/i);
  const sMatch = v.match(/(\d+)\s*s/i);
  if (mMatch || sMatch) {
    return (mMatch ? parseInt(mMatch[1]) * 60 : 0) + (sMatch ? parseInt(sMatch[1]) : 0);
  }
  const colonMatch = v.match(/^(\d+):(\d+)$/);
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
  return 0;
}

// Minimal CSV parser — handles quoted fields, CRLF/LF
function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        row.push(field);
        field = "";
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
        i += ch === "\r" ? 2 : 1;
      } else if (ch === "\r") {
        row.push(field);
        field = "";
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

export interface ParseResult {
  records: TelecomRecord[];
  errors: string[];
  totalRows: number;
}

export function parseCSVFile(text: string): ParseResult {
  const rows = parseCSVText(text.trim());
  if (rows.length < 2) {
    return { records: [], errors: ["CSV has no data rows"], totalRows: 0 };
  }

  const headers = rows[0].map(normalizeHeader);
  const errors: string[] = [];
  const records: TelecomRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => !c.trim())) continue;

    const get = (field: string): string => {
      const idx = headers.indexOf(field);
      return idx >= 0 ? (row[idx] ?? "").trim() : "";
    };

    try {
      const msisdn = get("msisdn") || get("caller");
      const target = get("target");
      const latRaw = get("latitude");
      const lngRaw = get("longitude");

      if (!msisdn) {
        errors.push(`Row ${i + 1}: missing MSISDN`);
        continue;
      }

      const lat = parseFloat(latRaw) || 20.5937;
      const lng = parseFloat(lngRaw) || 78.9629;

      const startRaw = get("startTime") || get("dateTime");
      const endRaw = get("endTime");
      const startTime = startRaw ? new Date(startRaw).toISOString() : new Date().toISOString();
      const endTime = endRaw ? new Date(endRaw).toISOString() : startTime;

      const durationRaw = get("duration");
      const duration = durationRaw
        ? parseDuration(durationRaw)
        : Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);

      const fakeRaw = get("fake");
      const silentRaw = get("silentCallType");
      const smsStatusRaw = get("smsStatus");

      const callTypeRaw = get("callType").toLowerCase();
      const callType =
        callTypeRaw.includes("sms") ? "SMS" : callTypeRaw.includes("data") ? "Data" : "Voice";

      const silentCallType: "None" | "Ping" | "Spy" =
        silentRaw.toLowerCase() === "spy"
          ? "Spy"
          : silentRaw.toLowerCase() === "ping"
          ? "Ping"
          : "None";

      const smsStatus =
        smsStatusRaw.toLowerCase() === "delivered"
          ? "Delivered"
          : smsStatusRaw.toLowerCase() === "failed"
          ? "Failed"
          : undefined;

      const isFake = parseBool(fakeRaw);
      const threatLevel = isFake || silentCallType === "Spy"
        ? "HIGH" as const
        : silentCallType === "Ping" ? "MEDIUM" as const
        : "NONE" as const;

      records.push({
        id: `csv-${i}`,
        dateTime: get("dateTime") || startRaw,
        imsi: get("imsi"),
        imei: get("imei"),
        msisdn,
        target,
        supiNai: get("supiNai") || undefined,
        suci: get("suci") || undefined,
        mac: get("mac") || undefined,
        sv: get("sv") || undefined,
        callType,
        originator: get("originator") || undefined,
        recipient: get("recipient") || undefined,
        smsSender: get("smsSender") || undefined,
        smsReceiver: get("smsReceiver") || undefined,
        dtmf: get("dtmf") || undefined,
        deviceModel: get("deviceModel"),
        operator: get("operator"),
        network: get("network"),
        country: get("country"),
        place: get("place"),
        band: get("band"),
        ran: get("ran"),
        mode: get("mode"),
        arfcn: get("arfcn") ? parseInt(get("arfcn")) : undefined,
        transmissionOperator: get("transmissionOperator") || undefined,
        transmissionNetwork: get("transmissionNetwork") || undefined,
        equivalentNetwork: get("equivalentNetwork") || undefined,
        lastLac: get("lastLac") || undefined,
        lastTac: get("lastTac") || undefined,
        latitude: lat,
        longitude: lng,
        gpsLatitude: get("gpsLatitude") ? parseFloat(get("gpsLatitude")) : undefined,
        gpsLongitude: get("gpsLongitude") ? parseFloat(get("gpsLongitude")) : undefined,
        gpsCity: get("gpsCity") || undefined,
        gpsRegion: get("gpsRegion") || undefined,
        gpsStreet: get("gpsStreet") || undefined,
        receiverLatitude: lat + 0.04,
        receiverLongitude: lng + 0.04,
        startTime,
        endTime,
        duration,
        smsStatus,
        fake: isFake,
        silentCallType,
        rxLevel: get("rxLevel") ? parseFloat(get("rxLevel")) : -80,
        power: get("power") ? parseFloat(get("power")) : undefined,
        timeslot: get("timeslot") ? parseInt(get("timeslot")) : undefined,
        a51: get("a51") ? parseBool(get("a51")) : undefined,
        a52: get("a52") ? parseBool(get("a52")) : undefined,
        a53: get("a53") ? parseBool(get("a53")) : undefined,
        operation: get("operation") || undefined,
        joinCount: get("joinCount") ? parseInt(get("joinCount")) : undefined,
        name: get("name") || msisdn,
        targetGroup: get("targetGroup") || undefined,
        notes: get("notes") || undefined,
        threatLevel,
        towers: [],
      });
    } catch (e) {
      errors.push(`Row ${i + 1}: parse error — ${String(e)}`);
    }
  }

  return { records, errors, totalRows: rows.length - 1 };
}
