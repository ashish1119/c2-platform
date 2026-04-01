// ─── Telecom Intelligence Data Model ───────────────────────────────────────

export type CallType = "Voice" | "SMS" | "Data";
export type Operator = "Airtel" | "Jio" | "BSNL" | "VI" | string;
export type Network = "4G" | "5G" | "LTE" | "3G" | string;
export type Band = "n41" | "n78" | "83" | "87" | string;
export type Mode = "Idle" | "Active" | "Paging" | string;
export type SilentCallType = "None" | "Ping" | "Spy";
export type SMSStatus = "Delivered" | "Failed";
export type DataMode = "demo" | "csv" | "live";
export type ThreatLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface TelecomRecord {
  id: string;
  // ── Identity ──────────────────────────────────────────────────────────────
  dateTime: string;
  imsi: string;
  imei: string;
  msisdn: string;           // Caller / originator
  target: string;           // Receiver / target number
  supiNai?: string;         // SUPI-NAI (5G identity)
  suci?: string;            // SUCI (concealed identity)
  mac?: string;             // MAC address
  sv?: string;              // Software version
  // ── Communication ─────────────────────────────────────────────────────────
  callType: CallType;
  originator?: string;      // Originator number (may differ from MSISDN)
  recipient?: string;       // Recipient (may differ from target)
  smsSender?: string;
  smsReceiver?: string;
  dtmf?: string;            // DTMF tones captured
  startTime: string;
  endTime: string;
  duration: number;         // seconds
  smsStatus?: SMSStatus;
  // ── Device ────────────────────────────────────────────────────────────────
  deviceModel: string;
  // ── Network ───────────────────────────────────────────────────────────────
  operator: Operator;
  network: Network;
  country: string;
  place: string;
  band: Band;
  ran: string;
  mode: Mode;
  arfcn?: number;
  transmissionOperator?: string;
  transmissionNetwork?: string;
  equivalentNetwork?: string;
  lastLac?: string;         // Last LAC
  lastTac?: string;         // Last TAC
  // ── Geo ───────────────────────────────────────────────────────────────────
  latitude: number;
  longitude: number;
  gpsLatitude?: number;     // GPS from phone
  gpsLongitude?: number;
  gpsCity?: string;
  gpsRegion?: string;
  gpsStreet?: string;
  receiverLatitude?: number;
  receiverLongitude?: number;
  // ── Signal / Radio ────────────────────────────────────────────────────────
  rxLevel?: number;         // Rx level dBm
  power?: number;           // Tx power
  timeslot?: number;        // GSM timeslot
  a51?: boolean;            // A5/1 encryption
  a52?: boolean;            // A5/2 encryption
  a53?: boolean;            // A5/3 encryption
  // ── Security ──────────────────────────────────────────────────────────────
  fake: boolean;
  silentCallType: SilentCallType;
  operation?: string;       // Attach / Handover / Detach
  joinCount?: number;       // Session join count
  // ── Target / Intel ────────────────────────────────────────────────────────
  name?: string;
  targetGroup?: string;     // Group label
  notes?: string;           // Analyst notes
  // ── Derived ───────────────────────────────────────────────────────────────
  towers?: CellTower[];
  threatLevel?: ThreatLevel;
}

export interface CellTower {
  id: string;
  lac: string;
  tac: string;
  latitude: number;
  longitude: number;
  label: string;
}

export interface TelecomFilters {
  msisdn: string;
  imsi: string;
  imei: string;
  dateFrom: string;
  dateTo: string;
  datePreset: "all" | "today" | "last3" | "last7" | "last10" | "custom";
  callType: "All" | CallType;
  operator: "All" | string;
  network: "All" | string;
  band: "All" | string;
  mode: "All" | string;
  fake: "All" | "Yes" | "No";
  silentCallType: "All" | SilentCallType;
  threatLevel: "All" | ThreatLevel;
  targetGroup: "All" | string;
  tableSearch: string;
}

export interface TelecomKPIs {
  totalCalls: number;
  totalSMS: number;
  uniqueContacts: number;
  suspiciousCount: number;
  totalDurationSec: number;
}

export interface DayGroup {
  date: string;
  records: TelecomRecord[];
  callCount: number;
  totalDuration: number;
  uniqueTargets: number;
}

export type SortKey = keyof TelecomRecord;
export type SortDir = "asc" | "desc";
