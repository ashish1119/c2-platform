/**
 * TelecomIntelligenceDashboard — Premium Intelligence UI
 * Enhanced tab names, bold styling, glow effects, glassmorphism
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { useTelecomIntelligence } from "../state/useTelecomIntelligence";
import { useTelecomAnalytics } from "../state/useTelecomAnalytics";
import { useGraphData } from "../state/useGraphData";
import TelecomFilterBar from "./TelecomFilterBar";
import TelecomKPICards from "./TelecomKPICards";
import TelecomCallerPanel from "./TelecomCallerPanel";
import TelecomMapPanel from "./TelecomMapPanel";
import TelecomInsightsPanel from "./TelecomInsightsPanel";
import TelecomTimeline from "./TelecomTimeline";
import TelecomTable from "./TelecomTable";
import TelecomChartsPanel from "./TelecomChartsPanel";
import TelecomAIInsights from "./TelecomAIInsights";
import SignalIntelligencePanel from "./SignalIntelligencePanel";
import CommandCenterPanel from "./CommandCenterPanel";
import CallerReceiverMap from "./CallerReceiverMap";
import LiveIngestPanel from "./LiveIngestPanel";
import CallGraph, { type CallGraphHandle } from "./analytics/CallGraph";
import GraphControls from "./analytics/GraphControls";
import NodeDetails from "./analytics/NodeDetails";
import { exportCSV, exportPDF } from "../utils/exportUtils";
import { getNetworkMap, getCallMap, type NetworkMapResponse, type CallMapResponse } from "../../../api/cdr";
import type { GraphNode } from "../state/useGraphData";
import {
  Activity, BarChart2, Clock, Download, FileText,
  Map, Table2, Wifi, WifiOff, Radio, Shield, Phone, Zap,
} from "lucide-react";

type ViewTab = "analytics" | "map" | "table" | "timeline" | "signal" | "command" | "live";

// ── Updated tab labels & icons ────────────────────────────────────────────
const TABS: { id: ViewTab; icon: ReactNode; label: string }[] = [
  { id: "analytics", icon: <BarChart2 size={14} />, label: "Analytics" },
  { id: "map",       icon: <Map size={14} />,       label: "Geo Intelligence" },
  { id: "table",     icon: <Table2 size={14} />,    label: "User Data" },
  { id: "timeline",  icon: <Clock size={14} />,     label: "Activity Timeline" },
  { id: "signal",    icon: <Radio size={14} />,     label: "Signal Analysis" },
  { id: "command",   icon: <Shield size={14} />,    label: "Operations Center" },
  { id: "live",      icon: <Zap size={14} />,       label: "Live Monitoring" },
];

export default function TelecomIntelligenceDashboard() {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const state = useTelecomIntelligence();
  const analytics = useTelecomAnalytics(state.records);

  const [activeTab, setActiveTab] = useState<ViewTab>("analytics");
  const [mapMode, setMapMode] = useState<"tower" | "callmap">("callmap");
  const [exporting, setExporting] = useState(false);

  // ── Graph state ───────────────────────────────────────────────────────────
  const { graphData, loading: graphLoading } = useGraphData(state.records, state.filters);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false);
  const graphRef = useRef<CallGraphHandle>(null);

  useEffect(() => { setSelectedNode(null); }, [state.filters.msisdn]);

  const selectedLink = useMemo(
    () => graphData?.links.find((l) => l.target === selectedNode?.id) ?? null,
    [graphData, selectedNode]
  );

  // ── Network-map data ──────────────────────────────────────────────────────
  const [networkMapData, setNetworkMapData] = useState<NetworkMapResponse | null>(null);
  const [nmLoading, setNmLoading] = useState(false);
  const nmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const msisdn = state.filters.msisdn.trim();
    if (!msisdn) { setNetworkMapData(null); return; }
    if (nmRef.current) clearTimeout(nmRef.current);
    nmRef.current = setTimeout(async () => {
      setNmLoading(true);
      try {
        const res = await getNetworkMap({ msisdn, start_date: state.filters.dateFrom || undefined, end_date: state.filters.dateTo || undefined });
        setNetworkMapData(res.data);
      } catch { setNetworkMapData(null); }
      finally { setNmLoading(false); }
    }, 600);
    return () => { if (nmRef.current) clearTimeout(nmRef.current); };
  }, [state.filters.msisdn, state.filters.dateFrom, state.filters.dateTo]);

  // ── Call-map data ─────────────────────────────────────────────────────────
  const [callMapData, setCallMapData] = useState<CallMapResponse | null>(null);
  const cmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const msisdn = state.filters.msisdn.trim();
    if (!msisdn) { setCallMapData(null); return; }
    if (cmRef.current) clearTimeout(cmRef.current);
    cmRef.current = setTimeout(async () => {
      try {
        const res = await getCallMap({ msisdn, start_date: state.filters.dateFrom || undefined, end_date: state.filters.dateTo || undefined });
        setCallMapData(res.data);
      } catch { setCallMapData(null); }
    }, 700);
    return () => { if (cmRef.current) clearTimeout(cmRef.current); };
  }, [state.filters.msisdn, state.filters.dateFrom, state.filters.dateTo]);

  // ── Shared styles ─────────────────────────────────────────────────────────
  const btnBase: CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 14px", borderRadius: theme.radius.md,
    fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${theme.colors.border}`,
    transition: "all 0.2s ease", background: "transparent",
  };

  const csvBannerIsSuccess = state.csvError?.startsWith("✓") || state.csvError?.startsWith("Loaded");

  // ── Active tab glow accent ────────────────────────────────────────────────
  const tabAccent = "#11C1CA";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
        padding: "14px 20px",
        background: isDark
          ? "linear-gradient(135deg, rgba(17,193,202,0.06) 0%, rgba(59,130,246,0.04) 100%)"
          : "linear-gradient(135deg, rgba(17,193,202,0.08) 0%, rgba(59,130,246,0.05) 100%)",
        border: `1px solid ${isDark ? "rgba(17,193,202,0.2)" : "rgba(17,193,202,0.25)"}`,
        borderRadius: 14,
        boxShadow: isDark ? "0 0 30px rgba(17,193,202,0.06)" : "0 2px 16px rgba(17,193,202,0.08)",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#11C1CA",
              boxShadow: "0 0 8px #11C1CA",
              animation: "pulse 2s infinite",
            }} />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px",
              background: "linear-gradient(90deg, #11C1CA, #3B82F6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Telecom Intelligence Platform
            </h2>
          </div>
          <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 3, letterSpacing: "0.5px" }}>
            MSISDN TRACKING · GEO INTELLIGENCE · REAL-TIME ANALYSIS · BEHAVIORAL PROFILING
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Data mode switcher */}
          <div style={{ display: "flex", background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.06)",
            border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
            {(["demo", "csv", "live"] as const).map((m) => (
              <button key={m} onClick={() => state.switchMode(m)}
                style={{ ...btnBase, border: "none", borderRadius: 0,
                  background: state.dataMode === m
                    ? "linear-gradient(135deg, rgba(17,193,202,0.25), rgba(59,130,246,0.2))"
                    : "transparent",
                  color: state.dataMode === m ? "#11C1CA" : theme.colors.textSecondary,
                  fontWeight: state.dataMode === m ? 700 : 500,
                  borderBottom: state.dataMode === m ? "2px solid #11C1CA" : "2px solid transparent",
                }}>
                {m === "live" ? <Wifi size={12} /> : <Activity size={12} />}
                {m === "demo" ? "Demo" : m === "csv" ? "CSV" : "Live"}
              </button>
            ))}
          </div>

          {/* WS status pill */}
          {state.dataMode === "live" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11,
              color: state.wsConnected ? theme.colors.success : theme.colors.danger,
              padding: "5px 11px",
              background: state.wsConnected ? `${theme.colors.success}15` : `${theme.colors.danger}15`,
              border: `1px solid ${state.wsConnected ? theme.colors.success : theme.colors.danger}50`,
              borderRadius: theme.radius.md,
              fontWeight: 600,
              boxShadow: state.wsConnected ? `0 0 8px ${theme.colors.success}30` : "none",
            }}>
              {state.wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {state.wsConnected ? "CONNECTED" : "RECONNECTING..."}
            </div>
          )}

          {/* Exports */}
          <button onClick={() => exportCSV(state.records)}
            style={{ ...btnBase, color: theme.colors.textSecondary,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
            <Download size={13} />CSV
          </button>
          <button
            onClick={async () => { setExporting(true); try { await exportPDF(state.records); } finally { setExporting(false); } }}
            disabled={exporting}
            style={{ ...btnBase,
              color: exporting ? theme.colors.textMuted : theme.colors.textSecondary,
              cursor: exporting ? "not-allowed" : "pointer",
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
            <FileText size={13} />{exporting ? "Exporting..." : "PDF"}
          </button>
        </div>
      </div>

      {/* ══ CSV BANNER ══════════════════════════════════════════════════════ */}
      {state.csvError && (
        <div style={{ padding: "8px 16px", borderRadius: theme.radius.md, fontSize: 12,
          background: csvBannerIsSuccess ? `${theme.colors.success}15` : `${theme.colors.danger}15`,
          border: `1px solid ${csvBannerIsSuccess ? theme.colors.success : theme.colors.danger}50`,
          color: csvBannerIsSuccess ? theme.colors.success : theme.colors.danger,
          fontWeight: 600 }}>
          {state.csvError}
        </div>
      )}

      {/* ══ FILTER BAR ══════════════════════════════════════════════════════ */}
      <TelecomFilterBar
        filters={state.filters}
        onUpdate={state.updateFilter}
        onReset={state.resetFilters}
        onUploadCSV={state.uploadCSV}
        onResetData={state.resetData}
        csvLoading={state.csvLoading}
        hasUploadedData={state.dataMode === "csv" && state.rawData.length > 0}
        uniqueValues={state.uniqueValues}
      />

      {/* ══ TAB BAR — Bold, modern, glow on active ══════════════════════════ */}
      <div style={{
        display: "flex",
        background: isDark ? "rgba(15,23,42,0.8)" : "rgba(248,250,252,0.9)",
        border: `1.5px solid ${isDark ? "rgba(17,193,202,0.15)" : "rgba(17,193,202,0.2)"}`,
        borderRadius: 12,
        overflow: "hidden",
        backdropFilter: "blur(12px)",
        boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)",
      }}>
        {TABS.map(({ id, icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{
                ...btnBase,
                border: "none",
                borderRadius: 0,
                flex: 1,
                justifyContent: "center",
                gap: 6,
                padding: "10px 6px",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: isActive ? "0.3px" : "0",
                color: isActive ? tabAccent : theme.colors.textSecondary,
                borderBottom: isActive ? `2.5px solid ${tabAccent}` : "2.5px solid transparent",
                background: isActive
                  ? isDark
                    ? "linear-gradient(180deg, rgba(17,193,202,0.12) 0%, rgba(17,193,202,0.04) 100%)"
                    : "linear-gradient(180deg, rgba(17,193,202,0.1) 0%, rgba(17,193,202,0.03) 100%)"
                  : "transparent",
                boxShadow: isActive ? `inset 0 -2px 8px rgba(17,193,202,0.15)` : "none",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}>
              <span style={{ opacity: isActive ? 1 : 0.6 }}>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* ══ TAB CONTENT ═════════════════════════════════════════════════════ */}

      {/* ── 1. ANALYTICS TAB ─────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* KPI cards */}
          <TelecomKPICards kpis={state.kpis} />

          {/* AI Insights + extended KPIs */}
          <TelecomAIInsights
            insights={analytics.insights}
            extKPIs={analytics.extKPIs}
            totalRecords={state.records.length}
          />

          {/* Charts */}
          <TelecomChartsPanel
            dailyVolume={analytics.dailyVolume}
            callTypeDist={analytics.callTypeDist}
            operatorDist={analytics.operatorDist}
            topContacts={analytics.topContacts}
            durationTrend={analytics.durationTrend}
          />

          {/* ── Call Relationship Graph ── */}
          <div style={{
            border: `1.5px solid ${isDark ? "rgba(17,193,202,0.2)" : "rgba(17,193,202,0.25)"}`,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(17,193,202,0.08)" : "0 4px 16px rgba(0,0,0,0.06)",
          }}>
            {/* Graph header */}
            <div style={{
              padding: "12px 18px",
              borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
              background: isDark
                ? "linear-gradient(135deg, rgba(17,193,202,0.08), rgba(59,130,246,0.05))"
                : "linear-gradient(135deg, rgba(17,193,202,0.06), rgba(59,130,246,0.03))",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 4, height: 18, background: "linear-gradient(to bottom, #11C1CA, #3B82F6)", borderRadius: 2 }} />
                  <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.3px" }}>CALL RELATIONSHIP GRAPH</span>
                  <span style={{ fontSize: 10, color: isDark ? "#94a3b8" : "#64748b",
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                    padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                    {state.filters.msisdn
                      ? `${graphData?.nodes.length ?? 0} nodes · ${graphData?.links.length ?? 0} links`
                      : "Enter MSISDN to build graph"}
                  </span>
                </div>
              </div>
              {graphData && (
                <div style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b" }}>
                  {graphData.total_records} records · centre: <strong style={{ color: "#11C1CA" }}>{graphData.center_msisdn}</strong>
                </div>
              )}
            </div>

            {/* Graph controls */}
            {graphData && (
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
                <GraphControls
                  onZoomIn={() => graphRef.current?.zoomIn()}
                  onZoomOut={() => graphRef.current?.zoomOut()}
                  onFit={() => graphRef.current?.fit()}
                  onReset={() => graphRef.current?.resetLayout()}
                  showLabels={showLabels}
                  onToggleLabels={() => setShowLabels((v) => !v)}
                  showSuspiciousOnly={showSuspiciousOnly}
                  onToggleSuspicious={() => setShowSuspiciousOnly((v) => !v)}
                  nodeCount={graphData.nodes.length}
                  linkCount={graphData.links.length}
                  loading={graphLoading}
                />
              </div>
            )}

            {/* Graph body */}
            <div style={{ display: "flex", minHeight: 540 }}>
              <div style={{ flex: "0 0 70%", position: "relative", background: isDark ? "#0a1628" : "#f8fafc" }}>
                {!state.filters.msisdn && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, pointerEvents: "none" }}>
                    <div style={{ fontSize: 40 }}>📡</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#11C1CA", letterSpacing: "0.5px" }}>ENTER MSISDN TO BUILD GRAPH</div>
                    <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", textAlign: "center", maxWidth: 280 }}>
                      Type a caller number in the filter bar above. Works with demo, CSV, and live data.
                    </div>
                  </div>
                )}
                {state.filters.msisdn && graphLoading && !graphData && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#11C1CA", fontSize: 13, fontWeight: 600 }}>
                    ⟳ Building graph…
                  </div>
                )}
                {graphData && graphData.nodes.length > 0 && (
                  <CallGraph
                    ref={graphRef}
                    nodes={graphData.nodes}
                    links={graphData.links}
                    selectedNodeId={selectedNode?.id ?? null}
                    onNodeSelect={setSelectedNode}
                    showLabels={showLabels}
                    showSuspiciousOnly={showSuspiciousOnly}
                    isDark={isDark}
                    width={Math.round(window.innerWidth * 0.7 * 0.68)}
                    height={520}
                    centralNodeId={graphData.central_node_id ?? null}
                  />
                )}
                {graphData && graphData.nodes.length === 0 && state.filters.msisdn && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: isDark ? "#94a3b8" : "#64748b" }}>
                    <div style={{ fontSize: 28 }}>🔍</div>
                    <div style={{ fontSize: 13 }}>No records found for <strong>{state.filters.msisdn}</strong></div>
                  </div>
                )}
              </div>
              <div style={{ flex: "0 0 30%", borderLeft: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`, background: isDark ? "rgba(10,22,40,0.7)" : "rgba(248,250,252,0.9)" }}>
                <NodeDetails
                  node={selectedNode}
                  linkCount={selectedLink?.count}
                  linkDuration={selectedLink?.duration}
                  onClose={() => setSelectedNode(null)}
                  onFocus={(msisdn) => state.updateFilter("msisdn", msisdn)}
                />
              </div>
            </div>

            {/* Legend */}
            <div style={{ padding: "10px 18px", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: isDark ? "#94a3b8" : "#64748b" }}>
              {[
                { color: "#3b82f6", label: "Centre node (caller)" },
                { color: "#ef4444", label: "Contact node" },
                { color: "#f59e0b", label: "Suspicious node" },
                { color: "#facc15", label: "Most connected (centrality)" },
                { color: "#11C1CA", label: "Selected" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                  {label}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 18, height: 2, background: "#1d4ed8" }} />high-freq link
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 18, height: 2, background: "#ef4444" }} />suspicious link
              </div>
              <div style={{ marginLeft: "auto", color: isDark ? "#64748b" : "#94a3b8" }}>
                Scroll to zoom · Drag to pan · Click node for details
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. GEO INTELLIGENCE TAB ──────────────────────────────────────── */}
      {activeTab === "map" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            display: "flex", gap: 6, alignItems: "center",
            padding: "8px 14px", borderRadius: 10,
            background: isDark ? "rgba(17,193,202,0.05)" : "rgba(17,193,202,0.04)",
            border: `1px solid ${isDark ? "rgba(17,193,202,0.15)" : "rgba(17,193,202,0.2)"}`,
          }}>
            <span style={{ fontSize: 11, color: "#11C1CA", fontWeight: 700, marginRight: 4, letterSpacing: "0.5px" }}>
              VIEW MODE:
            </span>
            {([
              { id: "callmap", icon: <Phone size={11} />, label: "Caller ↔ Receiver" },
              { id: "tower",   icon: <Map size={11} />,   label: "Tower View" },
            ] as const).map(({ id, icon, label }) => (
              <button key={id} onClick={() => setMapMode(id)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 14px",
                  fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer",
                  background: mapMode === id ? "rgba(17,193,202,0.18)" : "transparent",
                  border: `1px solid ${mapMode === id ? "rgba(17,193,202,0.6)" : theme.colors.border}`,
                  color: mapMode === id ? "#11C1CA" : theme.colors.textSecondary,
                  boxShadow: mapMode === id ? "0 0 8px rgba(17,193,202,0.2)" : "none",
                  transition: "all 0.2s ease" }}>
                {icon}{label}
              </button>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 11, color: theme.colors.textMuted,
              padding: "3px 12px", borderRadius: 10,
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              fontWeight: 600 }}>
              {state.records.length} records in scope
            </div>
          </div>

          {mapMode === "callmap" && (
            <CallerReceiverMap
              records={state.records}
              msisdnFilter={state.filters.msisdn}
              callMapData={callMapData}
              dateFrom={state.filters.dateFrom}
              dateTo={state.filters.dateTo}
              onFocusTarget={state.focusTarget}
            />
          )}

          {mapMode === "tower" && (
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 240px", gap: 10 }}>
              <div style={{ overflowY: "auto", maxHeight: 560 }}>
                <TelecomCallerPanel
                  records={state.records}
                  selectedRecord={state.selectedRecord}
                  onSelect={state.setSelectedId}
                  onFocusTarget={state.focusTarget}
                />
              </div>
              <div>
                {nmLoading && (
                  <div style={{ fontSize: 11, color: "#11C1CA", padding: "5px 10px", marginBottom: 6,
                    background: "rgba(17,193,202,0.08)", borderRadius: 6, border: "1px solid rgba(17,193,202,0.3)", fontWeight: 600 }}>
                    ⟳ Loading network map…
                  </div>
                )}
                <TelecomMapPanel
                  records={state.records}
                  selectedRecord={state.selectedRecord}
                  msisdnFilter={state.filters.msisdn}
                  onSelect={state.setSelectedId}
                  onFocusTarget={state.focusTarget}
                  networkMapData={networkMapData}
                />
              </div>
              <div style={{ overflowY: "auto", maxHeight: 560 }}>
                <TelecomInsightsPanel record={state.selectedRecord} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. USER DATA TAB ─────────────────────────────────────────────── */}
      {activeTab === "table" && (
        <TelecomTable
          rows={state.tablePage}
          total={state.tableTotal}
          page={state.page}
          totalPages={state.totalPages}
          pageSize={state.PAGE_SIZE}
          sortKey={state.sortKey}
          sortDir={state.sortDir}
          onSort={state.toggleSort}
          onPageChange={state.setPage}
          tableSearch={state.filters.tableSearch}
          onTableSearch={(v) => state.updateFilter("tableSearch", v)}
          onSelect={state.setSelectedId}
          selectedId={state.selectedId}
          onFocusTarget={state.focusTarget}
        />
      )}

      {/* ── 4. ACTIVITY TIMELINE TAB ─────────────────────────────────────── */}
      {activeTab === "timeline" && (
        <TelecomTimeline dayGroups={state.dayGroups} />
      )}

      {/* ── 5. SIGNAL ANALYSIS TAB ───────────────────────────────────────── */}
      {activeTab === "signal" && (
        <SignalIntelligencePanel records={state.records} msisdn={state.filters.msisdn} dateFrom={state.filters.dateFrom} dateTo={state.filters.dateTo} />
      )}

      {/* ── 6. OPERATIONS CENTER TAB ─────────────────────────────────────── */}
      {activeTab === "command" && (
        <CommandCenterPanel records={state.records} />
      )}

      {/* ── 7. LIVE MONITORING TAB ───────────────────────────────────────── */}
      {activeTab === "live" && (
        <LiveIngestPanel records={state.records} />
      )}

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <div style={{
        fontSize: 11, color: theme.colors.textMuted, textAlign: "right",
        paddingTop: 4, letterSpacing: "0.3px", fontWeight: 500,
      }}>
        {state.records.length} of {state.rawData.length} records
        {state.dataMode === "demo" && " · DEMO MODE"}
        {state.dataMode === "csv" && " · CSV IMPORT"}
        {state.dataMode === "live" && " · LIVE FEED"}
        {state.filters.msisdn && ` · TARGET: ${state.filters.msisdn}`}
      </div>
    </div>
  );
}
