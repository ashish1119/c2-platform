import { useCallback, useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import Card from "../components/ui/Card";
import MetricCard from "../components/ui/MetricCard";
import {
  getCrfsHealth,
  getCrfsOperatorDashboard,
  type CrfsIngestHealth,
  type CrfsOperatorDashboard,
} from "../api/crfs";
import { useTheme } from "../context/ThemeContext";

const REFRESH_MS = 5000;

export default function CrfsLivePage() {
  const { theme } = useTheme();
  const [health, setHealth] = useState<CrfsIngestHealth | null>(null);
  const [dashboard, setDashboard] = useState<CrfsOperatorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [healthRes, dashboardRes] = await Promise.all([
        getCrfsHealth(),
        getCrfsOperatorDashboard(),
      ]);

      setHealth(healthRes.data);
      setDashboard(dashboardRes.data);
    } catch {
      setError("Failed to load CRFS live data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      load(true);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const streams = dashboard?.streams ?? [];
  const signals = dashboard?.signals ?? [];
  const locations = dashboard?.locations ?? [];
  const events = dashboard?.events ?? [];
  const alerts = dashboard?.alerts ?? [];

  return (
    <AppLayout>
      <PageContainer title="CRFS Live">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ margin: 0 }}>CRFS Live</h2>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              style={{
                border: "none",
                borderRadius: theme.radius.md,
                background: theme.colors.primary,
                color: theme.colors.surface,
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.75 : 1,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              }}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(140px, 1fr))",
              gap: theme.spacing.md,
            }}
          >
            <MetricCard label="Ingest" value={health?.running ? "Running" : "Stopped"} />
            <MetricCard label="Streams" value={loading ? "..." : streams.length} />
            <MetricCard label="Signals" value={loading ? "..." : signals.length} />
            <MetricCard label="Locations" value={loading ? "..." : locations.length} />
            <MetricCard label="Events" value={loading ? "..." : events.length} />
            <MetricCard label="Alerts" value={loading ? "..." : alerts.length} />
          </div>

          {error && <div style={{ color: theme.colors.danger }}>{error}</div>}

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Ingest Health</h3>
            <div style={{ display: "grid", gap: theme.spacing.xs }}>
              <div>Host: {health?.host ?? "-"}</div>
              <div>Port: {health?.port ?? "-"}</div>
              <div>Endian: {health?.length_endian ?? "-"}</div>
              <div>Frames Received: {health?.frames_received ?? "-"}</div>
              <div>Frames Processed: {health?.frames_processed ?? "-"}</div>
              <div>Frames Failed: {health?.frames_failed ?? "-"}</div>
              <div>Last Message: {health?.last_message_at ?? "-"}</div>
              <div>Last Error: {health?.last_error ?? "-"}</div>
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Recent Signals</h3>
            <SimpleTable
              headers={["Time", "Freq (Hz)", "Power", "SNR", "Origin", "Stream"]}
              rows={signals.slice(0, 15).map((signal) => [
                signal.timestamp,
                signal.center_frequency ?? "-",
                signal.power ?? "-",
                signal.snr ?? "-",
                signal.origin_guid,
                signal.stream_guid,
              ])}
            />
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Recent Locations</h3>
            <SimpleTable
              headers={["Time", "Latitude", "Longitude", "Altitude", "Origin", "Stream"]}
              rows={locations.slice(0, 15).map((location) => [
                location.timestamp,
                location.latitude,
                location.longitude,
                location.altitude ?? "-",
                location.origin_guid,
                location.stream_guid,
              ])}
            />
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Recent Events</h3>
            <SimpleTable
              headers={["Time", "Type", "Center", "Span", "Power", "Origin"]}
              rows={events.slice(0, 15).map((event) => [
                event.timestamp,
                event.event_type,
                event.frequency_center ?? "-",
                event.frequency_span ?? "-",
                event.power ?? "-",
                event.origin_guid,
              ])}
            />
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Recent Alerts</h3>
            <SimpleTable
              headers={["Time", "Name", "Type", "Severity", "Status"]}
              rows={alerts.slice(0, 15).map((alert) => [
                alert.created_at ?? "-",
                alert.alert_name ?? "-",
                alert.alert_type ?? "-",
                alert.severity,
                alert.status,
              ])}
            />
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  const { theme } = useTheme();

  return (
    <div style={{ overflowX: "auto" }}>
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
            {headers.map((header) => (
              <th
                key={header}
                style={{
                  textAlign: "left",
                  padding: theme.spacing.sm,
                  borderBottom: `1px solid ${theme.colors.border}`,
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`cell-${index}-${cellIndex}`}
                  style={{
                    padding: theme.spacing.sm,
                    borderBottom: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={{ padding: theme.spacing.sm }} colSpan={headers.length}>
                No data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
