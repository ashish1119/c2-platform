import { useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import Card from "../components/ui/Card";
import MapView from "../components/MapView";
import { simulateCoverage, type CoveragePoint } from "../api/planning";
import { useTheme } from "../context/ThemeContext";

export default function PlanningPage() {
  const { theme } = useTheme();
  const [scenarioName, setScenarioName] = useState("Baseline Coverage");
  const [frequency, setFrequency] = useState(2400);
  const [radiusKm, setRadiusKm] = useState(10);
  const [txPower, setTxPower] = useState(30);
  const [points, setPoints] = useState<CoveragePoint[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    try {
      setRunning(true);
      setError(null);
      const response = await simulateCoverage({
        scenario_name: scenarioName,
        model_name: "FreeSpace",
        center_latitude: 28.7041,
        center_longitude: 77.1025,
        radius_km: radiusKm,
        transmit_power_dbm: txPower,
        frequency_mhz: frequency,
      });
      setPoints(response.data.points);
    } catch {
      setError("Coverage simulation failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer title="Planning Tool">
        <Card>
          <div style={{ display: "grid", gap: 12 }}>
            <label>
              Scenario
              <input
                style={{
                  width: "100%",
                  padding: theme.spacing.sm,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  background: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                }}
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
              />
            </label>
            <label>
              Frequency (MHz)
              <input
                style={{
                  width: "100%",
                  padding: theme.spacing.sm,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  background: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                }}
                type="number"
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
              />
            </label>
            <label>
              Radius (km)
              <input
                style={{
                  width: "100%",
                  padding: theme.spacing.sm,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  background: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                }}
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
              />
            </label>
            <label>
              Transmit Power (dBm)
              <input
                style={{
                  width: "100%",
                  padding: theme.spacing.sm,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  background: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                }}
                type="number"
                value={txPower}
                onChange={(e) => setTxPower(Number(e.target.value))}
              />
            </label>
            <button
              style={{
                width: "fit-content",
                border: "none",
                borderRadius: theme.radius.md,
                background: theme.colors.primary,
                color: "#fff",
                cursor: "pointer",
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              }}
              onClick={runSimulation}
              disabled={running}
            >
              {running ? "Running Simulation..." : "Run Coverage Simulation"}
            </button>
            {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Coverage Results</h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: theme.colors.surfaceAlt,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              overflow: "hidden",
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Latitude</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Longitude</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Coverage (dB)</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, idx) => (
                <tr key={`${point.latitude}-${point.longitude}-${idx}`}>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{point.latitude}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{point.longitude}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{point.coverage_db}</td>
                </tr>
              ))}
              {points.length === 0 && (
                <tr>
                  <td style={{ padding: theme.spacing.sm }} colSpan={3}>No simulation points yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <MapView coveragePoints={points} />
      </PageContainer>
    </AppLayout>
  );
}
