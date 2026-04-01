/**
 * GraphControls — toolbar for the call relationship graph.
 */
import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import { ZoomIn, ZoomOut, Maximize2, RefreshCw, Eye, EyeOff } from "lucide-react";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  showSuspiciousOnly: boolean;
  onToggleSuspicious: () => void;
  nodeCount: number;
  linkCount: number;
  loading: boolean;
};

export default function GraphControls({
  onZoomIn, onZoomOut, onFit, onReset,
  showLabels, onToggleLabels,
  showSuspiciousOnly, onToggleSuspicious,
  nodeCount, linkCount, loading,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const bg = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)";

  const btn = (onClick: () => void, icon: React.ReactNode, active = false, title = "") => (
    <button onClick={onClick} title={title}
      style={{ padding: "5px 8px", borderRadius: 5, cursor: "pointer", border: `1px solid ${active ? "rgba(17,193,202,0.5)" : border}`,
        background: active ? "rgba(17,193,202,0.15)" : "transparent",
        color: active ? "#11C1CA" : theme.colors.textSecondary, display: "flex", alignItems: "center" }}>
      {icon}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: bg, border: `1px solid ${border}`, flexWrap: "wrap" }}>
      {/* Zoom controls */}
      <div style={{ display: "flex", gap: 3 }}>
        {btn(onZoomIn,  <ZoomIn size={13} />,  false, "Zoom in")}
        {btn(onZoomOut, <ZoomOut size={13} />, false, "Zoom out")}
        {btn(onFit,     <Maximize2 size={13} />, false, "Fit to screen")}
        {btn(onReset,   <RefreshCw size={13} />, false, "Reset layout")}
      </div>

      <div style={{ width: 1, height: 20, background: border }} />

      {/* Toggles */}
      {btn(onToggleLabels,    showLabels ? <Eye size={13} /> : <EyeOff size={13} />, showLabels, "Toggle labels")}
      <button onClick={onToggleSuspicious}
        style={{ padding: "4px 9px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600,
          border: `1px solid ${showSuspiciousOnly ? "#f59e0b55" : border}`,
          background: showSuspiciousOnly ? "#f59e0b18" : "transparent",
          color: showSuspiciousOnly ? "#f59e0b" : theme.colors.textSecondary }}>
        ⚠ Suspicious only
      </button>

      <div style={{ marginLeft: "auto", display: "flex", gap: 10, fontSize: 11, color: theme.colors.textMuted }}>
        {loading && <span style={{ color: "#11C1CA" }}>⟳ Loading…</span>}
        <span>{nodeCount} nodes</span>
        <span>{linkCount} links</span>
      </div>
    </div>
  );
}
