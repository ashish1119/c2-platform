import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import SimulationControls from "../../features/signal-simulation/components/SimulationControls";
import SpectrumChart from "../../features/signal-simulation/components/SpectrumChart";
import WaveformChart from "../../features/signal-simulation/components/WaveformChart";
import CanvasWaterfall from "../../components/operator-dashboard/CanvasWaterfall";
import DirectionIndicator from "../../features/signal-simulation/components/DirectionIndicator";
import EventPanel from "../../features/signal-simulation/components/EventPanel";
import { useSignalSimulation } from "../../features/signal-simulation/state/useSignalSimulation";
import {
  startDashboardSimulation,
  stopDashboardSimulation,
} from "../../features/signal-simulation/state/dashboardSimulationBridge";
import type { SimulationConfig } from "../../features/signal-simulation/model/types";
import { useTheme } from "../../context/ThemeContext";

export default function OperatorSignalSimulationPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [centerFrequencyMhz, setCenterFrequencyMhz] = useState(433.92);
  const [noiseFloorDbm, setNoiseFloorDbm] = useState(-102);

  const simulationConfig = useMemo<SimulationConfig>(
    () => ({
      seed: 1337,
      updateIntervalMs: 180,
      waveformSampleRateHz: 500_000,
      waveformSamples: 320,
      spectrumMinHz: (centerFrequencyMhz - 20) * 1_000_000,
      spectrumMaxHz: (centerFrequencyMhz + 20) * 1_000_000,
      spectrumBins: 220,
      noiseFloorDbm,
      historyLimit: 240,
      trackingEmitterId: "rf-link-a",
      bearingRayLengthM: 12_000,
      parallelAngleThresholdDeg: 6,
      maxIntersectionDistanceM: 25_000,
      heatmapGridSize: 13,
      heatmapCellSizeM: 180,
      sensors: [
        {
          id: "sim-df-1",
          label: "SIM DF North",
          location: { latitude: 12.984, longitude: 77.586 },
          bearingNoiseStdDeg: 1.8,
          bearingBiasDeg: 0.4,
          confidence: 0.95,
        },
        {
          id: "sim-df-2",
          label: "SIM DF East",
          location: { latitude: 12.973, longitude: 77.613 },
          bearingNoiseStdDeg: 2.2,
          bearingBiasDeg: -0.6,
          confidence: 0.9,
        },
        {
          id: "sim-df-3",
          label: "SIM DF South",
          location: { latitude: 12.956, longitude: 77.596 },
          bearingNoiseStdDeg: 1.6,
          bearingBiasDeg: 0.2,
          confidence: 0.94,
        },
      ],
      emitters: [
        {
          id: "rf-link-a",
          label: "Tracked Emitter",
          baseFrequencyHz: 433_920_000,
          bandwidthHz: 220_000,
          basePowerDbm: -58,
          fadeDepthDb: 7,
          fadeRateHz: 0.20,
          driftHz: 65_000,
          driftRateHz: 0.08,
          initialLocation: { latitude: 12.9724, longitude: 77.5982 },
          headingDeg: 118,
          speedMps: 2.6,
          turnRateDegPerSec: 0.35,
        },
        {
          id: "rf-link-b",
          label: "Relay Interferer",
          baseFrequencyHz: 434_250_000,
          bandwidthHz: 180_000,
          basePowerDbm: -66,
          fadeDepthDb: 5,
          fadeRateHz: 0.16,
          driftHz: 48_000,
          driftRateHz: 0.05,
          initialLocation: { latitude: 12.9688, longitude: 77.6066 },
          headingDeg: 212,
          speedMps: 0.9,
          turnRateDegPerSec: -0.15,
        },
        {
          id: "rf-link-c",
          label: "Telemetry Spur",
          baseFrequencyHz: 432_700_000,
          bandwidthHz: 140_000,
          basePowerDbm: -73,
          fadeDepthDb: 4,
          fadeRateHz: 0.11,
          driftHz: 35_000,
          driftRateHz: 0.03,
          initialLocation: { latitude: 12.9612, longitude: 77.5885 },
          headingDeg: 36,
          speedMps: 0.5,
          turnRateDegPerSec: 0.08,
        },
      ],
    }),
    [centerFrequencyMhz, noiseFloorDbm]
  );

  const simulation = useSignalSimulation(simulationConfig);
  const latestFrame = simulation.state.latestFrame;

  const handlePublishToDashboard = () => {
    startDashboardSimulation(simulationConfig);
    navigate("/operator/dashboard");
  };

  const handlePublishToOperatorMap = () => {
    startDashboardSimulation(simulationConfig);
    navigate("/operator/map");
  };

  const handleStopDashboardSimulation = () => {
    stopDashboardSimulation();
  };

  return (
    <AppLayout>
      <PageContainer title="RF + DF Simulation">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <Card>
            <div style={{ display: "grid", gap: theme.spacing.md }}>
              <div>
                <h2 style={{ margin: 0 }}>RF and DF Signal Simulation Lab</h2>
                <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
                  Multi-sensor DF scenario with noisy AOA bearings, triangulation, centroid estimation, and uncertainty heatmap output.
                </div>
              </div>

              <SimulationControls
                running={simulation.state.running}
                centerFrequencyMhz={centerFrequencyMhz}
                noiseFloorDbm={noiseFloorDbm}
                onCenterFrequencyMhzChange={setCenterFrequencyMhz}
                onNoiseFloorDbmChange={setNoiseFloorDbm}
                onStart={simulation.controls.start}
                onStop={simulation.controls.stop}
                onReset={simulation.controls.reset}
              />

              <div style={{ display: "flex", flexWrap: "wrap", gap: theme.spacing.sm }}>
                <button
                  type="button"
                  onClick={handlePublishToDashboard}
                  style={{
                    border: "none",
                    borderRadius: theme.radius.md,
                    background: theme.colors.primary,
                    color: "#ffffff",
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    cursor: "pointer",
                  }}
                >
                  Show Simulation on Operator Dashboard
                </button>

                <button
                  type="button"
                  onClick={handlePublishToOperatorMap}
                  style={{
                    border: "none",
                    borderRadius: theme.radius.md,
                    background: theme.colors.success,
                    color: "#ffffff",
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    cursor: "pointer",
                  }}
                >
                  Show Simulation on Operator Map
                </button>

                <button
                  type="button"
                  onClick={handleStopDashboardSimulation}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.md,
                    background: theme.colors.surfaceAlt,
                    color: theme.colors.textPrimary,
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    cursor: "pointer",
                  }}
                >
                  Stop Dashboard Simulation Feed
                </button>
              </div>
            </div>
          </Card>

          <div
            style={{
              display: "grid",
              gap: theme.spacing.lg,
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            }}
          >
            <Card>
              <h3 style={{ marginTop: 0 }}>Spectrum View</h3>
              <SpectrumChart bins={latestFrame?.spectrum ?? []} />
              <div style={{ marginTop: 8 }}>
                <CanvasWaterfall
                  sweep={latestFrame?.spectrum ?? null}
                  noiseFloorDbm={noiseFloorDbm}
                  ceilingDbm={noiseFloorDbm + 80}
                  maxRows={200}
                  height={260}
                  title="Waterfall History"
                />
              </div>
            </Card>

            <Card>
              <h3 style={{ marginTop: 0 }}>Time-Series Waveform</h3>
              <WaveformChart points={latestFrame?.waveform ?? []} />
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gap: theme.spacing.lg,
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            }}
          >
            <Card>
              <h3 style={{ marginTop: 0 }}>Direction / Angle Indicator</h3>
              <DirectionIndicator vectors={latestFrame?.dfVectors ?? []} />
            </Card>

            <Card>
              <h3 style={{ marginTop: 0 }}>Simulation Events</h3>
              <EventPanel events={latestFrame?.events ?? []} />
            </Card>
          </div>

          <Card>
            <h3 style={{ marginTop: 0 }}>Active Signal Snapshot</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Emitter</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Frequency</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Power</th>
                          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Location</th>
                          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Track</th>
                  </tr>
                </thead>
                <tbody>
                  {(latestFrame?.activeSignals ?? []).map((signal) => (
                    <tr key={signal.emitterId}>
                      <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{signal.label}</td>
                      <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                        {(signal.frequencyHz / 1_000_000).toFixed(4)} MHz
                      </td>
                      <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                        {signal.powerDbm.toFixed(1)} dBm
                      </td>
                      <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                        {signal.location.latitude.toFixed(4)}, {signal.location.longitude.toFixed(4)}
                      </td>
                      <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                        {signal.isTrackedTarget ? "Triangulated target" : `${signal.headingDeg.toFixed(0)} deg @ ${signal.speedMps.toFixed(1)} m/s`}
                      </td>
                    </tr>
                  ))}

                  {(latestFrame?.activeSignals ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: theme.spacing.sm, color: theme.colors.textSecondary }}>
                        No frame available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
