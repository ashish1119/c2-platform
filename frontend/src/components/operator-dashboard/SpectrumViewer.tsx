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

const CHART_HEIGHT_PX = 350;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatFrequencyHz(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(6)} GHz`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(6)} MHz`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(3)} kHz`;
  }
  return `${value.toFixed(1)} Hz`;
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
  const [traces, setTraces] = useState<AnalyzerTraces | null>(null);

  const processedBins = useMemo<ProcessedBin[]>(() => {
    const sorted = [...bins].sort((left, right) => left.frequency_hz - right.frequency_hz);
    const mapped = sorted.map((bin) => ({
      frequencyHz: bin.frequency_hz,
      livePowerDbm:
        typeof bin.max_power_dbm === "number" ? Number(bin.max_power_dbm.toFixed(2)) : inferPowerFromDetections(bin.detection_count),
      detectionCount: bin.detection_count,
    }));
    return resampleBins(mapped, 360);
  }, [bins]);

  useEffect(() => {
    if (processedBins.length === 0) {
      if (!isHold) {
        setTraces(null);
      }
      return;
    }

    if (isHold) {
      return;
    }

    setTraces((previous) => buildTraces(previous, processedBins));
  }, [processedBins, isHold]);

  const clearTraceHolds = useCallback(() => {
    setTraces((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        maxHoldDbm: [...current.liveDbm],
        minHoldDbm: [...current.liveDbm],
      };
    });
  }, []);

  const stats = useMemo(() => {
    if (!traces || traces.frequencyHz.length === 0) {
      return null;
    }

    const startHz = traces.frequencyHz[0];
    const stopHz = traces.frequencyHz[traces.frequencyHz.length - 1];
    const centerHz = startHz + (stopHz - startHz) / 2;
    const peakIndex = traces.peakIndex;
    const peakHz = traces.frequencyHz[peakIndex];
    const peakDbm = traces.liveDbm[peakIndex];

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

    if (!traces || traces.frequencyHz.length < 2) {
      context.fillStyle = "rgba(255,255,255,0.7)";
      context.font = "13px Consolas, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("No spectrum stream available", margin.left + plotWidth / 2, margin.top + plotHeight / 2);
      context.strokeStyle = "rgba(255,255,255,0.2)";
      context.strokeRect(margin.left, margin.top, plotWidth, plotHeight);
      return;
    }

    const startHz = traces.frequencyHz[0];
    const stopHz = traces.frequencyHz[traces.frequencyHz.length - 1];
    const frequencyRangeHz = Math.max(1, stopHz - startHz);

    let observedMax = -90;
    let observedMin = -155;

    for (let index = 0; index < traces.liveDbm.length; index += 1) {
      if (traceVisibility.live) {
        observedMax = Math.max(observedMax, traces.liveDbm[index]);
        observedMin = Math.min(observedMin, traces.liveDbm[index]);
      }
      if (traceVisibility.average) {
        observedMax = Math.max(observedMax, traces.averageDbm[index]);
        observedMin = Math.min(observedMin, traces.averageDbm[index]);
      }
      if (traceVisibility.maxHold) {
        observedMax = Math.max(observedMax, traces.maxHoldDbm[index]);
        observedMin = Math.min(observedMin, traces.maxHoldDbm[index]);
      }
      if (traceVisibility.minHold) {
        observedMax = Math.max(observedMax, traces.minHoldDbm[index]);
        observedMin = Math.min(observedMin, traces.minHoldDbm[index]);
      }
    }

    let dbmTop = autoScale ? Math.ceil((observedMax + 3) / 5) * 5 : -80;
    let dbmBottom = autoScale ? Math.floor((observedMin - 3) / 5) * 5 : -160;

    if (dbmTop - dbmBottom < 35) {
      dbmBottom = dbmTop - 35;
    }

    const powerSpan = Math.max(1, dbmTop - dbmBottom);
    const maxDetectionCount = traces.detectionCount.reduce((maxValue, value) => Math.max(maxValue, value), 1);

    const xForFrequency = (frequencyHz: number) =>
      margin.left + ((frequencyHz - startHz) / frequencyRangeHz) * plotWidth;
    const yForPower = (dbm: number) => margin.top + ((dbmTop - dbm) / powerSpan) * plotHeight;

    context.fillStyle = "rgba(67, 157, 255, 0.17)";
    for (let index = 0; index < traces.detectionCount.length; index += 1) {
      const count = traces.detectionCount[index];
      if (count <= 0) {
        continue;
      }
      const x = xForFrequency(traces.frequencyHz[index]);
      const barHeight = (count / maxDetectionCount) * 18;
      context.fillRect(x, margin.top + plotHeight - barHeight, 1.2, barHeight);
    }

    const drawTrace = (series: number[], color: string, width: number, dashed = false): void => {
      if (series.length < 2) {
        return;
      }
      context.beginPath();
      context.setLineDash(dashed ? [5, 4] : []);
      for (let index = 0; index < series.length; index += 1) {
        const x = xForFrequency(traces.frequencyHz[index]);
        const y = yForPower(series[index]);
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.strokeStyle = color;
      context.lineWidth = width;
      context.stroke();
      context.setLineDash([]);
    };

    if (traceVisibility.maxHold) {
      drawTrace(traces.maxHoldDbm, "#f4f7ff", 1.6);
    }
    if (traceVisibility.average) {
      drawTrace(traces.averageDbm, "#46d7ff", 1.4);
    }
    if (traceVisibility.live) {
      drawTrace(traces.liveDbm, "#e9ea3b", 1.9);
    }
    if (traceVisibility.minHold) {
      drawTrace(traces.minHoldDbm, "#57e38f", 1.4, true);
    }

    const peakIndex = traces.peakIndex;
    const peakFrequencyHz = traces.frequencyHz[peakIndex];
    const peakPowerDbm = traces.liveDbm[peakIndex];
    const peakX = xForFrequency(peakFrequencyHz);
    const peakY = yForPower(peakPowerDbm);

    context.strokeStyle = "rgba(255, 233, 64, 0.5)";
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(peakX, margin.top);
    context.lineTo(peakX, margin.top + plotHeight);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "#f6e95b";
    context.beginPath();
    context.moveTo(peakX, peakY + 3);
    context.lineTo(peakX - 5, peakY - 8);
    context.lineTo(peakX + 5, peakY - 8);
    context.closePath();
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.75)";
    context.font = "11px Consolas, monospace";
    context.textAlign = "right";
    context.textBaseline = "middle";

    for (let index = 0; index <= horizontalGridCount; index += 1) {
      const dbmValue = dbmTop - (index / horizontalGridCount) * powerSpan;
      const y = margin.top + (index / horizontalGridCount) * plotHeight;
      context.fillText(`${dbmValue.toFixed(0)}`, margin.left - 8, y);
    }

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
    const peakLabel = `${formatFrequencyHz(peakFrequencyHz)}  ${peakPowerDbm.toFixed(1)} dBm`;
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

  const sidePanel = (
    <div
      style={{
        width: 250,
        minWidth: 250,
        display: "grid",
        gap: 8,
        padding: 8,
        background: "#111726",
        border: "1px solid #28314a",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          border: "1px solid #324062",
          borderRadius: 4,
          padding: "8px 10px",
          background: "#0d1321",
          fontFamily: "Consolas, monospace",
          color: "#d7e3ff",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Centre</span>
          <strong>{stats ? `${(stats.centerHz / 1_000_000).toFixed(6)} MHz` : "-"}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Start</span>
          <span>{stats ? `${(stats.startHz / 1_000_000).toFixed(6)} MHz` : "-"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Stop</span>
          <span>{stats ? `${(stats.stopHz / 1_000_000).toFixed(6)} MHz` : "-"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Span</span>
          <span>{stats ? formatFrequencyHz(stats.spanHz) : "-"}</span>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #324062",
          borderRadius: 4,
          padding: "8px 10px",
          background: "#0d1321",
          color: "#d7e3ff",
          fontFamily: "Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        <div style={{ marginBottom: 6, color: "#9db0d8" }}>Trace control</div>
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <button
            type="button"
            onClick={() => toggleTrace("live")}
            style={{
              background: toButtonColor(traceVisibility.live),
              border: "1px solid #3b4a6e",
              color: "#e9ea3b",
              borderRadius: 4,
              padding: "5px 6px",
              fontFamily: "Consolas, monospace",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => toggleTrace("average")}
            style={{
              background: toButtonColor(traceVisibility.average),
              border: "1px solid #3b4a6e",
              color: "#46d7ff",
              borderRadius: 4,
              padding: "5px 6px",
              fontFamily: "Consolas, monospace",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Avg
          </button>
          <button
            type="button"
            onClick={() => toggleTrace("maxHold")}
            style={{
              background: toButtonColor(traceVisibility.maxHold),
              border: "1px solid #3b4a6e",
              color: "#f4f7ff",
              borderRadius: 4,
              padding: "5px 6px",
              fontFamily: "Consolas, monospace",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Max
          </button>
          <button
            type="button"
            onClick={() => toggleTrace("minHold")}
            style={{
              background: toButtonColor(traceVisibility.minHold),
              border: "1px solid #3b4a6e",
              color: "#57e38f",
              borderRadius: 4,
              padding: "5px 6px",
              fontFamily: "Consolas, monospace",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Min
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #324062",
          borderRadius: 4,
          padding: "8px 10px",
          background: "#0d1321",
          color: "#d7e3ff",
          fontFamily: "Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <div style={{ marginBottom: 6, color: "#9db0d8" }}>Markers</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Peak freq</span>
          <span>{stats ? formatFrequencyHz(stats.peakHz) : "-"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Peak level</span>
          <span>{stats ? `${stats.peakDbm.toFixed(1)} dBm` : "-"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Mode</span>
          <span>{isHold ? "HOLD" : "RUN"}</span>
        </div>
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
            {loading ? "Refreshing..." : `Bins: ${processedBins.length}`}
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
            {sidePanel}
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
