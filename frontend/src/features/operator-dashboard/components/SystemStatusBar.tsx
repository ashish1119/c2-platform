import type { WsChannelStatus, WsHealth } from "../hooks/useWsHealth";
import { useTheme } from "../../../context/ThemeContext";

const CHANNEL_LABELS: Record<keyof WsHealth, string> = {
  smsLive: "SMS",
  rfLive: "RF",
  alertsLive: "Alerts",
};

function dotColor(status: WsChannelStatus, theme: ReturnType<typeof useTheme>["theme"]): string {
  if (status === "live") return theme.colors.success;
  if (status === "reconnecting") return theme.colors.warning;
  return theme.colors.danger;
}

function dotTitle(status: WsChannelStatus): string {
  if (status === "live") return "Live";
  if (status === "reconnecting") return "Reconnecting…";
  if (status === "connecting") return "Connecting…";
  return "Disconnected";
}

interface SystemStatusBarProps {
  wsHealth: WsHealth;
  lastUpdatedAt: string | null;
  simulationMode: boolean;
  onOpenIngestDrawer: () => void;
}

export default function SystemStatusBar({
  wsHealth,
  lastUpdatedAt,
  simulationMode,
  onOpenIngestDrawer,
}: SystemStatusBarProps) {
  const { theme } = useTheme();

  const lastUpdatedLabel =
    lastUpdatedAt != null
      ? (() => {
          const diffSeconds = Math.round((Date.now() - Date.parse(lastUpdatedAt)) / 1000);
          if (diffSeconds < 5) return "Just now";
          if (diffSeconds < 60) return `${diffSeconds}s ago`;
          return `${Math.round(diffSeconds / 60)}m ago`;
        })()
      : "No data yet";

  return (
    <div
      role="status"
      aria-label="System channel status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
        background: theme.colors.surface,
        borderBottom: `1px solid ${theme.colors.border}`,
        minHeight: "44px",
      }}
    >
      {/* Channel indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md }}>
        {(Object.keys(wsHealth) as (keyof WsHealth)[]).map((channel) => {
          const status = wsHealth[channel];
          const color = dotColor(status, theme);
          return (
            <span
              key={channel}
              title={dotTitle(status)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.xs,
                fontSize: "12px",
                color: theme.colors.textSecondary,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: color,
                  boxShadow: status === "live" ? `0 0 6px ${color}` : "none",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {CHANNEL_LABELS[channel]}
            </span>
          );
        })}

        <span
          style={{
            color: theme.colors.textMuted,
            fontSize: "12px",
            paddingLeft: theme.spacing.sm,
            borderLeft: `1px solid ${theme.colors.border}`,
          }}
        >
          Updated: {lastUpdatedLabel}
        </span>

        {simulationMode && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              background: theme.colors.warning + "25",
              border: `1px solid ${theme.colors.warning}`,
              color: theme.colors.warning,
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            SIM FEED ACTIVE
          </span>
        )}
      </div>

      {/* Ingest drawer trigger */}
      <button
        type="button"
        aria-label="Open ingest controls"
        onClick={onOpenIngestDrawer}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 12px",
          border: `1px solid ${theme.colors.border}`,
          borderRadius: "6px",
          background: "transparent",
          color: theme.colors.textSecondary,
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        {/* gear icon via SVG inline */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Ingest Controls
      </button>
    </div>
  );
}
