import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";

export type DashboardStatus = {
  mode: "idle" | "file" | "stream";
  sourceNode: string;
  accepted: number;
  rejected: number;
  errors: string[];
  fileName?: string | null;
  streamUrl?: string | null;
  streamActive: boolean;
  nodeOnline?: boolean;
  updatedAt?: string | null;
  message?: string | null;
};

type StatusPanelProps = {
  status: DashboardStatus;
};

export default function StatusPanel({ status }: StatusPanelProps) {
  const { theme } = useTheme();

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div>
          <h3 style={{ margin: 0 }}>Ingestion Status</h3>
          <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
            Current file and stream ingestion state.
          </div>
        </div>

        <div style={{ display: "grid", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <span
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textSecondary,
              }}
            >
              Mode: {status.mode.toUpperCase()}
            </span>
            <span
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.radius.md,
                border: `1px solid ${status.streamActive ? theme.colors.success : theme.colors.border}`,
                background: theme.colors.surfaceAlt,
                color: status.streamActive ? theme.colors.success : theme.colors.textSecondary,
              }}
            >
              Stream: {status.streamActive ? "Connected" : "Disconnected"}
            </span>
            <span
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.radius.md,
                border: `1px solid ${status.nodeOnline ? theme.colors.success : theme.colors.border}`,
                background: theme.colors.surfaceAlt,
                color: status.nodeOnline ? theme.colors.success : theme.colors.textSecondary,
              }}
            >
              Node: {status.nodeOnline ? "Online" : "Unknown"}
            </span>
          </div>

          <div style={{ color: theme.colors.textSecondary }}>Source Node: {status.sourceNode || "-"}</div>
          <div style={{ color: theme.colors.textSecondary }}>Last File: {status.fileName || "-"}</div>
          <div style={{ color: theme.colors.textSecondary }}>Stream URL: {status.streamUrl || "-"}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: theme.spacing.sm }}>
            <div
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                background: theme.colors.surfaceAlt,
                padding: theme.spacing.sm,
              }}
            >
              <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>Accepted</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: theme.colors.success }}>{status.accepted}</div>
            </div>
            <div
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                background: theme.colors.surfaceAlt,
                padding: theme.spacing.sm,
              }}
            >
              <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>Rejected</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: theme.colors.warning }}>{status.rejected}</div>
            </div>
          </div>

          {status.message && <div style={{ color: theme.colors.textPrimary }}>{status.message}</div>}

          {status.errors.length > 0 && (
            <div
              style={{
                border: `1px solid ${theme.colors.danger}`,
                borderRadius: theme.radius.md,
                background: theme.colors.surfaceAlt,
                color: theme.colors.danger,
                padding: theme.spacing.sm,
              }}
            >
              {status.errors.slice(0, 3).join(" | ")}
            </div>
          )}

          <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
            {status.updatedAt ? `Updated: ${new Date(status.updatedAt).toLocaleTimeString()}` : "No ingest events yet."}
          </div>
        </div>
      </div>
    </Card>
  );
}
