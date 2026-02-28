import { useEffect, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import {
  getSmsDetections,
  getSmsNodes,
  getSmsThreats,
  getSmsTracks,
  type SmsDetectionRecord,
  type SmsNodeHealthRecord,
  type SmsThreatRecord,
  type SmsTrackRecord,
} from "../../api/sms";
import { useTheme } from "../../context/ThemeContext";

export default function SmsManagementPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<SmsNodeHealthRecord[]>([]);
  const [detections, setDetections] = useState<SmsDetectionRecord[]>([]);
  const [tracks, setTracks] = useState<SmsTrackRecord[]>([]);
  const [threats, setThreats] = useState<SmsThreatRecord[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [nodesRes, detectionsRes, tracksRes, threatsRes] = await Promise.all([
        getSmsNodes(),
        getSmsDetections(10),
        getSmsTracks(false, 10),
        getSmsThreats(10),
      ]);
      setNodes(nodesRes.data);
      setDetections(detectionsRes.data);
      setTracks(tracksRes.data);
      setThreats(threatsRes.data);
    } catch {
      setError("Failed to load SMS data. Ensure backend is running and database is seeded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AppLayout>
      <PageContainer title="SMS Monitoring">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>SMS Monitoring</h3>
              <div style={{ color: theme.colors.textSecondary }}>Live view of SMS nodes, detections, tracks, and threats.</div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              style={{
                border: "none",
                borderRadius: theme.radius.md,
                background: theme.colors.primary,
                color: "#fff",
                cursor: "pointer",
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error && <div style={{ color: theme.colors.danger }}>{error}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: theme.spacing.md }}>
            <Card><div>Nodes</div><div style={{ fontSize: 24, fontWeight: 700 }}>{nodes.length}</div></Card>
            <Card><div>Detections</div><div style={{ fontSize: 24, fontWeight: 700 }}>{detections.length}</div></Card>
            <Card><div>Tracks</div><div style={{ fontSize: 24, fontWeight: 700 }}>{tracks.length}</div></Card>
            <Card><div>Threats</div><div style={{ fontSize: 24, fontWeight: 700 }}>{threats.length}</div></Card>
          </div>

          <Card>
            <div style={{ fontWeight: 600, marginBottom: theme.spacing.sm }}>Node Health</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Node</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Online</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: theme.spacing.sm }}>{row.source_node}</td>
                      <td style={{ padding: theme.spacing.sm }}>{row.online ? "YES" : "NO"}</td>
                      <td style={{ padding: theme.spacing.sm }}>{row.last_heartbeat}</td>
                    </tr>
                  ))}
                  {nodes.length === 0 && (
                    <tr><td style={{ padding: theme.spacing.sm }} colSpan={3}>No node records.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 600, marginBottom: theme.spacing.sm }}>Recent Detections</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Time</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Node</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Frequency (Hz)</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Power (dBm)</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>DOA</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: theme.spacing.sm }}>{row.timestamp_utc}</td>
                      <td style={{ padding: theme.spacing.sm }}>{row.source_node}</td>
                      <td style={{ padding: theme.spacing.sm }}>{row.frequency_hz}</td>
                      <td style={{ padding: theme.spacing.sm }}>{row.power_dbm ?? "-"}</td>
                      <td style={{ padding: theme.spacing.sm }}>{row.doa_azimuth_deg ?? "-"}</td>
                    </tr>
                  ))}
                  {detections.length === 0 && (
                    <tr><td style={{ padding: theme.spacing.sm }} colSpan={5}>No detections available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 600, marginBottom: theme.spacing.sm }}>Tracks & Threats</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: theme.spacing.md }}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: theme.spacing.xs }}>Tracks</div>
                {tracks.length === 0 && <div>No tracks available.</div>}
                {tracks.map((row) => (
                  <div key={row.id} style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, marginBottom: theme.spacing.xs }}>
                    <div><strong>{row.track_code}</strong></div>
                    <div>Threat Level: {row.threat_level}</div>
                    <div>Class: {row.classification ?? "-"}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 500, marginBottom: theme.spacing.xs }}>Threats</div>
                {threats.length === 0 && <div>No threats available.</div>}
                {threats.map((row) => (
                  <div key={row.id} style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, marginBottom: theme.spacing.xs }}>
                    <div><strong>{row.threat_type}</strong></div>
                    <div>Priority: {row.priority}</div>
                    <div>Status: {row.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
