import { useMemo } from "react";
import type { TelecomRecord } from "../model";

export interface DailyVolume {
  date: string;
  calls: number;
  sms: number;
  total: number;
  duration: number;
}

export interface ContactFrequency {
  target: string;
  count: number;
  totalDuration: number;
  suspicious: boolean;
}

export interface DistEntry {
  name: string;
  value: number;
  pct: string;
}

export interface InsightItem {
  id: string;
  level: "critical" | "warning" | "info";
  icon: string;
  title: string;
  detail: string;
}

export interface ExtendedKPIs {
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
}

function modeOf(arr: string[]): string {
  if (!arr.length) return "—";
  const freq = new Map<string, number>();
  arr.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function useTelecomAnalytics(filteredData: TelecomRecord[]) {
  // ── Daily call volume ─────────────────────────────────────────────────────
  const dailyVolume: DailyVolume[] = useMemo(() => {
    const map = new Map<string, DailyVolume>();
    filteredData.forEach((r) => {
      const date = (r.startTime || r.dateTime || "").slice(0, 10);
      if (!date) return;
      if (!map.has(date)) map.set(date, { date, calls: 0, sms: 0, total: 0, duration: 0 });
      const d = map.get(date)!;
      d.total++;
      d.duration += r.duration || 0;
      if (r.callType === "SMS") d.sms++;
      else d.calls++;
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  // ── Call type distribution ────────────────────────────────────────────────
  const callTypeDist: DistEntry[] = useMemo(() => {
    const total = filteredData.length || 1;
    const counts: Record<string, number> = {};
    filteredData.forEach((r) => { counts[r.callType] = (counts[r.callType] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      pct: ((value / total) * 100).toFixed(1),
    }));
  }, [filteredData]);

  // ── Operator distribution ─────────────────────────────────────────────────
  const operatorDist: DistEntry[] = useMemo(() => {
    const total = filteredData.length || 1;
    const counts: Record<string, number> = {};
    filteredData.forEach((r) => {
      const op = r.operator || "Unknown";
      counts[op] = (counts[op] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }));
  }, [filteredData]);

  // ── Top contacts ──────────────────────────────────────────────────────────
  const topContacts: ContactFrequency[] = useMemo(() => {
    const map = new Map<string, ContactFrequency>();
    filteredData.forEach((r) => {
      const t = r.target || "Unknown";
      if (!map.has(t)) map.set(t, { target: t, count: 0, totalDuration: 0, suspicious: false });
      const c = map.get(t)!;
      c.count++;
      c.totalDuration += r.duration || 0;
      if (r.fake || r.silentCallType !== "None") c.suspicious = true;
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredData]);

  // ── Duration trend (per record, sorted by time) ───────────────────────────
  const durationTrend = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
      .map((r) => ({
        time: (r.startTime || r.dateTime || "").slice(0, 16).replace("T", " "),
        duration: Math.round((r.duration || 0) / 60), // minutes
        suspicious: r.fake || r.silentCallType !== "None",
      }));
  }, [filteredData]);

  // ── Extended KPIs ─────────────────────────────────────────────────────────
  const extKPIs: ExtendedKPIs = useMemo(() => {
    const total = filteredData.length || 1;
    const totalDur = filteredData.reduce((s, r) => s + (r.duration || 0), 0);
    const suspicious = filteredData.filter((r) => r.fake || r.silentCallType !== "None").length;
    const locations = new Set(
      filteredData.map((r) => `${r.latitude?.toFixed(2)},${r.longitude?.toFixed(2)}`).filter(Boolean)
    ).size;
    const nightCount = filteredData.filter((r) => {
      const h = new Date(r.startTime || r.dateTime || "").getHours();
      return h >= 0 && h < 5;
    }).length;

    // Peak hour
    const hourMap: Record<number, number> = {};
    filteredData.forEach((r) => {
      const h = new Date(r.startTime || r.dateTime || "").getHours();
      if (!isNaN(h)) hourMap[h] = (hourMap[h] ?? 0) + 1;
    });
    const peakHour = Object.keys(hourMap).length
      ? Number(Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0][0])
      : null;
    const peakHourCount = peakHour !== null ? (hourMap[peakHour] ?? 0) : 0;

    // Most contacted
    const targetFreq: Record<string, number> = {};
    filteredData.forEach((r) => {
      if (r.target) targetFreq[r.target] = (targetFreq[r.target] ?? 0) + 1;
    });
    const mostContactedEntry = Object.entries(targetFreq).sort((a, b) => b[1] - a[1])[0];
    const mostContactedNumber = mostContactedEntry?.[0] ?? "—";
    const mostContactedCount = mostContactedEntry?.[1] ?? 0;

    return {
      avgDurationSec: Math.round(totalDur / total),
      mostActiveOperator: modeOf(filteredData.map((r) => r.operator).filter(Boolean)),
      mostUsedNetwork: modeOf(filteredData.map((r) => r.network).filter(Boolean)),
      suspiciousPct: ((suspicious / total) * 100).toFixed(1),
      uniqueLocations: locations,
      nightActivityCount: nightCount,
      peakHour,
      peakHourCount,
      mostContactedNumber,
      mostContactedCount,
    };
  }, [filteredData]);

  // ── AI Insights ───────────────────────────────────────────────────────────
  const insights: InsightItem[] = useMemo(() => {
    const items: InsightItem[] = [];
    if (!filteredData.length) return items;

    // Suspicious activity
    const fakeCount = filteredData.filter((r) => r.fake).length;
    const spyCount = filteredData.filter((r) => r.silentCallType === "Spy").length;
    if (fakeCount > 0 || spyCount > 0) {
      items.push({
        id: "suspicious",
        level: "critical",
        icon: "⚠",
        title: "Suspicious Activity Detected",
        detail: `${fakeCount} fake signal(s) and ${spyCount} spy call(s) found in filtered data.`,
      });
    }

    // High frequency contact
    const targetFreq = new Map<string, number>();
    filteredData.forEach((r) => {
      if (r.target) targetFreq.set(r.target, (targetFreq.get(r.target) ?? 0) + 1);
    });
    const highFreq = [...targetFreq.entries()].filter(([, c]) => c >= 5);
    highFreq.forEach(([target, count]) => {
      items.push({
        id: `freq-${target}`,
        level: "warning",
        icon: "📞",
        title: "High Frequency Contact",
        detail: `${count} communications with ${target} — possible surveillance target.`,
      });
    });

    // Long duration calls
    const longCalls = filteredData.filter((r) => r.duration > 600);
    if (longCalls.length > 0) {
      const maxDur = Math.max(...longCalls.map((r) => r.duration));
      items.push({
        id: "long-duration",
        level: "warning",
        icon: "⏱",
        title: "Unusually Long Calls Detected",
        detail: `${longCalls.length} call(s) exceed 10 minutes. Longest: ${Math.round(maxDur / 60)}m.`,
      });
    }

    // Multi-location movement
    const msisdnLocs = new Map<string, Set<string>>();
    filteredData.forEach((r) => {
      if (!r.msisdn || !r.latitude) return;
      const key = `${r.latitude.toFixed(1)},${r.longitude.toFixed(1)}`;
      if (!msisdnLocs.has(r.msisdn)) msisdnLocs.set(r.msisdn, new Set());
      msisdnLocs.get(r.msisdn)!.add(key);
    });
    msisdnLocs.forEach((locs, msisdn) => {
      if (locs.size >= 3) {
        items.push({
          id: `move-${msisdn}`,
          level: "warning",
          icon: "📍",
          title: "Device Movement Detected",
          detail: `${msisdn} active across ${locs.size} distinct locations.`,
        });
      }
    });

    // Night activity
    const nightCalls = filteredData.filter((r) => {
      const h = new Date(r.startTime || r.dateTime || "").getHours();
      return h >= 0 && h < 5;
    });
    if (nightCalls.length > 0) {
      items.push({
        id: "night",
        level: "info",
        icon: "🌙",
        title: "Late Night Activity Observed",
        detail: `${nightCalls.length} communication(s) between 12AM–5AM.`,
      });
    }

    // Ping calls
    const pingCount = filteredData.filter((r) => r.silentCallType === "Ping").length;
    if (pingCount > 0) {
      items.push({
        id: "ping",
        level: "info",
        icon: "📡",
        title: "Silent Ping Calls Detected",
        detail: `${pingCount} ping call(s) detected — device location probing.`,
      });
    }

    // All clear
    if (items.length === 0) {
      items.push({
        id: "clear",
        level: "info",
        icon: "✅",
        title: "No Anomalies Detected",
        detail: "Filtered dataset shows no suspicious patterns.",
      });
    }

    return items;
  }, [filteredData]);

  return {
    dailyVolume,
    callTypeDist,
    operatorDist,
    topContacts,
    durationTrend,
    extKPIs,
    insights,
  };
}
