import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type {
  DataMode,
  DayGroup,
  SortDir,
  SortKey,
  TelecomFilters,
  TelecomKPIs,
  TelecomRecord,
} from "../model";
import { DEMO_RECORDS } from "../demoData";
import { parseCSVFile } from "../utils/csvParser";

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function presetRange(preset: TelecomFilters["datePreset"]): { from: string; to: string } {
  switch (preset) {
    case "today":  return { from: todayStr(), to: todayStr() };
    case "last3":  return { from: daysAgoStr(3), to: todayStr() };
    case "last7":  return { from: daysAgoStr(7), to: todayStr() };
    case "last10": return { from: daysAgoStr(10), to: todayStr() };
    default:       return { from: "", to: "" };
  }
}

// Default: show ALL demo data (no date restriction, no MSISDN restriction)
const DEFAULT_FILTERS: TelecomFilters = {
  msisdn: "",
  imsi: "",
  imei: "",
  dateFrom: "",
  dateTo: "",
  datePreset: "all",
  callType: "All",
  operator: "All",
  network: "All",
  band: "All",
  mode: "All",
  fake: "All",
  silentCallType: "All",
  threatLevel: "All",
  targetGroup: "All",
  tableSearch: "",
};

const PAGE_SIZE = 50;

function resolveWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8000/telecom/ws/live";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:8000/telecom/ws/live`;
}

// ── Core filter function (pure, used by useMemo) ──────────────────────────────
function applyFilters(records: TelecomRecord[], filters: TelecomFilters): TelecomRecord[] {
  return records.filter((r) => {
    if (filters.msisdn) {
      const q = filters.msisdn.toLowerCase().trim();
      const inCaller = r.msisdn.toLowerCase().includes(q);
      const inTarget = (r.target ?? "").toLowerCase().includes(q);
      if (!inCaller && !inTarget) return false;
    }
    if (filters.imsi && !r.imsi?.toLowerCase().includes(filters.imsi.toLowerCase())) return false;
    if (filters.imei && !r.imei?.toLowerCase().includes(filters.imei.toLowerCase())) return false;
    if (filters.dateFrom || filters.dateTo) {
      const recDate = (r.startTime || r.dateTime || "").slice(0, 10);
      if (filters.dateFrom && recDate < filters.dateFrom) return false;
      if (filters.dateTo && recDate > filters.dateTo) return false;
    }
    if (filters.callType !== "All" && r.callType !== filters.callType) return false;
    if (filters.operator !== "All" && r.operator !== filters.operator) return false;
    if (filters.network !== "All" && r.network !== filters.network) return false;
    if (filters.band !== "All" && r.band !== filters.band) return false;
    if (filters.mode !== "All" && r.mode !== filters.mode) return false;
    if (filters.fake === "Yes" && !r.fake) return false;
    if (filters.fake === "No" && r.fake) return false;
    if (filters.silentCallType !== "All" && r.silentCallType !== filters.silentCallType) return false;
    if (filters.threatLevel !== "All" && r.threatLevel !== filters.threatLevel) return false;
    if (filters.targetGroup !== "All" && r.targetGroup !== filters.targetGroup) return false;
    return true;
  });
}

export function useTelecomIntelligence() {
  // ── Raw data (source of truth) ────────────────────────────────────────────
  const [rawData, setRawData] = useState<TelecomRecord[]>(DEMO_RECORDS);
  const [dataMode, setDataMode] = useState<DataMode>("demo");
  const [filters, setFilters] = useState<TelecomFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_RECORDS[0]?.id ?? null);
  const [wsConnected, setWsConnected] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // ── WebSocket live mode ───────────────────────────────────────────────────
  useEffect(() => {
    if (dataMode !== "live") {
      wsRef.current?.close();
      wsRef.current = null;
      setWsConnected(false);
      return;
    }
    let retryTimeout: ReturnType<typeof setTimeout>;
    function connect() {
      const ws = new WebSocket(resolveWsUrl());
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const incoming = JSON.parse(event.data) as TelecomRecord | TelecomRecord[];
          const batch = Array.isArray(incoming) ? incoming : [incoming];
          setRawData((prev) => {
            const map = new Map(prev.map((r) => [r.id, r]));
            batch.forEach((r) => map.set(r.id, r));
            return Array.from(map.values()).slice(-5000);
          });
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        setWsConnected(false);
        retryTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { clearTimeout(retryTimeout); wsRef.current?.close(); };
  }, [dataMode]);

  // ── Mode switching ────────────────────────────────────────────────────────
  const switchMode = useCallback((mode: DataMode) => {
    if (mode === "demo") {
      setRawData(DEMO_RECORDS);
      setSelectedId(DEMO_RECORDS[0]?.id ?? null);
      setFilters(DEFAULT_FILTERS);
    } else if (mode === "live") {
      setRawData([]);
      setSelectedId(null);
      setFilters(DEFAULT_FILTERS);
    }
    // "csv" mode is set by uploadCSV
    if (mode !== "csv") setDataMode(mode);
    setPage(0);
  }, []);

  // ── CSV Upload ────────────────────────────────────────────────────────────
  const uploadCSV = useCallback((file: File) => {
    setCsvLoading(true);
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { records, errors, totalRows } = parseCSVFile(text);
        if (records.length === 0) {
          setCsvError(`No valid records parsed. ${errors[0] ?? "Check column headers."}`);
          setCsvLoading(false);
          return;
        }
        setRawData(records);
        setDataMode("csv");
        setPage(0);
        // Reset filters — show ALL data, let user filter from there
        setFilters({ ...DEFAULT_FILTERS, datePreset: "all", dateFrom: "", dateTo: "" });
        setSelectedId(records[0]?.id ?? null);
        if (errors.length > 0) {
          setCsvError(`Loaded ${records.length} of ${totalRows} rows. ${errors.length} row(s) skipped.`);
        } else {
          setCsvError(`✓ Loaded ${records.length} records from CSV.`);
        }
      } catch (err) {
        setCsvError(`Failed to parse CSV: ${String(err)}`);
      } finally {
        setCsvLoading(false);
      }
    };
    reader.onerror = () => {
      setCsvError("Failed to read file.");
      setCsvLoading(false);
    };
    reader.readAsText(file);
  }, []);

  // ── Filtered data (single source — ALL components use this) ──────────────
  const filteredData = useMemo(
    () => applyFilters(rawData, filters),
    [rawData, filters]
  );

  // ── Table pipeline: search → sort → paginate ──────────────────────────────
  const tableSearched = useMemo(() => {
    if (!filters.tableSearch) return filteredData;
    const q = filters.tableSearch.toLowerCase();
    return filteredData.filter(
      (r) =>
        r.msisdn.toLowerCase().includes(q) ||
        (r.target ?? "").toLowerCase().includes(q) ||
        (r.place ?? "").toLowerCase().includes(q) ||
        (r.operator ?? "").toLowerCase().includes(q)
    );
  }, [filteredData, filters.tableSearch]);

  const tableSorted = useMemo(() => {
    return [...tableSearched].sort((a, b) => {
      const av = String((a as any)[sortKey] ?? "");
      const bv = String((b as any)[sortKey] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [tableSearched, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tableSorted.length / PAGE_SIZE));
  const tablePage = useMemo(
    () => tableSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [tableSorted, page]
  );

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortDir("asc"); }
      return key;
    });
    setPage(0);
  }, []);

  // ── KPIs — computed from filteredData ─────────────────────────────────────
  const kpis: TelecomKPIs = useMemo(() => ({
    totalCalls: filteredData.filter((r) => r.callType === "Voice" || r.callType === "Data").length,
    totalSMS: filteredData.filter((r) => r.callType === "SMS").length,
    uniqueContacts: new Set(filteredData.map((r) => r.target).filter(Boolean)).size,
    suspiciousCount: filteredData.filter((r) => r.fake || r.silentCallType !== "None").length,
    totalDurationSec: filteredData.reduce((s, r) => s + (r.duration || 0), 0),
  }), [filteredData]);

  // ── Day groups — computed from filteredData ───────────────────────────────
  const dayGroups: DayGroup[] = useMemo(() => {
    const map = new Map<string, TelecomRecord[]>();
    filteredData.forEach((r) => {
      const date = (r.startTime || r.dateTime || "").slice(0, 10);
      if (!date) return;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(r);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, records]) => ({
        date,
        records,
        callCount: records.length,
        totalDuration: records.reduce((s, r) => s + (r.duration || 0), 0),
        uniqueTargets: new Set(records.map((r) => r.target)).size,
      }));
  }, [filteredData]);

  // ── Unique dropdown values — from rawData so dropdowns stay populated ─────
  const uniqueValues = useMemo(() => ({
    operators:    [...new Set(rawData.map((r) => r.operator).filter(Boolean))],
    networks:     [...new Set(rawData.map((r) => r.network).filter(Boolean))],
    bands:        [...new Set(rawData.map((r) => r.band).filter(Boolean))],
    modes:        [...new Set(rawData.map((r) => r.mode).filter(Boolean))],
    msisdns:      [...new Set(rawData.map((r) => r.msisdn).filter(Boolean))],
    targetGroups: [...new Set(rawData.map((r) => r.targetGroup).filter(Boolean))],
  }), [rawData]);

  // ── Selected record — from filteredData ───────────────────────────────────
  const selectedRecord = useMemo(
    () => filteredData.find((r) => r.id === selectedId) ?? filteredData[0] ?? null,
    [filteredData, selectedId]
  );

  // ── Filter updater ────────────────────────────────────────────────────────
  const updateFilter = useCallback(<K extends keyof TelecomFilters>(key: K, value: TelecomFilters[K]) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "datePreset" && value !== "custom") {
        const range = presetRange(value as TelecomFilters["datePreset"]);
        next.dateFrom = range.from;
        next.dateTo = range.to;
      }
      return next;
    });
    setPage(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  }, []);

  // ── Click-through: focus on a target number ───────────────────────────────
  // When user clicks a target in the table/map, filter to show all records
  // where MSISDN = that target OR target = that target
  const focusTarget = useCallback((number: string) => {
    setFilters((prev) => ({
      ...prev,
      msisdn: number,
      datePreset: "all",
      dateFrom: "",
      dateTo: "",
    }));
    setPage(0);
    setSelectedId(null);
  }, []);

  // ── Reset data (CSV reset) ───────────────────────────────────────────────
  const resetData = useCallback(() => {
    setRawData([]);
    setDataMode("csv");
    setFilters(DEFAULT_FILTERS);
    setSelectedId(null);
    setCsvError(null);
    setPage(0);
  }, []);

  return {
    // Data
    dataMode,
    rawData,
    records: filteredData,       // ← ALL components consume this
    filters,
    // Actions
    switchMode,
    uploadCSV,
    resetData,
    updateFilter,
    resetFilters,
    focusTarget,
    // Status
    csvLoading,
    csvError,
    wsConnected,
    // Derived
    kpis,
    dayGroups,
    uniqueValues,
    // Selection
    selectedRecord,
    selectedId,
    setSelectedId,
    // Table
    tablePage,
    totalPages,
    page,
    setPage,
    sortKey,
    sortDir,
    toggleSort,
    tableTotal: tableSorted.length,
    PAGE_SIZE,
  };
}
