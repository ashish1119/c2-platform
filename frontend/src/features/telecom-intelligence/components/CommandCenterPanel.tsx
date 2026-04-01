/**
 * CommandCenterPanel — Full-scale Telecom Intelligence Command Center
 * Modules: Device Intel | Security & Threats | Signal & RF | Session Tracking | Reports
 * Uses ALL TelecomRecord columns. Extends existing dashboard — nothing removed.
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { TelecomRecord, ThreatLevel } from "../model";
import { exportCSV, exportPDF } from "../utils/exportUtils";
import {
  Cpu, Shield, Radio, Activity, FileText,
  AlertTriangle, CheckCircle, Eye, RefreshCw,
  ChevronDown, ChevronUp, Zap, MapPin, Phone,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function threatColor(level: ThreatLevel | undefined): string {
  switch (level) {
    case "CRITICAL": return "#dc2626";
    case "HIGH":     return "#ef4444";
    case "MEDIUM":   return "#f59e0b";
    case "LOW":      return "#3b82f6";
    default:         return "#22c55e";
  }
}

function computeThreat(r: TelecomRecord): ThreatLevel {
  if (r.fake && r.silentCallType === "Spy") return "CRITICAL";
  if (r.fake || r.silentCallType === "Spy") return "HIGH";
  if (r.silentCallType === "Ping") return "MEDIUM";
  if (r.rxLevel !== undefined && r.rxLevel < -100) return "LOW";
  return "NONE";
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: bg, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function ThreatBadge({ level }: { level: ThreatLevel | undefined }) {
  const c = threatColor(level);
  const lbl = level ?? "NONE";
  return <Badge label={lbl} color={c} bg={`${c}18`} />;
}

function SectionCard({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, borderRadius: 10, overflow: "hidden" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
          {icon}{title}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {open && <div style={{ padding: "12px 14px" }}>{children}</div>}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${theme.colors.border}` }}>
      <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color ?? theme.colors.textPrimary }}>{value}</span>
    </div>
  );
}

// ── 1. Device Intelligence ────────────────────────────────────────────────────

interface DeviceProfile {
  imei: string;
  imsiList: string[];
  msisdnList: string[];
  model: string;
  mac?: string;
  sv?: string;
  networks: string[];
  operators: string[];
  lastSeen: string;
  recordCount: number;
  simSwapSuspected: boolean;
  threatLevel: ThreatLevel;
}

function buildDeviceProfiles(records: TelecomRecord[]): DeviceProfile[] {
  const byImei = new Map<string, DeviceProfile>();
  for (const r of records) {
    const imei = r.imei || "UNKNOWN";
    if (!byImei.has(imei)) {
      byImei.set(imei, {
        imei, imsiList: [], msisdnList: [], model: r.deviceModel || "—",
        mac: r.mac, sv: r.sv, networks: [], operators: [],
        lastSeen: r.startTime || r.dateTime, recordCount: 0,
        simSwapSuspected: false, threatLevel: "NONE",
      });
    }
    const p = byImei.get(imei)!;
    if (r.imsi && !p.imsiList.includes(r.imsi)) p.imsiList.push(r.imsi);
    if (r.msisdn && !p.msisdnList.includes(r.msisdn)) p.msisdnList.push(r.msisdn);
    if (r.network && !p.networks.includes(r.network)) p.networks.push(r.network);
    if (r.operator && !p.operators.includes(r.operator)) p.operators.push(r.operator);
    if ((r.startTime || r.dateTime) > p.lastSeen) p.lastSeen = r.startTime || r.dateTime;
    p.recordCount++;
    const t = computeThreat(r);
    const order: ThreatLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
    if (order.indexOf(t) < order.indexOf(p.threatLevel)) p.threatLevel = t;
  }
  byImei.forEach((p) => {
    p.simSwapSuspected = p.imsiList.length > 1;
    if (p.simSwapSuspected && p.threatLevel === "NONE") p.threatLevel = "MEDIUM";
  });
  return [...byImei.values()].sort((a, b) => b.recordCount - a.recordCount);
}

function DeviceIntelPanel({ records }: { records: TelecomRecord[] }) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const profiles = useMemo(() => buildDeviceProfiles(records), [records]);
  const [selected, setSelected] = useState<DeviceProfile | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter((p) =>
      !q || p.imei.includes(q) || p.imsiList.some((i) => i.includes(q)) ||
      p.msisdnList.some((m) => m.includes(q)) || p.model.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const simSwapCount = profiles.filter((p) => p.simSwapSuspected).length;
  const criticalCount = profiles.filter((p) => p.threatLevel === "CRITICAL" || p.threatLevel === "HIGH").length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IMEI / IMSI / MSISDN / Model..."
            style={{ flex: 1, padding: "5px 10px", borderRadius: 6, border: `1px solid ${theme.colors.border}`, background: isDark ? "#1e293b" : "#fff", color: theme.colors.textPrimary, fontSize: 12, outline: "none" }}
          />
          <Badge label={`${simSwapCount} SIM Swap`} color="#f59e0b" bg="#f59e0b18" />
          <Badge label={`${criticalCount} High Risk`} color="#ef4444" bg="#ef444418" />
        </div>
        <div style={{ overflowY: "auto", maxHeight: 380, display: "flex", flexDirection: "column", gap: 5 }}>
          {filtered.map((p) => (
            <div key={p.imei}
              onClick={() => setSelected(p)}
              style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", border: `1px solid ${selected?.imei === p.imei ? "#11C1CA" : theme.colors.border}`, background: selected?.imei === p.imei ? "rgba(17,193,202,0.08)" : isDark ? "#1e293b" : "#fff" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 12, fontFamily: "monospace", color: "#11C1CA" }}>{p.imei}</span>
                <div style={{ display: "flex", gap: 5 }}>
                  {p.simSwapSuspected && <Badge label="SIM SWAP" color="#f59e0b" bg="#f59e0b18" />}
                  <ThreatBadge level={p.threatLevel} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>{p.model}</span>
                <span>{p.imsiList.length} IMSI · {p.msisdnList.length} MSISDN</span>
                <span>{p.networks.join(", ")}</span>
                <span>{p.recordCount} records</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: theme.colors.textMuted, fontSize: 12, padding: 24 }}>No devices found</div>}
        </div>
      </div>

      {/* Device detail panel */}
      <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: 10, padding: 12 }}>
        {selected ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#11C1CA" }}>📱 Device Profile</div>
            <StatRow label="IMEI" value={selected.imei} />
            <StatRow label="Model" value={selected.model} />
            {selected.mac && <StatRow label="MAC" value={selected.mac} />}
            {selected.sv && <StatRow label="SW Version" value={selected.sv} />}
            <StatRow label="IMSI count" value={selected.imsiList.length} color={selected.simSwapSuspected ? "#f59e0b" : undefined} />
            <div style={{ fontSize: 11, color: theme.colors.textSecondary, margin: "4px 0" }}>
              {selected.imsiList.map((i) => <div key={i} style={{ fontFamily: "monospace" }}>{i}</div>)}
            </div>
            <StatRow label="MSISDN count" value={selected.msisdnList.length} />
            <div style={{ fontSize: 11, color: theme.colors.textSecondary, margin: "4px 0" }}>
              {selected.msisdnList.map((m) => <div key={m}>{m}</div>)}
            </div>
            <StatRow label="Networks" value={selected.networks.join(", ")} />
            <StatRow label="Operators" value={selected.operators.join(", ")} />
            <StatRow label="Records" value={selected.recordCount} />
            <StatRow label="Last seen" value={new Date(selected.lastSeen).toLocaleString()} />
            <div style={{ marginTop: 8 }}>
              <ThreatBadge level={selected.threatLevel} />
              {selected.simSwapSuspected && <span style={{ marginLeft: 6 }}><Badge label="⚠ SIM SWAP DETECTED" color="#f59e0b" bg="#f59e0b18" /></span>}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", color: theme.colors.textMuted, fontSize: 12, padding: 24 }}>
            <Cpu size={28} color="#11C1CA44" style={{ marginBottom: 8 }} /><br />
            Select a device to view profile
          </div>
        )}
      </div>
    </div>
  );
}

// ── 2. Security & Threat Detection ───────────────────────────────────────────

interface ThreatEvent {
  id: string;
  ts: string;
  msisdn: string;
  imsi: string;
  imei: string;
  type: string;
  detail: string;
  level: ThreatLevel;
  record: TelecomRecord;
}

function buildThreatEvents(records: TelecomRecord[]): ThreatEvent[] {
  const events: ThreatEvent[] = [];

  // Rapid location change detection
  const byMsisdn = new Map<string, TelecomRecord[]>();
  records.forEach((r) => {
    if (!byMsisdn.has(r.msisdn)) byMsisdn.set(r.msisdn, []);
    byMsisdn.get(r.msisdn)!.push(r);
  });
  byMsisdn.forEach((recs, msisdn) => {
    const sorted = [...recs].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], curr = sorted[i];
      if (!prev.latitude || !curr.latitude) continue;
      const dist = haversineM(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const dtMs = new Date(curr.startTime || "").getTime() - new Date(prev.startTime || "").getTime();
      const dtMin = dtMs / 60000;
      if (dist > 5000 && dtMin < 30) {
        events.push({ id: `move-${curr.id}`, ts: curr.startTime, msisdn, imsi: curr.imsi, imei: curr.imei,
          type: "Rapid Movement", detail: `Moved ${(dist / 1000).toFixed(1)} km in ${dtMin.toFixed(0)} min`, level: "HIGH", record: curr });
      }
    }
  });

  // Per-record threats
  records.forEach((r) => {
    const level = computeThreat(r);
    if (level === "NONE") return;
    let type = "", detail = "";
    if (r.fake && r.silentCallType === "Spy") { type = "FAKE + SPY"; detail = "Fake signal with spy call — critical intercept risk"; }
    else if (r.fake) { type = "Fake Signal"; detail = `Fake device detected on ${r.network} (${r.operator})`; }
    else if (r.silentCallType === "Spy") { type = "Silent Spy Call"; detail = `Silent spy call to ${r.target || "unknown"}`; }
    else if (r.silentCallType === "Ping") { type = "Silent Ping"; detail = `Device location probe via ping`; }
    else if (r.rxLevel !== undefined && r.rxLevel < -100) { type = "Weak Signal"; detail = `Rx level ${r.rxLevel} dBm — possible jamming`; }
    if (type) events.push({ id: `threat-${r.id}`, ts: r.startTime || r.dateTime, msisdn: r.msisdn, imsi: r.imsi, imei: r.imei, type, detail, level, record: r });
  });

  // Multi-IMSI per IMEI
  const imeiImsi = new Map<string, Set<string>>();
  records.forEach((r) => {
    if (!r.imei || !r.imsi) return;
    if (!imeiImsi.has(r.imei)) imeiImsi.set(r.imei, new Set());
    imeiImsi.get(r.imei)!.add(r.imsi);
  });
  imeiImsi.forEach((imsis, imei) => {
    if (imsis.size > 1) {
      const rec = records.find((r) => r.imei === imei)!;
      events.push({ id: `simswap-${imei}`, ts: rec?.startTime || "", msisdn: rec?.msisdn || "", imsi: [...imsis].join(", "), imei,
        type: "SIM Swap", detail: `${imsis.size} different IMSIs on same IMEI`, level: "HIGH", record: rec });
    }
  });

  return events.sort((a, b) => {
    const order: ThreatLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
    return order.indexOf(a.level) - order.indexOf(b.level);
  });
}

function SecurityPanel({ records }: { records: TelecomRecord[] }) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const events = useMemo(() => buildThreatEvents(records), [records]);
  const [filter, setFilter] = useState<ThreatLevel | "ALL">("ALL");

  const shown = filter === "ALL" ? events : events.filter((e) => e.level === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    events.forEach((e) => { if (c[e.level] !== undefined) c[e.level]++; });
    return c;
  }, [events]);

  return (
    <div>
      {/* Summary chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((lvl) => {
          const cnt = lvl === "ALL" ? events.length : counts[lvl] ?? 0;
          const c = lvl === "ALL" ? "#11C1CA" : threatColor(lvl as ThreatLevel);
          return (
            <button key={lvl} onClick={() => setFilter(lvl)}
              style={{ padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: filter === lvl ? `${c}22` : "transparent",
                border: `1px solid ${filter === lvl ? c : theme.colors.border}`,
                color: filter === lvl ? c : theme.colors.textSecondary }}>
              {lvl} ({cnt})
            </button>
          );
        })}
      </div>

      <div style={{ overflowY: "auto", maxHeight: 400, display: "flex", flexDirection: "column", gap: 5 }}>
        {shown.length === 0 && <div style={{ textAlign: "center", color: theme.colors.textMuted, fontSize: 12, padding: 24 }}>No threats at this level</div>}
        {shown.map((e) => (
          <div key={e.id} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${threatColor(e.level)}44`, background: isDark ? "#1a0a0a" : "#fff5f5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={12} color={threatColor(e.level)} />
                <span style={{ fontWeight: 700, fontSize: 12, color: threatColor(e.level) }}>{e.type}</span>
                <ThreatBadge level={e.level} />
              </div>
              <span style={{ fontSize: 10, color: theme.colors.textMuted }}>{e.ts ? new Date(e.ts).toLocaleString() : "—"}</span>
            </div>
            <div style={{ fontSize: 11, color: theme.colors.textPrimary }}>{e.detail}</div>
            <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 3, display: "flex", gap: 10 }}>
              <span>MSISDN: {e.msisdn}</span>
              <span>IMSI: {e.imsi}</span>
              <span>IMEI: {e.imei}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3. Signal & RF Analysis ───────────────────────────────────────────────────

function SignalRFPanel({ records }: { records: TelecomRecord[] }) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const rfStats = useMemo(() => {
    const withRx = records.filter((r) => r.rxLevel !== undefined);
    if (!withRx.length) return null;
    const avg = withRx.reduce((s, r) => s + r.rxLevel!, 0) / withRx.length;
    const min = Math.min(...withRx.map((r) => r.rxLevel!));
    const max = Math.max(...withRx.map((r) => r.rxLevel!));
    const weak = withRx.filter((r) => r.rxLevel! < -95).length;
    const a51 = records.filter((r) => r.a51).length;
    const a52 = records.filter((r) => r.a52).length;
    const a53 = records.filter((r) => r.a53).length;
    const noEnc = records.filter((r) => !r.a51 && !r.a52 && !r.a53).length;
    const arfcns = [...new Set(records.map((r) => r.arfcn).filter(Boolean))];
    const timeslots = [...new Set(records.map((r) => r.timeslot).filter((t) => t !== undefined))];
    return { avg: avg.toFixed(1), min, max, weak, a51, a52, a53, noEnc, arfcns, timeslots };
  }, [records]);

  // Signal distribution buckets
  const signalBuckets = useMemo(() => {
    const buckets = [
      { label: "Strong (>-70)", min: -70, max: 0, count: 0, color: "#22c55e" },
      { label: "Good (-70 to -85)", min: -85, max: -70, count: 0, color: "#84cc16" },
      { label: "Fair (-85 to -95)", min: -95, max: -85, count: 0, color: "#f59e0b" },
      { label: "Weak (<-95)", min: -200, max: -95, count: 0, color: "#ef4444" },
    ];
    records.forEach((r) => {
      if (r.rxLevel === undefined) return;
      for (const b of buckets) {
        if (r.rxLevel > b.min && r.rxLevel <= b.max) { b.count++; break; }
      }
    });
    return buckets;
  }, [records]);

  const maxBucket = Math.max(1, ...signalBuckets.map((b) => b.count));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* Signal strength distribution */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#11C1CA" }}>📶 Signal Distribution</div>
        {signalBuckets.map((b) => (
          <div key={b.label} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: theme.colors.textSecondary }}>{b.label}</span>
              <span style={{ fontWeight: 700, color: b.color }}>{b.count}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: isDark ? "#1e293b" : "#f1f5f9", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(b.count / maxBucket) * 100}%`, background: b.color, borderRadius: 4, transition: "width 0.4s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* RF stats */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#11C1CA" }}>📡 RF Statistics</div>
        {rfStats ? (
          <>
            <StatRow label="Avg Rx Level" value={`${rfStats.avg} dBm`} />
            <StatRow label="Min Rx Level" value={`${rfStats.min} dBm`} color="#ef4444" />
            <StatRow label="Max Rx Level" value={`${rfStats.max} dBm`} color="#22c55e" />
            <StatRow label="Weak signal records" value={rfStats.weak} color={rfStats.weak > 0 ? "#ef4444" : undefined} />
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 11, color: theme.colors.textSecondary }}>Encryption (A5)</div>
            <StatRow label="A5/1" value={rfStats.a51} color="#22c55e" />
            <StatRow label="A5/2" value={rfStats.a52} color="#f59e0b" />
            <StatRow label="A5/3" value={rfStats.a53} color="#3b82f6" />
            <StatRow label="No encryption" value={rfStats.noEnc} color={rfStats.noEnc > 0 ? "#ef4444" : undefined} />
            {rfStats.arfcns.length > 0 && <StatRow label="ARFCNs" value={rfStats.arfcns.slice(0, 5).join(", ")} />}
            {rfStats.timeslots.length > 0 && <StatRow label="Timeslots" value={rfStats.timeslots.join(", ")} />}
          </>
        ) : (
          <div style={{ fontSize: 12, color: theme.colors.textMuted }}>No RF data in current records</div>
        )}
      </div>

      {/* Network breakdown */}
      <div style={{ gridColumn: "1 / -1" }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#11C1CA" }}>🛰️ Tower & Network</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {[...new Set(records.map((r) => r.network).filter(Boolean))].map((net) => {
            const netRecs = records.filter((r) => r.network === net);
            const avgRx = netRecs.filter((r) => r.rxLevel !== undefined).reduce((s, r) => s + r.rxLevel!, 0) / (netRecs.filter((r) => r.rxLevel !== undefined).length || 1);
            const colors: Record<string, string> = { "5G": "#a855f7", "4G": "#22c55e", "LTE": "#3b82f6", "3G": "#f97316" };
            const c = colors[net] ?? "#64748b";
            return (
              <div key={net} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${c}44`, background: `${c}0a` }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: c }}>{net}</div>
                <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>{netRecs.length} records</div>
                <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>Avg Rx: {avgRx.toFixed(0)} dBm</div>
                <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                  Bands: {[...new Set(netRecs.map((r) => r.band).filter(Boolean))].join(", ")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 4. Session & Activity Tracking ───────────────────────────────────────────

function SessionPanel({ records }: { records: TelecomRecord[] }) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const sessions = useMemo(() => {
    return [...records]
      .sort((a, b) => (b.startTime || "").localeCompare(a.startTime || ""))
      .slice(0, 100)
      .map((r) => ({
        id: r.id,
        ts: r.startTime || r.dateTime,
        msisdn: r.msisdn,
        imsi: r.imsi,
        operation: r.operation || (r.mode === "Active" ? "Active" : "Idle"),
        network: r.network,
        place: r.place,
        duration: r.duration,
        joinCount: r.joinCount,
        callType: r.callType,
        threat: computeThreat(r),
        lastLac: r.lastLac,
        lastTac: r.lastTac,
        notes: r.notes,
        targetGroup: r.targetGroup,
      }));
  }, [records]);

  // Operation breakdown
  const opCounts = useMemo(() => {
    const m: Record<string, number> = {};
    records.forEach((r) => {
      const op = r.operation || "Unknown";
      m[op] = (m[op] ?? 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [records]);

  return (
    <div>
      {/* Operation summary */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {opCounts.map(([op, cnt]) => (
          <div key={op} style={{ padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: "rgba(17,193,202,0.1)", border: "1px solid rgba(17,193,202,0.3)", color: "#11C1CA" }}>
            {op}: {cnt}
          </div>
        ))}
      </div>

      {/* Session timeline table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}>
              {["Time", "MSISDN", "IMSI", "Operation", "Network", "Place", "Duration", "Type", "LAC/TAC", "Group", "Threat"].map((h) => (
                <th key={h} style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700, color: theme.colors.textSecondary, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? "transparent" : isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", borderBottom: `1px solid ${theme.colors.border}` }}>
                <td style={{ padding: "4px 8px", whiteSpace: "nowrap", color: theme.colors.textSecondary }}>{s.ts ? new Date(s.ts).toLocaleTimeString() : "—"}</td>
                <td style={{ padding: "4px 8px", fontWeight: 600, color: "#11C1CA" }}>{s.msisdn}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace", color: theme.colors.textSecondary }}>{s.imsi?.slice(-8) || "—"}</td>
                <td style={{ padding: "4px 8px" }}><Badge label={s.operation} color="#a855f7" bg="#a855f718" /></td>
                <td style={{ padding: "4px 8px" }}>{s.network}</td>
                <td style={{ padding: "4px 8px", color: theme.colors.textSecondary }}>{s.place || "—"}</td>
                <td style={{ padding: "4px 8px" }}>{fmtDur(s.duration)}</td>
                <td style={{ padding: "4px 8px" }}>{s.callType}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, color: theme.colors.textMuted }}>{s.lastLac || "—"}/{s.lastTac || "—"}</td>
                <td style={{ padding: "4px 8px" }}>{s.targetGroup ? <Badge label={s.targetGroup} color="#f59e0b" bg="#f59e0b18" /> : "—"}</td>
                <td style={{ padding: "4px 8px" }}><ThreatBadge level={s.threat} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <div style={{ textAlign: "center", color: theme.colors.textMuted, fontSize: 12, padding: 24 }}>No session data</div>}
      </div>
    </div>
  );
}

// ── 5. Target & Intercept Intelligence ───────────────────────────────────────

function TargetIntelPanel({ records }: { records: TelecomRecord[] }) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const targets = useMemo(() => {
    const byMsisdn = new Map<string, { records: TelecomRecord[]; group?: string; notes?: string }>();
    records.forEach((r) => {
      if (!byMsisdn.has(r.msisdn)) byMsisdn.set(r.msisdn, { records: [], group: r.targetGroup, notes: r.notes });
      byMsisdn.get(r.msisdn)!.records.push(r);
    });
    return [...byMsisdn.entries()].map(([msisdn, { records: recs, group, notes }]) => {
      const contacts = [...new Set(recs.map((r) => r.target).filter(Boolean))];
      const totalDur = recs.reduce((s, r) => s + r.duration, 0);
      const locs = [...new Set(recs.map((r) => `${r.latitude?.toFixed(2)},${r.longitude?.toFixed(2)}`).filter(Boolean))];
      const maxThreat = recs.reduce<ThreatLevel>((best, r) => {
        const t = computeThreat(r);
        const order: ThreatLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
        return order.indexOf(t) < order.indexOf(best) ? t : best;
      }, "NONE");
      return { msisdn, group, notes, records: recs, contacts, totalDur, locs, maxThreat, lastSeen: recs[recs.length - 1]?.startTime || "" };
    }).sort((a, b) => b.records.length - a.records.length);
  }, [records]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
      {targets.map((t) => (
        <div key={t.msisdn} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${threatColor(t.maxThreat)}44`, background: isDark ? "#1e293b" : "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#11C1CA" }}>{t.msisdn}</span>
              {t.group && <Badge label={t.group} color="#f59e0b" bg="#f59e0b18" />}
              <ThreatBadge level={t.maxThreat} />
            </div>
            <span style={{ fontSize: 10, color: theme.colors.textMuted }}>{t.records.length} records</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "3px 12px", fontSize: 11 }}>
            <span style={{ color: theme.colors.textSecondary }}>Contacts: <b style={{ color: theme.colors.textPrimary }}>{t.contacts.length}</b></span>
            <span style={{ color: theme.colors.textSecondary }}>Duration: <b style={{ color: theme.colors.textPrimary }}>{fmtDur(t.totalDur)}</b></span>
            <span style={{ color: theme.colors.textSecondary }}>Locations: <b style={{ color: theme.colors.textPrimary }}>{t.locs.length}</b></span>
          </div>
          {t.contacts.length > 0 && (
            <div style={{ marginTop: 5, fontSize: 11, color: theme.colors.textSecondary }}>
              Contacts: {t.contacts.slice(0, 4).map((c) => <span key={c} style={{ marginRight: 8, color: "#ef4444", fontWeight: 600 }}>{c}</span>)}
              {t.contacts.length > 4 && <span>+{t.contacts.length - 4} more</span>}
            </div>
          )}
          {t.notes && <div style={{ marginTop: 4, fontSize: 11, color: "#f59e0b", fontStyle: "italic" }}>📝 {t.notes}</div>}
        </div>
      ))}
      {targets.length === 0 && <div style={{ textAlign: "center", color: theme.colors.textMuted, fontSize: 12, padding: 24 }}>No target data</div>}
    </div>
  );
}

// ── 6. Reports ────────────────────────────────────────────────────────────────

function ReportsPanel({ records }: { records: TelecomRecord[] }) {
  const { theme } = useTheme();
  const [exporting, setExporting] = useState(false);

  const summary = useMemo(() => {
    const threats = records.map(computeThreat);
    return {
      total: records.length,
      calls: records.filter((r) => r.callType === "Voice").length,
      sms: records.filter((r) => r.callType === "SMS").length,
      data: records.filter((r) => r.callType === "Data").length,
      fake: records.filter((r) => r.fake).length,
      spy: records.filter((r) => r.silentCallType === "Spy").length,
      ping: records.filter((r) => r.silentCallType === "Ping").length,
      critical: threats.filter((t) => t === "CRITICAL").length,
      high: threats.filter((t) => t === "HIGH").length,
      medium: threats.filter((t) => t === "MEDIUM").length,
      uniqueDevices: new Set(records.map((r) => r.imei).filter(Boolean)).size,
      uniqueIMSI: new Set(records.map((r) => r.imsi).filter(Boolean)).size,
      uniqueLocations: new Set(records.map((r) => `${r.latitude?.toFixed(2)},${r.longitude?.toFixed(2)}`).filter(Boolean)).size,
      dateRange: records.length
        ? (() => {
            const sortedDates = records.map((r) => r.startTime || r.dateTime).sort();
            const first = sortedDates[0]?.slice(0, 10);
            const last = sortedDates[sortedDates.length - 1]?.slice(0, 10);
            return `${first} → ${last}`;
          })()
        : "—",
    };
  }, [records]);

  const reportTypes = [
    { id: "full", label: "Full Intelligence Report", desc: "All records with threat analysis", icon: "📋" },
    { id: "threats", label: "Threat Summary Report", desc: "Only suspicious/flagged records", icon: "🚨" },
    { id: "devices", label: "Device Profile Report", desc: "IMEI/IMSI/MAC device inventory", icon: "📱" },
    { id: "locations", label: "Location History Report", desc: "Movement and geo data", icon: "📍" },
  ];

  const handleExport = async (type: string, format: "csv" | "pdf") => {
    setExporting(true);
    try {
      let data = records;
      if (type === "threats") data = records.filter((r) => r.fake || r.silentCallType !== "None");
      if (format === "csv") exportCSV(data, `telecom_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
      else await exportPDF(data, `telecom_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally { setExporting(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* Summary */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#11C1CA" }}>📊 Dataset Summary</div>
        <StatRow label="Date range" value={summary.dateRange} />
        <StatRow label="Total records" value={summary.total} />
        <StatRow label="Voice calls" value={summary.calls} />
        <StatRow label="SMS" value={summary.sms} />
        <StatRow label="Data sessions" value={summary.data} />
        <StatRow label="Unique devices (IMEI)" value={summary.uniqueDevices} />
        <StatRow label="Unique IMSI" value={summary.uniqueIMSI} />
        <StatRow label="Unique locations" value={summary.uniqueLocations} />
        <StatRow label="Fake signals" value={summary.fake} color={summary.fake > 0 ? "#ef4444" : undefined} />
        <StatRow label="Spy calls" value={summary.spy} color={summary.spy > 0 ? "#ef4444" : undefined} />
        <StatRow label="Ping calls" value={summary.ping} color={summary.ping > 0 ? "#f59e0b" : undefined} />
        <StatRow label="Critical threats" value={summary.critical} color={summary.critical > 0 ? "#dc2626" : undefined} />
        <StatRow label="High threats" value={summary.high} color={summary.high > 0 ? "#ef4444" : undefined} />
      </div>

      {/* Export options */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#11C1CA" }}>📁 Export Reports</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reportTypes.map((rt) => (
            <div key={rt.id} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${theme.colors.border}`, background: theme.mode === "dark" ? "#1e293b" : "#fff" }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{rt.icon} {rt.label}</div>
              <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 6 }}>{rt.desc}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => handleExport(rt.id, "csv")} disabled={exporting}
                  style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 4, cursor: "pointer", border: "1px solid #22c55e55", background: "#22c55e18", color: "#22c55e" }}>
                  CSV
                </button>
                <button onClick={() => handleExport(rt.id, "pdf")} disabled={exporting}
                  style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 4, cursor: "pointer", border: "1px solid #3b82f655", background: "#3b82f618", color: "#3b82f6" }}>
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
        {exporting && <div style={{ marginTop: 8, fontSize: 11, color: "#11C1CA" }}>⟳ Generating report…</div>}
      </div>
    </div>
  );
}

// ── 7. Live Simulation ────────────────────────────────────────────────────────

function SimulationPanel({ records }: { records: TelecomRecord[] }) {
  const { theme } = useTheme();
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState<Array<{ id: string; ts: string; msg: string; level: ThreatLevel }>>([]);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
      const r = records[Math.floor(Math.random() * records.length)];
      if (!r) return;
      const level = computeThreat(r);
      const msgs = [
        `📡 ${r.msisdn} active on ${r.network} (${r.operator}) at ${r.place || "unknown"}`,
        `📞 Call: ${r.msisdn} → ${r.target || "unknown"} · ${fmtDur(r.duration)}`,
        `🛰️ Tower: ${r.ran}-${r.band} · Rx ${r.rxLevel ?? "—"} dBm`,
        r.fake ? `🚨 FAKE SIGNAL detected: ${r.msisdn}` : `✅ Normal activity: ${r.msisdn}`,
        r.silentCallType !== "None" ? `⚠ Silent ${r.silentCallType}: ${r.msisdn}` : `📍 Location: ${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}`,
      ];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      setFeed((prev) => [{ id: `${Date.now()}`, ts: new Date().toLocaleTimeString(), msg, level }, ...prev].slice(0, 80));
    }, 1200);
  }, [records]);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <button onClick={running ? stop : start}
          style={{ padding: "5px 14px", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", border: "none",
            background: running ? "#ef444422" : "#22c55e22", color: running ? "#ef4444" : "#22c55e" }}>
          {running ? "⏹ Stop Simulation" : "▶ Start Live Simulation"}
        </button>
        {running && <span style={{ fontSize: 11, color: "#22c55e", animation: "pulse 1s infinite" }}>● LIVE · {tick} events</span>}
        <button onClick={() => setFeed([])} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 5, cursor: "pointer", border: `1px solid ${theme.colors.border}`, background: "transparent", color: theme.colors.textSecondary }}>
          Clear
        </button>
      </div>
      <div style={{ overflowY: "auto", maxHeight: 360, display: "flex", flexDirection: "column", gap: 3 }}>
        {feed.length === 0 && <div style={{ textAlign: "center", color: theme.colors.textMuted, fontSize: 12, padding: 24 }}>Start simulation to see live feed</div>}
        {feed.map((f) => (
          <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 8px", borderRadius: 5, background: f.level !== "NONE" ? `${threatColor(f.level)}10` : "transparent", borderLeft: `3px solid ${threatColor(f.level)}` }}>
            <span style={{ fontSize: 10, color: theme.colors.textMuted, minWidth: 60 }}>{f.ts}</span>
            <span style={{ fontSize: 11, color: theme.colors.textPrimary }}>{f.msg}</span>
            {f.level !== "NONE" && <ThreatBadge level={f.level} />}
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Main CommandCenterPanel ───────────────────────────────────────────────────

type CCTab = "overview" | "devices" | "security" | "signal" | "sessions" | "targets" | "simulation" | "reports";

const CC_TABS: { id: CCTab; icon: React.ReactNode; label: string }[] = [
  { id: "overview",   icon: <Activity size={12} />,   label: "Overview" },
  { id: "devices",    icon: <Cpu size={12} />,         label: "Devices" },
  { id: "security",   icon: <Shield size={12} />,      label: "Security" },
  { id: "signal",     icon: <Radio size={12} />,       label: "Signal/RF" },
  { id: "sessions",   icon: <Zap size={12} />,         label: "Sessions" },
  { id: "targets",    icon: <Eye size={12} />,         label: "Targets" },
  { id: "simulation", icon: <RefreshCw size={12} />,   label: "Live Sim" },
  { id: "reports",    icon: <FileText size={12} />,    label: "Reports" },
];

type Props = { records: TelecomRecord[] };

export default function CommandCenterPanel({ records }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const [activeTab, setActiveTab] = useState<CCTab>("overview");

  // Overview KPIs
  const kpis = useMemo(() => {
    const threats = records.map(computeThreat);
    const devices = new Set(records.map((r) => r.imei).filter(Boolean)).size;
    const simSwap = (() => {
      const m = new Map<string, Set<string>>();
      records.forEach((r) => { if (r.imei && r.imsi) { if (!m.has(r.imei)) m.set(r.imei, new Set()); m.get(r.imei)!.add(r.imsi); } });
      return [...m.values()].filter((s) => s.size > 1).length;
    })();
    return [
      { label: "Total Records", value: records.length, color: "#11C1CA" },
      { label: "Unique Devices", value: devices, color: "#3b82f6" },
      { label: "Critical/High", value: threats.filter((t) => t === "CRITICAL" || t === "HIGH").length, color: "#ef4444" },
      { label: "Fake Signals", value: records.filter((r) => r.fake).length, color: "#f97316" },
      { label: "Silent Calls", value: records.filter((r) => r.silentCallType !== "None").length, color: "#f59e0b" },
      { label: "SIM Swaps", value: simSwap, color: "#a855f7" },
      { label: "Unique IMSI", value: new Set(records.map((r) => r.imsi).filter(Boolean)).size, color: "#22c55e" },
      { label: "Locations", value: new Set(records.map((r) => `${r.latitude?.toFixed(2)},${r.longitude?.toFixed(2)}`).filter(Boolean)).size, color: "#06b6d4" },
    ];
  }, [records]);

  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={16} color="#11C1CA" /> Command Center
          </div>
          <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
            Full-spectrum telecom intelligence · {records.length} records in scope
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${k.color}33`, background: `${k.color}0d`, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", background: theme.colors.surfaceAlt, border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden", flexWrap: "wrap" }}>
        {CC_TABS.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: "none", borderRadius: 0, flex: "1 1 auto", justifyContent: "center",
              color: activeTab === id ? theme.colors.primary : theme.colors.textSecondary,
              borderBottom: activeTab === id ? `2px solid ${theme.colors.primary}` : "2px solid transparent",
              background: activeTab === id ? `${theme.colors.primary}10` : "transparent" }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ border: `1px solid ${border}`, borderRadius: 10, padding: 14 }}>
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionCard title="Device Intelligence" icon={<Cpu size={14} color="#11C1CA" />}>
              <DeviceIntelPanel records={records} />
            </SectionCard>
            <SectionCard title="Security Threats" icon={<Shield size={14} color="#ef4444" />} defaultOpen={false}>
              <SecurityPanel records={records} />
            </SectionCard>
          </div>
        )}
        {activeTab === "devices"    && <DeviceIntelPanel records={records} />}
        {activeTab === "security"   && <SecurityPanel records={records} />}
        {activeTab === "signal"     && <SignalRFPanel records={records} />}
        {activeTab === "sessions"   && <SessionPanel records={records} />}
        {activeTab === "targets"    && <TargetIntelPanel records={records} />}
        {activeTab === "simulation" && <SimulationPanel records={records} />}
        {activeTab === "reports"    && <ReportsPanel records={records} />}
      </div>
    </div>
  );
}
