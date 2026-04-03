/**
 * useSignalIntelligence — simulation engine for Signal Capture & Intercept module.
 * Fully self-contained: no backend required (works with demo data too).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { TelecomRecord } from "../model";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SignalStrength = "Strong" | "Medium" | "Weak";
export type DeviceStatus   = "Active" | "Idle";

export interface DetectedDevice {
  id: string;           // unique per device (IMSI)
  imsi: string;
  imei: string;
  msisdn: string;
  operator: string;
  network: string;
  band: string;
  latitude: number;
  longitude: number;
  signalDbm: number;
  signalStrength: SignalStrength;
  status: DeviceStatus;
  isFake: boolean;
  isIntercepted: boolean;
  detectedAt: string;   // ISO
  lastSeen: string;     // ISO
}

export interface InterceptedTarget extends DetectedDevice {
  totalCalls: number;
  totalSms: number;
  movementPath: Array<{ lat: number; lng: number; ts: string }>;
  connectedNumbers: string[];
  alerts: SignalAlert[];
}

export interface SignalAlert {
  id: string;
  imsi: string;
  msisdn: string;
  type: "rapid_movement" | "multi_connect" | "fake_device" | "silent_call";
  message: string;
  severity: "high" | "medium" | "low";
  ts: string;
}

export interface DetectionLogEntry {
  id: string;
  ts: string;
  imsi: string;
  imei: string;
  latitude: number;
  longitude: number;
  network: string;
  status: DeviceStatus;
  event: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest tower distance → signal strength + dBm
function calcSignal(lat: number, lng: number): { strength: SignalStrength; dbm: number } {
  // Simulate: use lat/lng hash as pseudo-random seed
  const seed = Math.abs(Math.sin(lat * 1000 + lng * 100)) * 1000;
  const dist = (seed % 2000);   // 0–2000 m simulated distance
  const dbm = -50 - dist * 0.04;
  const strength: SignalStrength = dist < 300 ? "Strong" : dist < 1000 ? "Medium" : "Weak";
  return { strength, dbm: Math.round(dbm) };
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toISOString(); }

// Build DetectedDevice from a TelecomRecord
function deviceFromRecord(r: TelecomRecord): DetectedDevice {
  const { strength, dbm } = calcSignal(r.latitude, r.longitude);
  return {
    id: r.imsi,
    imsi: r.imsi,
    imei: r.imei,
    msisdn: r.msisdn,
    operator: r.operator,
    network: r.network,
    band: r.band,
    latitude: r.latitude,
    longitude: r.longitude,
    signalDbm: dbm,
    signalStrength: strength,
    status: r.mode === "Active" ? "Active" : "Idle",
    isFake: r.fake,
    isIntercepted: false,
    detectedAt: r.startTime || r.dateTime,
    lastSeen: r.endTime || r.startTime || r.dateTime,
  };
}

// Jitter a coordinate slightly (simulate movement)
function jitter(v: number, scale = 0.002): number {
  return v + (Math.random() - 0.5) * scale;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSignalIntelligence(cdrRecords: TelecomRecord[]) {
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [targets, setTargets] = useState<Map<string, InterceptedTarget>>(new Map());
  const [log, setLog] = useState<DetectionLogEntry[]>([]);
  const [alerts, setAlerts] = useState<SignalAlert[]>([]);
  const [scanning, setScanning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Scan: build device list from CDR records ──────────────────────────────
  const scan = useCallback(() => {
    setScanning(true);
    setTimeout(() => {
      // Deduplicate by IMSI, take latest record per IMSI
      const byImsi = new Map<string, TelecomRecord>();
      for (const r of cdrRecords) {
        if (!r.imsi || !r.latitude || !r.longitude) continue;
        const existing = byImsi.get(r.imsi);
        if (!existing || r.startTime > existing.startTime) byImsi.set(r.imsi, r);
      }

      const newDevices: DetectedDevice[] = [];
      const newLogEntries: DetectionLogEntry[] = [];

      byImsi.forEach((r) => {
        const dev = deviceFromRecord(r);
        // Preserve intercept state from existing
        setDevices((prev) => {
          const existing = prev.find((d) => d.id === dev.id);
          if (existing) dev.isIntercepted = existing.isIntercepted;
          return prev;
        });
        newDevices.push(dev);
        newLogEntries.push({
          id: uid(),
          ts: now(),
          imsi: r.imsi,
          imei: r.imei,
          latitude: r.latitude,
          longitude: r.longitude,
          network: r.network,
          status: r.mode === "Active" ? "Active" : "Idle",
          event: "Detected",
        });
      });

      setDevices((prev) => {
        // Merge: keep intercept state
        const intercepted = new Set(prev.filter((d) => d.isIntercepted).map((d) => d.id));
        return newDevices.map((d) => ({ ...d, isIntercepted: intercepted.has(d.id) }));
      });

      setLog((prev) => [...newLogEntries, ...prev].slice(0, 500));
      setScanning(false);
    }, 800);
  }, [cdrRecords]);

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        // Simulate movement for intercepted targets
        setTargets((prev) => {
          const next = new Map(prev);
          next.forEach((t, imsi) => {
            const newLat = jitter(t.latitude);
            const newLng = jitter(t.longitude);
            const dist = haversineM(t.latitude, t.longitude, newLat, newLng);
            const { strength, dbm } = calcSignal(newLat, newLng);
            const path = [...t.movementPath, { lat: newLat, lng: newLng, ts: now() }].slice(-50);

            // Rapid movement alert
            const newAlerts: SignalAlert[] = [];
            if (dist > 150) {
              newAlerts.push({
                id: uid(), imsi, msisdn: t.msisdn,
                type: "rapid_movement",
                message: `${t.msisdn} moved ${Math.round(dist)}m rapidly`,
                severity: "high", ts: now(),
              });
            }

            next.set(imsi, {
              ...t,
              latitude: newLat, longitude: newLng,
              signalStrength: strength, signalDbm: dbm,
              lastSeen: now(),
              movementPath: path,
            });

            if (newAlerts.length) setAlerts((a) => [...newAlerts, ...a].slice(0, 100));
          });
          return next;
        });

        // Jitter non-intercepted devices too
        setDevices((prev) =>
          prev.map((d) => {
            if (d.isIntercepted) return d;
            const { strength, dbm } = calcSignal(jitter(d.latitude, 0.001), jitter(d.longitude, 0.001));
            return { ...d, signalStrength: strength, signalDbm: dbm, lastSeen: now() };
          })
        );
      }, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh]);

  // ── Intercept a device ────────────────────────────────────────────────────
  const intercept = useCallback((imsi: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === imsi ? { ...d, isIntercepted: true } : d))
    );
    setDevices((prev) => {
      const dev = prev.find((d) => d.id === imsi);
      if (!dev) return prev;

      // Build target from CDR records
      const recs = cdrRecords.filter((r) => r.imsi === imsi);
      const calls = recs.filter((r) => r.callType === "Voice" || r.callType === "Data").length;
      const sms = recs.filter((r) => r.callType === "SMS").length;
      const contacts = [...new Set(recs.map((r) => r.target).filter(Boolean))];

      // Check for multi-connect alert
      const alertList: SignalAlert[] = [];
      if (contacts.length >= 3) {
        alertList.push({
          id: uid(), imsi, msisdn: dev.msisdn,
          type: "multi_connect",
          message: `${dev.msisdn} connected to ${contacts.length} numbers`,
          severity: "medium", ts: now(),
        });
      }
      if (dev.isFake) {
        alertList.push({
          id: uid(), imsi, msisdn: dev.msisdn,
          type: "fake_device",
          message: `${dev.msisdn} flagged as FAKE device`,
          severity: "high", ts: now(),
        });
      }
      const hasSilent = recs.some((r) => r.silentCallType !== "None");
      if (hasSilent) {
        alertList.push({
          id: uid(), imsi, msisdn: dev.msisdn,
          type: "silent_call",
          message: `${dev.msisdn} has silent call activity`,
          severity: "high", ts: now(),
        });
      }

      const target: InterceptedTarget = {
        ...dev,
        isIntercepted: true,
        totalCalls: calls,
        totalSms: sms,
        movementPath: [{ lat: dev.latitude, lng: dev.longitude, ts: now() }],
        connectedNumbers: contacts as string[],
        alerts: alertList,
      };

      setTargets((t) => new Map(t).set(imsi, target));
      setAlerts((a) => [...alertList, ...a].slice(0, 100));
      setLog((l) => [
        { id: uid(), ts: now(), imsi, imei: dev.imei, latitude: dev.latitude, longitude: dev.longitude, network: dev.network, status: dev.status, event: "INTERCEPTED" },
        ...l,
      ].slice(0, 500));

      return prev;
    });
  }, [cdrRecords]);

  // ── Release intercept ─────────────────────────────────────────────────────
  const release = useCallback((imsi: string) => {
    setDevices((prev) => prev.map((d) => (d.id === imsi ? { ...d, isIntercepted: false } : d)));
    setTargets((prev) => { const next = new Map(prev); next.delete(imsi); return next; });
    const releaseEntry: DetectionLogEntry = {
      id: uid(),
      ts: now(),
      imsi,
      imei: "",
      latitude: 0,
      longitude: 0,
      network: "",
      status: "Idle",
      event: "Released",
    };
    setLog((l) => [
      releaseEntry,
      ...l,
    ].slice(0, 500));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return {
    devices,
    targets: Array.from(targets.values()),
    log,
    alerts,
    scanning,
    autoRefresh,
    scan,
    intercept,
    release,
    dismissAlert,
    clearAlerts,
    setAutoRefresh,
  };
}
