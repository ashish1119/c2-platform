import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DFDevice {
  id: string;
  name: string;
  status: "active" | "offline" | "scanning";
  location: string;
  lat: number;
  lng: number;
  scanRange: number;   // km
  bearing: number;     // degrees
  frequency: number;   // MHz
  signalDbm: number;
}

export interface SpectrumPoint {
  freq: number;        // MHz
  dbm: number;
}

export interface WaterfallRow {
  time: string;
  data: number[];      // dBm per freq bucket
}

export interface FrequencyHit {
  id: string;
  freq: number;
  mode: "FM" | "AM" | "USB" | "LSB" | "CW";
  detectedAt: string;
  signalDbm: number;
  bearing: number;
  confidence: number;
  source: string;
  active: boolean;
}

// ── Mock devices ──────────────────────────────────────────────────────────────

const MOCK_DEVICES: DFDevice[] = [
  { id: "df-001", name: "DF-UNIT 001", status: "active",   location: "Coastal Node",  lat: 19.076,  lng: 72.877,  scanRange: 80,  bearing: 42,  frequency: 435.5, signalDbm: -68 },
  { id: "df-002", name: "DF-UNIT 002", status: "active",   location: "Urban Alpha",   lat: 18.520,  lng: 73.856,  scanRange: 60,  bearing: 118, frequency: 462.0, signalDbm: -74 },
  { id: "df-003", name: "DF-UNIT 003", status: "scanning", location: "Highland Post", lat: 20.013,  lng: 73.789,  scanRange: 120, bearing: 275, frequency: 448.2, signalDbm: -81 },
  { id: "df-004", name: "DF-UNIT 004", status: "offline",  location: "Border Sector", lat: 21.146,  lng: 72.631,  scanRange: 100, bearing: 0,   frequency: 0,     signalDbm: 0   },
  { id: "df-005", name: "DF-UNIT 005", status: "active",   location: "Delta Station", lat: 17.385,  lng: 78.486,  scanRange: 90,  bearing: 330, frequency: 471.8, signalDbm: -62 },
];

// ── Spectrum generator ────────────────────────────────────────────────────────

function generateSpectrum(tick: number): SpectrumPoint[] {
  return Array.from({ length: 200 }, (_, i) => {
    const freq = 400 + i * 0.5;
    const noise = -110 + Math.random() * 8;
    // Peaks at known frequencies
    const peaks = [435.5, 448.2, 462.0, 471.8];
    let signal = noise;
    for (const p of peaks) {
      const dist = Math.abs(freq - p);
      if (dist < 2) {
        signal = Math.max(signal, -75 + Math.sin(tick * 0.1 + p) * 6 - dist * 8);
      }
    }
    return { freq, dbm: signal };
  });
}

// ── Waterfall generator ───────────────────────────────────────────────────────

const FREQ_BUCKETS = 100;

function generateWaterfallRow(): WaterfallRow {
  const data = Array.from({ length: FREQ_BUCKETS }, (_, i) => {
    const freq = 400 + i * 0.7;
    const noise = Math.random() * 20;
    const peaks = [435.5, 448.2, 462.0, 471.8];
    let val = noise;
    for (const p of peaks) {
      const dist = Math.abs(freq - p);
      if (dist < 3) val = Math.max(val, 80 - dist * 15 + Math.random() * 10);
    }
    return Math.min(100, val);
  });
  return { time: new Date().toLocaleTimeString(), data };
}

// ── Frequency hits ────────────────────────────────────────────────────────────

const MODES: FrequencyHit["mode"][] = ["FM", "AM", "USB", "LSB", "CW"];

function generateHits(): FrequencyHit[] {
  return [
    { id: "h1", freq: 435.500, mode: "FM",  detectedAt: "05:42:11", signalDbm: -68, bearing: 42,  confidence: 94, source: "DF-UNIT 001", active: true  },
    { id: "h2", freq: 448.200, mode: "USB", detectedAt: "05:41:58", signalDbm: -81, bearing: 275, confidence: 78, source: "DF-UNIT 003", active: true  },
    { id: "h3", freq: 462.000, mode: "AM",  detectedAt: "05:41:33", signalDbm: -74, bearing: 118, confidence: 87, source: "DF-UNIT 002", active: false },
    { id: "h4", freq: 471.800, mode: "FM",  detectedAt: "05:40:55", signalDbm: -62, bearing: 330, confidence: 96, source: "DF-UNIT 005", active: true  },
    { id: "h5", freq: 419.750, mode: "CW",  detectedAt: "05:40:12", signalDbm: -88, bearing: 200, confidence: 61, source: "DF-UNIT 002", active: false },
    { id: "h6", freq: 456.125, mode: "LSB", detectedAt: "05:39:44", signalDbm: -77, bearing: 55,  confidence: 72, source: "DF-UNIT 001", active: false },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDFData() {
  const [devices, setDevices]       = useState<DFDevice[]>(MOCK_DEVICES);
  const [spectrum, setSpectrum]     = useState<SpectrumPoint[]>(() => generateSpectrum(0));
  const [waterfall, setWaterfall]   = useState<WaterfallRow[]>(() => Array.from({ length: 40 }, generateWaterfallRow));
  const [hits, setHits]             = useState<FrequencyHit[]>(generateHits);
  const [activeDeviceId, setActiveDeviceId] = useState<string>("df-001");
  const tickRef = useRef(0);

  // Live simulation — update spectrum + waterfall every 800ms
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current++;
      const t = tickRef.current;

      setSpectrum(generateSpectrum(t));

      setWaterfall((prev) => {
        const next = [generateWaterfallRow(), ...prev].slice(0, 60);
        return next;
      });

      // Jitter device signal levels
      setDevices((prev) =>
        prev.map((d) =>
          d.status === "active"
            ? { ...d, signalDbm: d.signalDbm + (Math.random() - 0.5) * 3, bearing: (d.bearing + (Math.random() - 0.5) * 2 + 360) % 360 }
            : d
        )
      );
    }, 800);
    return () => clearInterval(id);
  }, []);

  const activeDevice = useMemo(
    () => devices.find((d) => d.id === activeDeviceId) ?? devices[0],
    [devices, activeDeviceId]
  );

  return { devices, spectrum, waterfall, hits, activeDevice, activeDeviceId, setActiveDeviceId };
}
