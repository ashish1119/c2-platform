import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import type { SmsSpectrumOccupancyBin } from "../../api/operatorDashboard";

type SpectrumViewerProps = {
  bins: SmsSpectrumOccupancyBin[];
  loading?: boolean;
  lastUpdatedAt?: string | null;
};

type TraceKey = "live" | "average" | "maxHold" | "minHold";

type ProcessedBin = {
  frequencyHz: number;
  livePowerDbm: number;
  detectionCount: number;
};

type AnalyzerTraces = {
  frequencyHz: number[];
  liveDbm: number[];
  averageDbm: number[];
  maxHoldDbm: number[];
  minHoldDbm: number[];
  detectionCount: number[];
  peakIndex: number;
};

type SystemTrace = {
  key: string;
  trace: AnalyzerTraces;
};

const CHART_HEIGHT_PX = 350;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// function formatFrequencyHz(value: number): string {
//   if (value >= 1_000_000_000) {
//     return `${(value / 1_000_000_000).toFixed(6)} GHz`;
//   }
//   if (value >= 1_000_000) {
//     return `${(value / 1_000_000).toFixed(6)} MHz`;
//   }
//   if (value >= 1_000) {
//     return `${(value / 1_000).toFixed(3)} kHz`;
//   }
//   return `${value.toFixed(1)} Hz`;
// }

function formatFrequencyHz(value: number): string {
  return `${(value / 1_000_000).toFixed(3)} MHz`;
}

function inferPowerFromDetections(detectionCount: number): number {
  const boosted = -132 + Math.log10(detectionCount + 1) * 28;
  return clamp(boosted, -156, -82);
}

function resampleBins(points: ProcessedBin[], targetCount: number): ProcessedBin[] {
  if (points.length <= targetCount) {
    return points;
  }

  const lastIndex = points.length - 1;
  const resampled: ProcessedBin[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const ratio = index / (targetCount - 1);
    const sourceIndex = ratio * lastIndex;
    const lowIndex = Math.floor(sourceIndex);
    const highIndex = Math.min(lastIndex, lowIndex + 1);
    const mix = sourceIndex - lowIndex;

    const low = points[lowIndex];
    const high = points[highIndex];

    resampled.push({
      frequencyHz: low.frequencyHz + (high.frequencyHz - low.frequencyHz) * mix,
      livePowerDbm: low.livePowerDbm + (high.livePowerDbm - low.livePowerDbm) * mix,
      detectionCount: Math.round(low.detectionCount + (high.detectionCount - low.detectionCount) * mix),
    });
  }

  return resampled;
}


const resolveRfWsUrl = () => {
  if (typeof window === "undefined") {
    return "ws://localhost:8000/ws/rf";
  }
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${window.location.hostname}:8000/ws/rf`;
};

function isCompatibleTrace(previous: AnalyzerTraces, next: ProcessedBin[]): boolean {
  if (previous.frequencyHz.length !== next.length) {
    return false;
  }

  const startShift = Math.abs(previous.frequencyHz[0] - next[0].frequencyHz);
  const endShift = Math.abs(previous.frequencyHz[previous.frequencyHz.length - 1] - next[next.length - 1].frequencyHz);

  return startShift < 1_000 && endShift < 1_000;
}

function buildTraces(previous: AnalyzerTraces | null, points: ProcessedBin[]): AnalyzerTraces {
  const liveDbm = points.map((point) => point.livePowerDbm);
  const frequencyHz = points.map((point) => point.frequencyHz);
  const detectionCount = points.map((point) => point.detectionCount);

  if (!previous || !isCompatibleTrace(previous, points)) {
    const initPeakIndex = liveDbm.reduce(
      (best, value, index) => (value > liveDbm[best] ? index : best),
      0
    );

    return {
      frequencyHz,
      liveDbm,
      averageDbm: [...liveDbm],
      maxHoldDbm: [...liveDbm],
      minHoldDbm: [...liveDbm],
      detectionCount,
      peakIndex: initPeakIndex,
    };
  }

  const averageDbm = new Array<number>(liveDbm.length);
  const maxHoldDbm = new Array<number>(liveDbm.length);
  const minHoldDbm = new Array<number>(liveDbm.length);
  const averagingAlpha = 0.14;
  const maxDecay = 0.05;
  const minRise = 0.05;

  for (let index = 0; index < liveDbm.length; index += 1) {
    const live = liveDbm[index];
    averageDbm[index] = previous.averageDbm[index] * (1 - averagingAlpha) + live * averagingAlpha;
    maxHoldDbm[index] = Math.max(live, previous.maxHoldDbm[index] - maxDecay);
    minHoldDbm[index] = Math.min(live, previous.minHoldDbm[index] + minRise);
  }

  const peakIndex = liveDbm.reduce((best, value, index) => (value > liveDbm[best] ? index : best), 0);

  return {
    frequencyHz,
    liveDbm,
    averageDbm,
    maxHoldDbm,
    minHoldDbm,
    detectionCount,
    peakIndex,
  };
}

function toButtonColor(active: boolean): string {
  return active ? "#2a3347" : "#171d2c";
}

export default function SpectrumViewer({ bins, loading = false, lastUpdatedAt }: SpectrumViewerProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHold, setIsHold] = useState(false);
  const [autoScale, setAutoScale] = useState(true);
  const [traceVisibility, setTraceVisibility] = useState<Record<TraceKey, boolean>>({
    live: true,
    average: true,
    maxHold: true,
    minHold: false,
  });
  const [traces, setTraces] = useState<SystemTrace[] | null>(null);

const [isPanelOpen, setIsPanelOpen] = useState(false);
  // const [wsBins, setWsBins] = useState<SmsSpectrumOccupancyBin[]>([]);
  const [wsBins, setWsBins] = useState<Record<string, SmsSpectrumOccupancyBin[]>>({});


  // const [wsBins, setWsBins] = useState<SmsSpectrumOccupancyBin[]>([]);
  // const [wsBins, setWsBins] = useState<Record<string, SmsSpectrumOccupancyBin[]>>({});

  // const processedBins = useMemo<ProcessedBin[]>(() => {
  //   const sorted = [...bins].sort((left, right) => left.frequency_hz - right.frequency_hz);
  //   const mapped = sorted.map((bin) => ({
  //     frequencyHz: bin.frequency_hz,
  //     livePowerDbm:
  //       typeof bin.max_power_dbm === "number" ? Number(bin.max_power_dbm.toFixed(2)) : inferPowerFromDetections(bin.detection_count),
  //     detectionCount: bin.detection_count,
  //   }));
  //   return resampleBins(mapped, 360);
  // }, [bins]);

  // const inputBins = wsBins.length > 0 ? wsBins : bins;
  const systemKeys = Object.keys(wsBins);

  // const processedBins = useMemo<ProcessedBin[]>(() => {
  //   const sorted = [...inputBins].sort((l, r) => l.frequency_hz - r.frequency_hz);

  //   const mapped = sorted.map((bin) => ({
  //     frequencyHz: bin.frequency_hz,
  //     livePowerDbm:
  //       typeof bin.max_power_dbm === "number"
  //         ? Number(bin.max_power_dbm.toFixed(2))
  //         : inferPowerFromDetections(bin.detection_count),
  //     detectionCount: bin.detection_count,
  //   }));

  //   return resampleBins(mapped, 360);
  // }, [inputBins]);

  const processedSystems = useMemo(() => {
    const result: Record<string, ProcessedBin[]> = {};

    systemKeys.forEach((key) => {
      const data = wsBins[key];

      const sorted = [...data].sort((a, b) => a.frequency_hz - b.frequency_hz);

      const mapped = sorted.map((bin) => ({
        frequencyHz: bin.frequency_hz,
        livePowerDbm:
          typeof bin.max_power_dbm === "number"
            ? Number(bin.max_power_dbm.toFixed(2))
            : inferPowerFromDetections(bin.detection_count),
        detectionCount: bin.detection_count,
      }));

      result[key] = resampleBins(mapped, 200);
    });

    return result;
  }, [wsBins]);

  // useEffect(() => {
  //   if (processedBins.length === 0) {
  //     if (!isHold) {
  //       setTraces(null);
  //     }
  //     return;
  //   }

  //   if (isHold) {
  //     return;
  //   }

  //   // setTraces((previous) => buildTraces(previous, processedBins));

  //   const multiTraces = Object.entries(processedSystems).map(([key, bins]) => ({
  //     key,
  //     trace: buildTraces(null, bins),
  //   }));

  //   setTraces(multiTraces as any);
  //   }, [processedSystems, isHold]);

  useEffect(() => {
    if (systemKeys.length === 0) {
      if (!isHold) {
        setTraces(null);
      }
      return;
    }

    if (isHold) return;

    const multiTraces = Object.entries(processedSystems).map(([key, bins]) => ({
      key,
      // trace: buildTraces(null, bins),
      trace: buildTraces(traces?.find((t) => t.key === key)?.trace ?? null, bins),
    }));

    setTraces(multiTraces);
  }, [processedSystems, isHold, traces]);


  useEffect(() => {
    const ws = new WebSocket(resolveRfWsUrl());

    ws.onopen = () => console.log("✅ WS connected");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        const rf = msg.data ? msg.data : msg;
        if (!rf.freq) return;

        const newBin: SmsSpectrumOccupancyBin = {
          frequency_hz: rf.freq * 1_000_000,
          max_power_dbm: rf.power,
          detection_count: 1,
        };

        setWsBins((prev) => {
          const systemId = rf.system_id || "unknown";

          const existing = prev[systemId] || [];

          const newBin: SmsSpectrumOccupancyBin = {
            frequency_hz: rf.freq * 1_000_000,
            max_power_dbm: rf.power,
            detection_count: 1,
          };

          let updated = [...existing];

          const index = updated.findIndex(
            (b) => Math.abs(b.frequency_hz - newBin.frequency_hz) < 100000
          );

          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              max_power_dbm: Math.max(
                updated[index].max_power_dbm ?? -110,
                newBin.max_power_dbm ?? -110
              ),
              detection_count: updated[index].detection_count + 1,
            };
          } else {
            updated.push(newBin);
          }

          if (updated.length > 200) {
            updated = updated.slice(-200);
          }

          return {
            ...prev,
            [systemId]: updated,
          };
        });
      } catch (e) {
        console.error("WS error", e);
      }
    };

  ws.onclose = () => console.log("❌ WS closed");

  return () => ws.close();
}, []);

  const clearTraceHolds = useCallback(() => {
    setTraces((current) => {
      if (!current) {
        return current;
      }
      return current.map((system) => ({
        ...system,
        trace: {
          ...system.trace,
          maxHoldDbm: [...system.trace.liveDbm],
          minHoldDbm: [...system.trace.liveDbm],
        },
      }));
    });
  }, []);

  // const stats = useMemo(() => {
  //   if (!traces || traces.length === 0) {
  //     return null;
  //   }

  //   const startHz = traces.frequencyHz[0];
  //   const stopHz = traces.frequencyHz[traces.frequencyHz.length - 1];
  //   const centerHz = startHz + (stopHz - startHz) / 2;
  //   const peakIndex = traces.peakIndex;
  //   const peakHz = traces.frequencyHz[peakIndex];
  //   const peakDbm = traces.liveDbm[peakIndex];

  //   return {
  //     startHz,
  //     stopHz,
  //     centerHz,
  //     spanHz: stopHz - startHz,
  //     peakHz,
  //     peakDbm,
  //   };
  // }, [traces]);

  const stats = useMemo(() => {
  if (!traces || traces.length === 0) return null;

  const first = traces[0]?.trace;
    if (!first || first.frequencyHz.length === 0) return null;

    const startHz = first.frequencyHz[0];
    const stopHz = first.frequencyHz[first.frequencyHz.length - 1];
    const centerHz = startHz + (stopHz - startHz) / 2;
    const peakIndex = first.peakIndex;
    const peakHz = first.frequencyHz[peakIndex];
    const peakDbm = first.liveDbm[peakIndex];

    return {
      startHz,
      stopHz,
      centerHz,
      spanHz: stopHz - startHz,
      peakHz,
      peakDbm,
    };
  }, [traces]);

  const drawSpectrum = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const cssWidth = Math.max(520, container.clientWidth);
    const cssHeight = CHART_HEIGHT_PX;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    const margin = { top: 24, right: 18, bottom: 36, left: 58 };
    const plotWidth = Math.max(10, cssWidth - margin.left - margin.right);
    const plotHeight = Math.max(10, cssHeight - margin.top - margin.bottom);

    const backgroundGradient = context.createLinearGradient(0, margin.top, 0, margin.top + plotHeight);
    backgroundGradient.addColorStop(0, "#1e2434");
    backgroundGradient.addColorStop(0.7, "#121826");
    backgroundGradient.addColorStop(1, "#0b101a");
    context.fillStyle = backgroundGradient;
    context.fillRect(margin.left, margin.top, plotWidth, plotHeight);

    context.fillStyle = "#060a14";
    context.fillRect(0, 0, cssWidth, margin.top);

    context.strokeStyle = "rgba(255,255,255,0.14)";
    context.lineWidth = 1;

    const verticalGridCount = 10;
    for (let index = 0; index <= verticalGridCount; index += 1) {
      const x = margin.left + (index / verticalGridCount) * plotWidth;
      context.beginPath();
      context.moveTo(x + 0.5, margin.top);
      context.lineTo(x + 0.5, margin.top + plotHeight);
      context.stroke();
    }

    const horizontalGridCount = 10;
    for (let index = 0; index <= horizontalGridCount; index += 1) {
      const y = margin.top + (index / horizontalGridCount) * plotHeight;
      context.beginPath();
      context.moveTo(margin.left, y + 0.5);
      context.lineTo(margin.left + plotWidth, y + 0.5);
      context.stroke();
    }

    if (!traces || traces.length === 0) {
      context.fillStyle = "rgba(255,255,255,0.7)";
      context.font = "13px Consolas, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("No spectrum stream available", margin.left + plotWidth / 2, margin.top + plotHeight / 2);
      context.strokeStyle = "rgba(255,255,255,0.2)";
      context.strokeRect(margin.left, margin.top, plotWidth, plotHeight);
      context.restore(); // 👉 IMPORTANT: stop clipping
      return;
    }

    // const startHz = traces.frequencyHz[0];
    // const stopHz = traces.frequencyHz[traces.frequencyHz.length - 1];
    // const frequencyRangeHz = Math.max(1, stopHz - startHz);

    const first = traces[0]?.trace;
    if (!first) return;

    const startHz = first.frequencyHz[0];
    const stopHz = first.frequencyHz[first.frequencyHz.length - 1];
    const frequencyRangeHz = Math.max(1, stopHz - startHz);

    let observedMax = -90;
    let observedMin = -155;

    // for (let index = 0; index < traces.liveDbm.length; index += 1) {
    //   if (traceVisibility.live) {
    //     observedMax = Math.max(observedMax, traces.liveDbm[index]);
    //     observedMin = Math.min(observedMin, traces.liveDbm[index]);
    //   }
    //   if (traceVisibility.average) {
    //     observedMax = Math.max(observedMax, traces.averageDbm[index]);
    //     observedMin = Math.min(observedMin, traces.averageDbm[index]);
    //   }
    //   if (traceVisibility.maxHold) {
    //     observedMax = Math.max(observedMax, traces.maxHoldDbm[index]);
    //     observedMin = Math.min(observedMin, traces.maxHoldDbm[index]);
    //   }
    //   if (traceVisibility.minHold) {
    //     observedMax = Math.max(observedMax, traces.minHoldDbm[index]);
    //     observedMin = Math.min(observedMin, traces.minHoldDbm[index]);
    //   }
    // }

    traces.forEach((sys) => {
      const t = sys.trace;

          // const t = sys.trace;

      const colorMap: Record<string, string> = {
        "5507": "#ff3b3b",
        "5508": "#00d4ff",
        "5509": "#ffaa00",
      };

      const color = colorMap[sys.key] || "#ffffff";

      // for (let i = 0; i < t.liveDbm.length; i++) {
      //   if (traceVisibility.live) {
      //     observedMax = Math.max(observedMax, t.liveDbm[i]);
      //     observedMin = Math.min(observedMin, t.liveDbm[i]);
      //   }
      //   if (traceVisibility.average) {
      //     observedMax = Math.max(observedMax, t.averageDbm[i]);
      //     observedMin = Math.min(observedMin, t.averageDbm[i]);
      //   }
      //   if (traceVisibility.maxHold) {
      //     observedMax = Math.max(observedMax, t.maxHoldDbm[i]);
      //     observedMin = Math.min(observedMin, t.maxHoldDbm[i]);
      //   }
      //   if (traceVisibility.minHold) {
      //     observedMax = Math.max(observedMax, t.minHoldDbm[i]);
      //     observedMin = Math.min(observedMin, t.minHoldDbm[i]);
      //   }
      // }

    //   if (traceVisibility.live) {
    //     drawTrace(t.frequencyHz, t.liveDbm, color, 2.2);
    //   }

    //   // 👉 ONLY FIRST SYSTEM gets overlays
    //   if (index === 0) {
    //     if (traceVisibility.average) {
    //       drawTrace(t.frequencyHz, t.averageDbm, "#ffffff", 1.2);
    //     }

    //     if (traceVisibility.maxHold) {
    //       drawTrace(t.frequencyHz, t.maxHoldDbm, "#ff00ff", 1.2);
    //     }

    //     if (traceVisibility.minHold) {
    //       drawTrace(t.frequencyHz, t.minHoldDbm, "#00ff88", 1.2, true);
    //     }
    //   }
    // });
      for (let i = 0; i < t.liveDbm.length; i++) {
        if (traceVisibility.live) {
          observedMax = Math.max(observedMax, t.liveDbm[i]);
          observedMin = Math.min(observedMin, t.liveDbm[i]);
        }
        if (traceVisibility.average) {
          observedMax = Math.max(observedMax, t.averageDbm[i]);
          observedMin = Math.min(observedMin, t.averageDbm[i]);
        }
        if (traceVisibility.maxHold) {
          observedMax = Math.max(observedMax, t.maxHoldDbm[i]);
          observedMin = Math.min(observedMin, t.maxHoldDbm[i]);
        }
        if (traceVisibility.minHold) {
          observedMax = Math.max(observedMax, t.minHoldDbm[i]);
          observedMin = Math.min(observedMin, t.minHoldDbm[i]);
        }
      }
    });

    let dbmTop = autoScale ? Math.ceil((observedMax + 3) / 5) * 5 : -80;
    let dbmBottom = autoScale ? Math.floor((observedMin - 3) / 5) * 5 : -160;

    // if (dbmTop - dbmBottom < 35) {
    //   dbmBottom = dbmTop - 35;
    // }

    dbmTop = Math.min(dbmTop, -40);
    dbmBottom = Math.max(dbmBottom, -160);

    if (dbmTop - dbmBottom < 40) {
      dbmBottom = dbmTop - 40;
    }

    const powerSpan = Math.max(1, dbmTop - dbmBottom);
    // const maxDetectionCount = traces.detectionCount.reduce((maxValue, value) => Math.max(maxValue, value), 1);
    let maxDetectionCount = 1;

    traces.forEach((sys) => {
      const t = sys.trace;
      t.detectionCount.forEach((v: number) => {
        maxDetectionCount = Math.max(maxDetectionCount, v);
      });
    });

  // =========================
// SAFE SCALE FUNCTIONS
// =========================
const xForFrequency = (frequencyHz: number) => {
  const raw =
    margin.left + ((frequencyHz - startHz) / frequencyRangeHz) * plotWidth;

  return Math.max(margin.left, Math.min(margin.left + plotWidth, raw));
};

const yForPower = (dbm: number) => {
  const clamped = Math.max(dbmBottom, Math.min(dbmTop, dbm));
  const y =
    margin.top + ((dbmTop - clamped) / powerSpan) * plotHeight;

  return Math.max(margin.top, Math.min(margin.top + plotHeight, y));
};

// =========================
// TRACE DRAW
// =========================
const drawTrace = (
  freq: number[],
  series: number[],
  color: string,
  width: number,
  dashed = false
): void => {
  if (!freq || !series || series.length < 2) return;

  context.beginPath();
  context.setLineDash(dashed ? [5, 4] : []);

  let started = false;

  for (let i = 0; i < series.length; i++) {
    const f = freq[i];
    const p = series[i];

    if (!isFinite(f) || !isFinite(p)) continue;

    const x = xForFrequency(f);
    const y = yForPower(p);

    if (!isFinite(x) || !isFinite(y)) continue;

    if (!started) {
      context.moveTo(x, y);
      started = true;
    } else {
      context.lineTo(x, y);
    }
  }

  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();

  context.setLineDash([]);
};

// =========================
// 👉 CLIP GRAPH AREA
// =========================
context.save();
context.beginPath();
context.rect(margin.left, margin.top, plotWidth, plotHeight);
context.clip();

// =========================
// BARS
// =========================
context.fillStyle = "rgba(67,157,255,0.17)";

traces.forEach((sys) => {
  const t = sys.trace;

  for (let i = 0; i < t.detectionCount.length; i++) {
    const count = t.detectionCount[i];
    if (!count || count <= 0) continue;

    const x = xForFrequency(t.frequencyHz[i]);
    if (!isFinite(x)) continue;

    const barHeight = (count / maxDetectionCount) * 18;
    const y = margin.top + plotHeight - barHeight;

    context.fillRect(x, y, 1.2, barHeight);
  }
});

// =========================
// TRACES
// =========================
const colorMap: Record<string, string> = {
  "5507": "#ff3b3b",
  "5508": "#00d4ff",
  "5509": "#00ff88",
};

traces.forEach((sys) => {
  const t = sys.trace;
  const color = colorMap[sys.key] || "#ffffff";

  if (traceVisibility.live) {
    drawTrace(t.frequencyHz, t.liveDbm, color, 2.2);
  }

  if (traceVisibility.average) {
    drawTrace(t.frequencyHz, t.averageDbm, "#46d7ff", 1.2);
  }

  if (traceVisibility.maxHold) {
    drawTrace(t.frequencyHz, t.maxHoldDbm, "#ffffff", 1.2);
  }

  if (traceVisibility.minHold) {
    drawTrace(t.frequencyHz, t.minHoldDbm, "#57e38f", 1.2, true);
  }
});

// =========================
// END CLIP
// =========================
context.restore();



    // const xForFrequency = (frequencyHz: number) =>
    //   margin.left + ((frequencyHz - startHz) / frequencyRangeHz) * plotWidth;
    // // const yForPower = (dbm: number) => margin.top + ((dbmTop - dbm) / powerSpan) * plotHeight;

    // const yForPower = (dbm: number) => {
    //   const clamped = Math.max(dbmBottom, Math.min(dbmTop, dbm));
    //   return margin.top + ((dbmTop - clamped) / powerSpan) * plotHeight;
    // };

    // const drawTrace = (
    //       freq: number[],
    //       series: number[],
    //       color: string,
    //       width: number,
    //       dashed = false
    //     ): void => {
    //       if (series.length < 2) return;

    //       context.beginPath();
    //       context.setLineDash(dashed ? [5, 4] : []);

    //       for (let i = 0; i < series.length; i++) {
    //         const x = xForFrequency(freq[i]);
    //         const y = yForPower(series[i]);

    //         if (i === 0) context.moveTo(x, y);
    //         else context.lineTo(x, y);
    //       }

    //       context.strokeStyle = color;
    //       context.lineWidth = width;
    //       context.stroke();
    //       context.setLineDash([]);
    //     };


    context.fillStyle = "rgba(67, 157, 255, 0.17)";
    // for (let index = 0; index < traces.detectionCount.length; index += 1) {
    //   const count = traces.detectionCount[index];
    //   if (count <= 0) {
    //     continue;
    //   }
    //   const x = xForFrequency(traces.frequencyHz[index]);
    //   const barHeight = (count / maxDetectionCount) * 18;
    //   context.fillRect(x, margin.top + plotHeight - barHeight, 1.2, barHeight);
    // }

          
    traces.forEach((sys) => {
      const t = sys.trace;

      for (let i = 0; i < t.detectionCount.length; i++) {
        const count = t.detectionCount[i];
        if (count <= 0) continue;

        const x = xForFrequency(t.frequencyHz[i]);

        // const drawTrace = (
        //   freq: number[],
        //   series: number[],
        //   color: string,
        //   width: number,
        //   dashed = false
        // ): void => {
        //   if (series.length < 2) return;

        //   context.beginPath();
        //   context.setLineDash(dashed ? [5, 4] : []);

        //   for (let i = 0; i < series.length; i++) {
        //     const x = xForFrequency(freq[i]);
        //     const y = yForPower(series[i]);

        //     if (i === 0) context.moveTo(x, y);
        //     else context.lineTo(x, y);
        //   }

        //   context.strokeStyle = color;
        //   context.lineWidth = width;
        //   context.stroke();
        //   context.setLineDash([]);
        // };


        const barHeight = (count / maxDetectionCount) * 18;

        context.fillRect(x, margin.top + plotHeight - barHeight, 1.2, barHeight);
      }
    });

    // const drawTrace = (series: number[], color: string, width: number, dashed = false): void => {
    //   if (series.length < 2) {
    //     return;
    //   }
    //   context.beginPath();
    //   context.setLineDash(dashed ? [5, 4] : []);
    //   for (let index = 0; index < series.length; index += 1) {
    //     const x = xForFrequency(traces.frequencyHz[index]);
    //     const y = yForPower(series[index]);
    //     if (index === 0) {
    //       context.moveTo(x, y);
    //     } else {
    //       context.lineTo(x, y);
    //     }
    //   }
    //   context.strokeStyle = color;
    //   context.lineWidth = width;
    //   context.stroke();
    //   context.setLineDash([]);
    // };

    // if (traceVisibility.maxHold) {
    //   drawTrace(traces.maxHoldDbm, "#f4f7ff", 1.6);
    // }
    // if (traceVisibility.average) {
    //   drawTrace(traces.averageDbm, "#46d7ff", 1.4);
    // }
    // // if (traceVisibility.live) {
    // //   drawTrace(traces.liveDbm, "#e9ea3b", 1.9);
    // // }
    // const colors: Record<string, string> = {
    //   "5507": "#e9ea3b", // yellow
    //   "5508": "#46d7ff", // blue
    //   "5509": "#57e38f", // green
    // };

    // (traces as any[]).forEach((sys) => {
    //   const t = sys.trace;
    //   const color = colors[sys.key] || "#ffffff";

    //   drawTrace(t.liveDbm, color, 1.8);
    // });
    // if (traceVisibility.minHold) {
    //   drawTrace(traces.minHoldDbm, "#57e38f", 1.4, true);
    // }

    traces.forEach((sys) => {
      const t = sys.trace;
      const colorMap: Record<string, string> = {
        // "5507": "#e9ea3b",
        // "5508": "#46d7ff",
        // "5509": "#57e38f",
        "5507": "#ff3b3b", // 🔴 RED
        "5508": "#00d4ff", // 🔵 CYAN
        "5509": "#00ff88", // 🟢 GREEN
        
      };

      const color = colorMap[sys.key] || "#ffffff";

      if (traceVisibility.live) {
        drawTrace(t.frequencyHz, t.liveDbm, color, 2.2);
      }

      if (traceVisibility.average) {
        drawTrace(t.frequencyHz, t.averageDbm, "#46d7ff", 1.2);
      }

      if (traceVisibility.maxHold) {
        drawTrace(t.frequencyHz, t.maxHoldDbm, "#ffffff", 1.2);
      }

      if (traceVisibility.minHold) {
        drawTrace(t.frequencyHz, t.minHoldDbm, "#57e38f", 1.2, true);
      }
    });

    // const peakIndex = traces.peakIndex;
    // const peakFrequencyHz = traces.frequencyHz[peakIndex];
    // const peakPowerDbm = traces.liveDbm[peakIndex];
    // const peakX = xForFrequency(peakFrequencyHz);
    // const peakY = yForPower(peakPowerDbm);

    // context.strokeStyle = "rgba(255, 233, 64, 0.5)";
    // context.lineWidth = 1;
    // context.setLineDash([4, 4]);
    // context.beginPath();
    // context.moveTo(peakX, margin.top);
    // context.lineTo(peakX, margin.top + plotHeight);
    // context.stroke();
    // context.setLineDash([]);

    // context.fillStyle = "#f6e95b";
    // context.beginPath();
    // context.moveTo(peakX, peakY + 3);
    // context.lineTo(peakX - 5, peakY - 8);
    // context.lineTo(peakX + 5, peakY - 8);
    // context.closePath();
    // context.fill();

    // context.fillStyle = "rgba(255,255,255,0.75)";
    // context.font = "11px Consolas, monospace";
    // context.textAlign = "right";
    // context.textBaseline = "middle";

    // for (let index = 0; index <= horizontalGridCount; index += 1) {
    //   const dbmValue = dbmTop - (index / horizontalGridCount) * powerSpan;
    //   const y = margin.top + (index / horizontalGridCount) * plotHeight;
    //   context.fillText(`${dbmValue.toFixed(0)}`, margin.left - 8, y);
    // }

    context.textAlign = "center";
    context.textBaseline = "top";
    for (let index = 0; index <= verticalGridCount; index += 1) {
      const frequencyHz = startHz + (index / verticalGridCount) * frequencyRangeHz;
      const x = margin.left + (index / verticalGridCount) * plotWidth;
      context.fillText(`${(frequencyHz / 1_000_000).toFixed(3)}`, x, margin.top + plotHeight + 5);
    }

    context.fillStyle = "rgba(255,255,255,0.55)";
    context.font = "11px sans-serif";
    context.textAlign = "center";
    context.fillText("Frequency (MHz)", margin.left + plotWidth / 2, cssHeight - 4);

    context.save();
    context.translate(16, margin.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center";
    context.fillText("Ref dBm", 0, 0);
    context.restore();

    context.fillStyle = "#f6e95b";
    context.font = "bold 12px Consolas, monospace";
    context.textAlign = "left";
    context.textBaseline = "top";
    // const peakLabel = `${formatFrequencyHz(peakFrequencyHz)}  ${peakPowerDbm.toFixed(1)} dBm`;
    const peakLabel = "Multi-system RF signals";
    context.fillText(peakLabel, margin.left + 8, margin.top + 8);

    context.fillStyle = "rgba(255,255,255,0.78)";
    context.font = "bold 12px sans-serif";
    context.textAlign = "center";
    context.fillText("RF Spectrum Analyzer", cssWidth / 2, 6);

    if (loading) {
      context.fillStyle = "#7cc3ff";
      context.font = "11px Consolas, monospace";
      context.textAlign = "right";
      context.fillText("REFRESHING", cssWidth - 10, 6);
    }

    context.strokeStyle = "rgba(255,255,255,0.25)";
    context.lineWidth = 1;
    context.strokeRect(margin.left, margin.top, plotWidth, plotHeight);
    context.restore(); // 👉 IMPORTANT: stop clipping
  }, [autoScale, loading, traceVisibility, traces]);

  useEffect(() => {
    drawSpectrum();
  }, [drawSpectrum]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      drawSpectrum();
    });

    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, [drawSpectrum]);

  const toggleTrace = (key: TraceKey) => {
    setTraceVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  // ✅ MOVE THESE UP (above sidePanel)

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between" }}>
    <span style={{ color: "#9db0d8" }}>{label}</span>
    <span>{value}</span>
  </div>
);

const ToggleBtn = ({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      width: "100%",
      textAlign: "left",
      padding: "6px 8px",
      background: active ? "#2a3347" : "#171d2c",
      border: "1px solid #3b4a6e",
      color,
      borderRadius: 4,
      fontFamily: "Consolas, monospace",
      fontSize: 12,
      cursor: "pointer",
    }}
  >
    {label}
  </button>
);
  const sidePanel = (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 12,
      height: "100%",
      overflowY: "auto", // ✅ scroll if content grows
      paddingRight: 4,
    }}
  >
    {/* ===== STATS ===== */}
    <div
      style={{
        border: "1px solid #324062",
        borderRadius: 6,
        padding: "10px 12px",
        background: "#0d1321",
        fontFamily: "Consolas, monospace",
        color: "#d7e3ff",
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <div style={{ marginBottom: 6, color: "#9db0d8", fontWeight: 600 }}>
        Spectrum
      </div>

      <Row label="Centre" value={stats ? `${(stats.centerHz / 1_000_000).toFixed(6)} MHz` : "-"} />
      <Row label="Start" value={stats ? `${(stats.startHz / 1_000_000).toFixed(6)} MHz` : "-"} />
      <Row label="Stop" value={stats ? `${(stats.stopHz / 1_000_000).toFixed(6)} MHz` : "-"} />
      <Row label="Span" value={stats ? formatFrequencyHz(stats.spanHz) : "-"} />
    </div>

    {/* ===== TRACE CONTROL ===== */}
    <div
      style={{
        border: "1px solid #324062",
        borderRadius: 6,
        padding: "10px 12px",
        background: "#0d1321",
        color: "#d7e3ff",
        fontFamily: "Consolas, monospace",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 8, color: "#9db0d8", fontWeight: 600 }}>
        Trace Control
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <ToggleBtn label="Live" active={traceVisibility.live} color="#e9ea3b" onClick={() => toggleTrace("live")} />
        <ToggleBtn label="Average" active={traceVisibility.average} color="#46d7ff" onClick={() => toggleTrace("average")} />
        <ToggleBtn label="Max Hold" active={traceVisibility.maxHold} color="#ffffff" onClick={() => toggleTrace("maxHold")} />
        <ToggleBtn label="Min Hold" active={traceVisibility.minHold} color="#57e38f" onClick={() => toggleTrace("minHold")} />
      </div>
    </div>

    {/* ===== MARKERS ===== */}
    <div
      style={{
        border: "1px solid #324062",
        borderRadius: 6,
        padding: "10px 12px",
        background: "#0d1321",
        color: "#d7e3ff",
        fontFamily: "Consolas, monospace",
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <div style={{ marginBottom: 6, color: "#9db0d8", fontWeight: 600 }}>
        Markers
      </div>

      <Row label="Peak freq" value={stats ? formatFrequencyHz(stats.peakHz) : "-"} />
      <Row label="Peak level" value={stats ? `${stats.peakDbm.toFixed(1)} dBm` : "-"} />
      <Row label="Mode" value={isHold ? "HOLD" : "RUN"} />
    </div>
  </div>
);


  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>Spectrum Analyzer View</h3>
            <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
              Multi-trace spectrum with peak marker, hold mode, and analyzer controls.
            </div>
          </div>
          <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
            {/* {loading ? "Refreshing..." : `Bins: ${processedBins.length}`} */}
            {loading ? "Refreshing..." : `Bins: ${Object.keys(wsBins).length}`}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #2c354b",
            borderRadius: theme.radius.md,
            background: "#101624",
            padding: 8,
            display: "grid",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              background: "#0b101c",
              border: "1px solid #27314b",
              borderRadius: 6,
              padding: "6px 8px",
            }}
          >
            <button
  type="button"
  onClick={() => setIsPanelOpen(true)}
  style={{
    background: "#1d283d",
    border: "1px solid #3b4b6e",
    color: "#d4def2",
    borderRadius: 4,
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
  }}
>
  Controls
</button>
            <button
              type="button"
              onClick={() => setIsHold((current) => !current)}
              style={{
                background: isHold ? "#8c3b3b" : "#274873",
                border: "1px solid #42618b",
                color: "#ecf3ff",
                borderRadius: 4,
                padding: "5px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {isHold ? "Run" : "Hold"}
            </button>
            <button
              type="button"
              onClick={clearTraceHolds}
              style={{
                background: "#1d283d",
                border: "1px solid #3b4b6e",
                color: "#d4def2",
                borderRadius: 4,
                padding: "5px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear holds
            </button>
            <button
              type="button"
              onClick={() => setAutoScale((current) => !current)}
              style={{
                background: autoScale ? "#274873" : "#1d283d",
                border: "1px solid #3b4b6e",
                color: "#d4def2",
                borderRadius: 4,
                padding: "5px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {autoScale ? "Autoscale on" : "Autoscale off"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 8,
              alignItems: "start",
            }}
          >
            <div
              ref={containerRef}
              style={{
                border: "1px solid #28324b",
                borderRadius: 6,
                background: "#090e18",
                overflow: "hidden",
              }}
            >
              <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: CHART_HEIGHT_PX }} />
            </div>
     {/* =========================
   POPUP PANEL (MODAL)
========================= */}
{isPanelOpen && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.6)", // overlay
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
    }}
  >
    {/* MODAL BOX */}
    <div
      style={{
        width: 320,
        maxHeight: "80%",
        overflowY: "auto",
        background: "#111726",
        border: "1px solid #28314a",
        borderRadius: 8,
        padding: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <strong style={{ color: "#d7e3ff" }}>Controls</strong>

        <button
          onClick={() => setIsPanelOpen(false)}
          style={{
            background: "#8c3b3b",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          ✖
        </button>
      </div>

      {/* PANEL CONTENT */}
      {sidePanel}
    </div>
  </div>
)}
          </div>
        </div>

        <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
          {lastUpdatedAt
            ? `Last update: ${new Date(lastUpdatedAt).toLocaleTimeString()}`
            : "Waiting for first telemetry update."}
        </div>
      </div>
    </Card>
  );
}


