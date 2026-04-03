/**
 * NodeDetails — sidebar panel showing full metadata for a selected graph node.
 */
import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import type { GraphNode } from "../../state/useGraphData";
import { X, Phone, Cpu, MapPin, Wifi, AlertTriangle, CheckCircle } from "lucide-react";

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function Row({ label, value, color }: { label: string; value: string | number | null | undefined; color?: string }) {
  const { theme } = useTheme();
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${theme.colors.border}` }}>
      <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color ?? theme.colors.textPrimary, textAlign: "right", maxWidth: "60%", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

type Props = {
  node: GraphNode | null;
  linkCount?: number;
  linkDuration?: number;
  onClose: () => void;
  onFocus?: (msisdn: string) => void;
};

export default function NodeDetails({ node, linkCount, linkDuration, onClose, onFocus }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  if (!node) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: theme.colors.textMuted, padding: 20 }}>
        <Phone size={28} color="rgba(17,193,202,0.3)" />
        <div style={{ fontSize: 12, textAlign: "center" }}>Click a node to view details</div>
      </div>
    );
  }

  const isMain = node.type === "main";
  const nodeColor = isMain ? "#3b82f6" : node.suspicious ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: `1px solid ${theme.colors.border}`, background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: nodeColor, boxShadow: `0 0 6px ${nodeColor}` }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: nodeColor }}>{isMain ? "Centre Node" : "Contact Node"}</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.colors.textMuted, padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Threat badge */}
        {node.suspicious && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 6, background: "#f59e0b18", border: "1px solid #f59e0b44" }}>
            <AlertTriangle size={13} color="#f59e0b" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>
              SUSPICIOUS — {node.fake_count > 0 ? `${node.fake_count} fake` : ""}{node.fake_count > 0 && node.silent_count > 0 ? " · " : ""}{node.silent_count > 0 ? `${node.silent_count} silent` : ""}
            </span>
          </div>
        )}
        {!node.suspicious && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: "#22c55e12", border: "1px solid #22c55e33" }}>
            <CheckCircle size={12} color="#22c55e" />
            <span style={{ fontSize: 11, color: "#22c55e" }}>No threats detected</span>
          </div>
        )}

        {/* Identity */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            <Phone size={10} style={{ marginRight: 4 }} />Identity
          </div>
          <Row label="MSISDN" value={node.label} color={nodeColor} />
          <Row label="IMSI" value={node.imsi} />
          <Row label="IMEI" value={node.imei} />
        </div>

        {/* Network */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            <Wifi size={10} style={{ marginRight: 4 }} />Network
          </div>
          <Row label="Operator" value={node.operator} />
          <Row label="Network" value={node.network} />
          <Row label="Device" value={node.device} />
        </div>

        {/* Location */}
        {node.location && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              <MapPin size={10} style={{ marginRight: 4 }} />Location
            </div>
            <Row label="Place" value={node.location} />
          </div>
        )}

        {/* Activity */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            <Cpu size={10} style={{ marginRight: 4 }} />Activity
          </div>
          <Row label="Total calls" value={node.total_calls} color="#11C1CA" />
          <Row label="Total duration" value={fmtDur(node.total_duration)} />
          {linkCount !== undefined && <Row label="Calls on this link" value={linkCount} />}
          {linkDuration !== undefined && <Row label="Link duration" value={fmtDur(linkDuration)} />}
          <Row label="Fake signals" value={node.fake_count > 0 ? node.fake_count : undefined} color="#ef4444" />
          <Row label="Silent calls" value={node.silent_count > 0 ? node.silent_count : undefined} color="#f59e0b" />
        </div>

        {/* Focus button for contact nodes */}
        {!isMain && onFocus && (
          <button
            onClick={() => onFocus(node.label)}
            style={{ marginTop: 4, padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", background: "rgba(17,193,202,0.15)", color: "#11C1CA", width: "100%" }}>
            🔍 Expand this node
          </button>
        )}
      </div>
    </div>
  );
}
