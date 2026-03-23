import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";

type StreamInputProps = {
  streamUrl: string;
  sourceNode: string;
  active: boolean;
  busy: boolean;
  disabled?: boolean;
  onStreamUrlChange: (value: string) => void;
  onSourceNodeChange: (value: string) => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => void | Promise<void>;
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function StreamInput({
  streamUrl,
  sourceNode,
  active,
  busy,
  disabled = false,
  onStreamUrlChange,
  onSourceNodeChange,
  onConnect,
  onDisconnect,
}: StreamInputProps) {
  const { theme } = useTheme();
  const canConnect = streamUrl.trim().length > 0 && isHttpUrl(streamUrl.trim()) && !busy && !disabled;

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div>
          <h3 style={{ margin: 0 }}>Live Stream URL</h3>
          <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
            Connect an HTTP/HTTPS RF stream source and ingest on a polling cadence.
          </div>
        </div>

        <label style={{ display: "grid", gap: theme.spacing.xs }}>
          <span style={{ color: theme.colors.textSecondary }}>Stream URL</span>
          <input
            value={streamUrl}
            disabled={disabled || busy}
            onChange={(event) => onStreamUrlChange(event.target.value)}
            placeholder="https://rf-source.local/api/detections"
            style={{
              width: "100%",
              padding: theme.spacing.sm,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: theme.spacing.xs }}>
          <span style={{ color: theme.colors.textSecondary }}>Source Node Override</span>
          <input
            value={sourceNode}
            disabled={disabled || busy}
            onChange={(event) => onSourceNodeChange(event.target.value)}
            placeholder="stream_node_alpha"
            style={{
              width: "100%",
              padding: theme.spacing.sm,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
            }}
          />
        </label>

        <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
          <button
            type="button"
            disabled={!canConnect || active}
            onClick={() => {
              void onConnect();
            }}
            style={{
              border: "none",
              borderRadius: theme.radius.md,
              background: theme.colors.primary,
              color: "#ffffff",
              cursor: !canConnect || active ? "not-allowed" : "pointer",
              opacity: !canConnect || active ? 0.7 : 1,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            }}
          >
            {busy && active ? "Polling..." : "Connect Stream"}
          </button>

          <button
            type="button"
            disabled={!active || busy}
            onClick={() => {
              void onDisconnect();
            }}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
              cursor: !active || busy ? "not-allowed" : "pointer",
              opacity: !active || busy ? 0.7 : 1,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            }}
          >
            Disconnect
          </button>

          <span
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              borderRadius: theme.radius.md,
              border: `1px solid ${active ? theme.colors.success : theme.colors.border}`,
              color: active ? theme.colors.success : theme.colors.textSecondary,
              background: theme.colors.surfaceAlt,
              fontSize: theme.typography.body.fontSize,
            }}
          >
            {active ? "Active" : "Idle"}
          </span>
        </div>
      </div>
    </Card>
  );
}
