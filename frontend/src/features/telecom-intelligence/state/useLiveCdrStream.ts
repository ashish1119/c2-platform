/**
 * useLiveCdrStream — real-time CDR WebSocket hook
 *
 * Connects to /cdr/ws/live, receives LiveCdrEvent messages, maintains:
 *  - liveEvents: ring buffer of last 500 events
 *  - liveStats: rolling KPIs (total, active callers, fake count, etc.)
 *  - alerts: threat events (fake, silent, rapid movement)
 *  - heatCells: lat/lng density grid for heatmap
 *  - connected: WS connection status
 *
 * Also exposes:
 *  - simulateLive(): inject synthetic events from existing TelecomRecord[]
 *  - clearEvents(): flush the buffer
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { TelecomRecord } from "../model";
import type { LiveCdrEvent } from "../../../api/cdr";
import { resolveCdrWsUrl } from "../../../api/cdr";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveStats {
  totalEvents: number;
  activeCallers: number;
  fakeCount: number;
  silentCount: number;
  voiceCount: number;
  smsCount: number;
  dataCount: number;
  topCaller: string;
  topReceiver: string;
  lastEventTs: string;
}

export interface LiveAlert {
  id: string;
  ts: string;
  type: "fake" | "silent" | "rapid_movement" | "multi_connect";
  severity: "critical" | "high" | "medium";
  msisdn: string;
  message: string;
}

export interface HeatCell {
  lat: number;
  lng: number;
  weight: number;
}

const MAX_EVENTS = 500;
const RECONNECT_MS = 3000;

function uid() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toISOString(); }

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveCdrStream() {
  const [connected, setConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveCdrEvent[]>([]);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [stats, setStats] = useState<LiveStats>({
    totalEvents: 0, activeCallers: 0, fakeCount: 0, silentCount: 0,
    voiceCount: 0, smsCount: 0, dataCount: 0,
    topCaller: "—", topReceiver: "—", lastEventTs: "—",
  });
  const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
  const [simulating, setSimulating] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callerFreq = useRef<Map<string, number>>(new Map());
  const receiverFreq = useRef<Map<string, number>>(new Map());
  const heatMap = useRef<Map<string, HeatCell>>(new Map());
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simRecordsRef = useRef<TelecomRecord[]>([]);
  const simIndexRef = useRef(0);

  // ── Process incoming event ────────────────────────────────────────────────
  const processEvent = useCallback((event: LiveCdrEvent) => {
    // Add to ring buffer
    setLiveEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));

    // Update caller/receiver frequency
    const caller = event.caller.msisdn;
    const receiver = event.receiver.msisdn ?? "";
    callerFreq.current.set(caller, (callerFreq.current.get(caller) ?? 0) + 1);
    if (receiver) receiverFreq.current.set(receiver, (receiverFreq.current.get(receiver) ?? 0) + 1);

    // Update heatmap
    const hKey = `${event.caller.lat.toFixed(2)},${event.caller.lng.toFixed(2)}`;
    const existing = heatMap.current.get(hKey);
    if (existing) existing.weight++;
    else heatMap.current.set(hKey, { lat: parseFloat(event.caller.lat.toFixed(2)), lng: parseFloat(event.caller.lng.toFixed(2)), weight: 1 });
    setHeatCells([...heatMap.current.values()]);

    // Update stats
    setStats((prev) => {
      const topCaller = [...callerFreq.current.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      const topReceiver = [...receiverFreq.current.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      const ct = event.call.call_type?.toLowerCase() ?? "";
      return {
        totalEvents: prev.totalEvents + 1,
        activeCallers: callerFreq.current.size,
        fakeCount: prev.fakeCount + (event.alerts.is_fake ? 1 : 0),
        silentCount: prev.silentCount + (event.alerts.silent_call_type !== "None" ? 1 : 0),
        voiceCount: prev.voiceCount + (ct === "voice" ? 1 : 0),
        smsCount: prev.smsCount + (ct === "sms" ? 1 : 0),
        dataCount: prev.dataCount + (ct === "data" ? 1 : 0),
        topCaller,
        topReceiver,
        lastEventTs: event.ts ?? now(),
      };
    });

    // Generate alerts
    const newAlerts: LiveAlert[] = [];
    if (event.alerts.is_fake) {
      newAlerts.push({ id: uid(), ts: event.ts ?? now(), type: "fake", severity: "critical", msisdn: caller, message: `Fake signal detected: ${caller} on ${event.caller.network ?? "unknown"}` });
    }
    if (event.alerts.silent_call_type && event.alerts.silent_call_type !== "None") {
      const sev = event.alerts.silent_call_type === "Spy" ? "critical" : "high";
      newAlerts.push({ id: uid(), ts: event.ts ?? now(), type: "silent", severity: sev, msisdn: caller, message: `Silent ${event.alerts.silent_call_type} call: ${caller} → ${receiver || "unknown"}` });
    }
    // Multi-connect alert: caller contacted 5+ unique receivers
    if (receiverFreq.current.size > 0 && (callerFreq.current.get(caller) ?? 0) >= 5) {
      const uniqueRecv = [...receiverFreq.current.keys()].length;
      if (uniqueRecv >= 5 && (callerFreq.current.get(caller) ?? 0) % 5 === 0) {
        newAlerts.push({ id: uid(), ts: event.ts ?? now(), type: "multi_connect", severity: "medium", msisdn: caller, message: `${caller} connected to ${uniqueRecv} unique receivers` });
      }
    }
    if (newAlerts.length) setAlerts((prev) => [...newAlerts, ...prev].slice(0, 100));
  }, []);

  // ── WebSocket connect ─────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(resolveCdrWsUrl());
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as LiveCdrEvent;
        if (data.type === "cdr_live") processEvent(data);
      } catch { /* ignore malformed */ }
    };
    ws.onclose = () => {
      setConnected(false);
      retryRef.current = setTimeout(connect, RECONNECT_MS);
    };
    ws.onerror = () => ws.close();
  }, [processEvent]);

  const disconnect = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  // ── Simulation mode (inject from existing TelecomRecord[]) ───────────────
  const startSimulation = useCallback((records: TelecomRecord[]) => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    simRecordsRef.current = records;
    simIndexRef.current = 0;
    setSimulating(true);

    simIntervalRef.current = setInterval(() => {
      const recs = simRecordsRef.current;
      if (!recs.length) return;
      const r = recs[simIndexRef.current % recs.length];
      simIndexRef.current++;

      const event: LiveCdrEvent = {
        type: "cdr_live",
        id: uid(),
        ts: now(),
        caller: {
          msisdn: r.msisdn,
          imsi: r.imsi || null,
          imei: r.imei || null,
          operator: r.operator || null,
          network: r.network || null,
          lat: r.latitude,
          lng: r.longitude,
          place: r.place || null,
        },
        receiver: {
          msisdn: r.recipient || r.target || null,
          lat: r.receiverLatitude ?? r.latitude + 0.03,
          lng: r.receiverLongitude ?? r.longitude + 0.03,
        },
        call: {
          call_type: r.callType,
          duration_sec: r.duration,
          start_time: r.startTime,
          band: r.band || null,
          ran: r.ran || null,
        },
        alerts: {
          is_fake: r.fake,
          silent_call_type: r.silentCallType,
        },
      };
      processEvent(event);
    }, 1000);
  }, [processEvent]);

  const stopSimulation = useCallback(() => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setSimulating(false);
  }, []);

  const clearEvents = useCallback(() => {
    setLiveEvents([]);
    setAlerts([]);
    callerFreq.current.clear();
    receiverFreq.current.clear();
    heatMap.current.clear();
    setHeatCells([]);
    setStats({ totalEvents: 0, activeCallers: 0, fakeCount: 0, silentCount: 0, voiceCount: 0, smsCount: 0, dataCount: 0, topCaller: "—", topReceiver: "—", lastEventTs: "—" });
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    disconnect();
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
  }, [disconnect]);

  return {
    connected, liveEvents, alerts, stats, heatCells, simulating,
    connect, disconnect, startSimulation, stopSimulation, clearEvents, dismissAlert,
  };
}
