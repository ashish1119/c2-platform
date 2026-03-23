import { useMemo, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import Card from "../components/ui/Card";
import MapView from "../components/MapView";
import { getEOBReport, getStatisticalReport, type EOBEntry, type StatisticalReport } from "../api/reports";
import { simulateCoverage, type CoveragePoint } from "../api/planning";
import { useTheme } from "../context/ThemeContext";

type ReportingSection = "reports" | "planning";

type ReportingCenterPageProps = {
  initialSection?: ReportingSection;
  allowPlanning: boolean;
};

const defaultFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const defaultTo = new Date().toISOString();

function SectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const { theme } = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
        borderRadius: theme.radius.md,
        background: active ? theme.colors.primary : theme.colors.surfaceAlt,
        color: active ? "#ffffff" : theme.colors.textPrimary,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

export default function ReportingCenterPage({
  initialSection = "reports",
  allowPlanning,
}: ReportingCenterPageProps) {
  const { theme } = useTheme();
  const [section, setSection] = useState<ReportingSection>(initialSection);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [stats, setStats] = useState<StatisticalReport | null>(null);
  const [eobEntries, setEobEntries] = useState<EOBEntry[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingEob, setLoadingEob] = useState(false);
  const [reportingError, setReportingError] = useState<string | null>(null);

  const [scenarioName, setScenarioName] = useState("Baseline Coverage");
  const [frequency, setFrequency] = useState(2400);
  const [radiusKm, setRadiusKm] = useState(10);
  const [txPower, setTxPower] = useState(30);
  const [points, setPoints] = useState<CoveragePoint[]>([]);
  const [runningPlanning, setRunningPlanning] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);

  const availableSections = useMemo<ReportingSection[]>(
    () => (allowPlanning ? ["reports", "planning"] : ["reports"]),
    [allowPlanning]
  );

  const generateStats = async () => {
    try {
      setLoadingStats(true);
      setReportingError(null);
      const response = await getStatisticalReport(from, to);
      setStats(response.data);
    } catch {
      setReportingError("Failed to generate statistical report.");
    } finally {
      setLoadingStats(false);
    }
  };

  const generateEOB = async () => {
    try {
      setLoadingEob(true);
      setReportingError(null);
      const response = await getEOBReport(from, to, "LEOB");
      setEobEntries(response.data);
    } catch {
      setReportingError("Failed to generate EOB/LEOB report.");
    } finally {
      setLoadingEob(false);
    }
  };

  const runSimulation = async () => {
    try {
      setRunningPlanning(true);
      setPlanningError(null);
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
      setPlanningError("Coverage simulation failed.");
    } finally {
      setRunningPlanning(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer title="Reporting Center">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.md,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Reporting Center</h2>
              <div style={{ color: theme.colors.textSecondary }}>
                Consolidated mission reporting and planning workflow for command assessment and coverage forecasting.
              </div>
            </div>

            <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              <SectionButton
                active={section === "reports"}
                label="Statistical and EOB"
                onClick={() => setSection("reports")}
              />
              {availableSections.includes("planning") && (
                <SectionButton
                  active={section === "planning"}
                  label="Coverage Planning"
                  onClick={() => setSection("planning")}
                />
              )}
            </div>
          </div>

          {section === "reports" && (
            <>
              <Card>
                <div style={{ display: "grid", gap: 12 }}>
                  <label>
                    From
                    <input
                      style={{
                        width: "100%",
                        padding: theme.spacing.sm,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.sm,
                        background: theme.colors.surfaceAlt,
                        color: theme.colors.textPrimary,
                      }}
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </label>
                  <label>
                    To
                    <input
                      style={{
                        width: "100%",
                        padding: theme.spacing.sm,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.sm,
                        background: theme.colors.surfaceAlt,
                        color: theme.colors.textPrimary,
                      }}
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{
                        border: "none",
                        borderRadius: theme.radius.md,
                        background: theme.colors.primary,
                        color: "#fff",
                        cursor: "pointer",
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      }}
                      onClick={generateStats}
                      disabled={loadingStats}
                    >
                      {loadingStats ? "Generating..." : "Generate Statistical Report"}
                    </button>
                    <button
                      style={{
                        border: "none",
                        borderRadius: theme.radius.md,
                        background: theme.colors.primary,
                        color: "#fff",
                        cursor: "pointer",
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      }}
                      onClick={generateEOB}
                      disabled={loadingEob}
                    >
                      {loadingEob ? "Generating..." : "Generate EOB/LEOB"}
                    </button>
                  </div>
                  {reportingError && <div style={{ color: theme.colors.danger }}>{reportingError}</div>}
                </div>
              </Card>

              {stats && (
                <Card>
                  <h3>Statistical Report</h3>
                  <div>Total Signals: {stats.total_signals}</div>
                  <div>Unique Modulations: {stats.unique_modulations}</div>
                  <div>Average Power: {stats.avg_power ?? "-"}</div>
                  <div>Max Frequency: {stats.max_frequency ?? "-"}</div>
                </Card>
              )}

              <Card>
                <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>EOB / LEOB</h3>
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
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Emitter</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Capability</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Threat</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eobEntries.map((entry) => (
                      <tr key={entry.emitter_designation}>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{entry.emitter_designation}</td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{entry.assessed_capability}</td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{entry.threat_level}</td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{entry.confidence}</td>
                      </tr>
                    ))}
                    {eobEntries.length === 0 && (
                      <tr>
                        <td style={{ padding: theme.spacing.sm }} colSpan={4}>
                          No EOB entries generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {section === "planning" && allowPlanning && (
            <>
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
                      onChange={(event) => setScenarioName(event.target.value)}
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
                      onChange={(event) => setFrequency(Number(event.target.value))}
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
                      onChange={(event) => setRadiusKm(Number(event.target.value))}
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
                      onChange={(event) => setTxPower(Number(event.target.value))}
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
                    disabled={runningPlanning}
                  >
                    {runningPlanning ? "Running Simulation..." : "Run Coverage Simulation"}
                  </button>
                  {planningError && <div style={{ color: theme.colors.danger }}>{planningError}</div>}
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
                    {points.map((point, index) => (
                      <tr key={`${point.latitude}-${point.longitude}-${index}`}>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{point.latitude}</td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{point.longitude}</td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{point.coverage_db}</td>
                      </tr>
                    ))}
                    {points.length === 0 && (
                      <tr>
                        <td style={{ padding: theme.spacing.sm }} colSpan={3}>
                          No simulation points yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>

              <MapView coveragePoints={points} />
            </>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}