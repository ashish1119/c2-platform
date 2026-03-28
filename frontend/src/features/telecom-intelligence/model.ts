// ─── Telecom Intelligence Data Model ───────────────────────────────────────

export type CallType = "Voice" | "SMS" | "Data";
export type Operator = "Airtel" | "Jio" | "BSNL" | "VI" | string;
export type Network = "4G" | "5G" | "LTE" | string;
export type Band = "n41" | "n78" | "83" | "87" | string;
export type Mode = "Idle" | "Active" | "Paging" | string;
export type SilentCallType = "None" | "Ping" | "Spy";
export type SMSStatus = "Delivered" | "Failed";
export type DataMode = "demo" | "csv" | "live";

export interface TelecomRecord {
  id: string;
  // CSV columns
  dateTime: string;       // "Date time" column
  imsi: string;
  imei: string;
  msisdn: string;         // Caller
  target: string;         // Receiver / Target number
  callType: CallType;     // Type column
  deviceModel: string;    // Model
  operator: Operator;
  network: Network;
  country: string;
  place: string;          // City/location
  band: Band;
  ran: string;
  mode: Mode;
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string;
  duration: number;       // seconds
  smsStatus?: SMSStatus;
  fake: boolean;
  silentCallType: SilentCallType;
  // Derived / extra
  name?: string;
  rxLevel?: number;
  arfcn?: number;
  transmissionOperator?: string;
  equivalentNetwork?: string;
  receiverLatitude?: number;
  receiverLongitude?: number;
  towers?: CellTower[];
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
  msisdn: string;           // Primary MSISDN filter
  dateFrom: string;         // ISO date string
  dateTo: string;
  datePreset: "all" | "today" | "last3" | "last7" | "last10" | "custom";
  callType: "All" | CallType;
  operator: "All" | string;
  network: "All" | string;
  band: "All" | string;
  mode: "All" | string;
  fake: "All" | "Yes" | "No";
  silentCallType: "All" | SilentCallType;
  tableSearch: string;      // Table-level free search
}

export interface TelecomKPIs {
  totalCalls: number;
  totalSMS: number;
  uniqueContacts: number;
  suspiciousCount: number;
  totalDurationSec: number;
}

export interface DayGroup {
  date: string;             // "YYYY-MM-DD"
  records: TelecomRecord[];
  callCount: number;
  totalDuration: number;
  uniqueTargets: number;
}

export type SortKey = keyof TelecomRecord;
export type SortDir = "asc" | "desc";
