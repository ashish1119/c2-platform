import { Suspense, lazy, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { useTelecomIntelligence } from "../state/useTelecomIntelligence";
import { useTelecomAnalytics } from "../state/useTelecomAnalytics";
import TelecomFilterBar from "./TelecomFilterBar";
import TelecomKPICards from "./TelecomKPICards";
import TelecomInsightsPanel from "./TelecomInsightsPanel";
import { exportCSV, exportPDF } from "../utils/exportUtils";
import {
  Activity, BarChart2, Clock, Download, FileText,
  Map, Table2, Wifi, WifiOff,
} from "lucide-react";

type ViewTab = "map" | "table" | "timeline";

const TelecomCallerPanel = lazy(() => import("./TelecomCallerPanel"));
const TelecomMapPanel = lazy(() => import("./TelecomMapPanel"));
const TelecomTimeline = lazy(() => import("./TelecomTimeline"));
const TelecomTable = lazy(() => import("./TelecomTable"));
const TelecomChartsPanel = lazy(() => import("./TelecomChartsPanel"));
const TelecomAIInsights = lazy(() => import("./TelecomAIInsights"));

export default function TelecomIntelligenceDashboard() {
  const { theme } = useTheme();
  const state = useTelecomIntelligence();

  // Analytics — all derived from state.records (= filteredData)
  const analytics = useTelecomAnalytics(state.records);

  const [activeTab, setActiveTab] = useState<ViewTab>("map");
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [exporting, setExporting] = useState(false);

  const btnBase: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: theme.radius.md,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${theme.colors.border}`,
    transition: "all 0.15s",
    background: "transparent",
  };

  const TABS: { id: ViewTab; icon: ReactNode; label: string }[] = [
    { id: "map",      icon: <Map size={13} />,    label: "Map" },
    { id: "table",    icon: <Table2 size={13} />, label: "Table" },
    { id: "timeline", icon: <Clock size={13} />,  label: "Timeline" },
  ];

  const csvBannerIsSuccess =
    state.csvError?.startsWith("✓") || state.csvError?.startsWith("Loaded");
  const panelFallback = <div style={{ minHeight: 120 }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Telecom Intelligence</h2>
          <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
            MSISDN-based communication tracking · geolocation · pattern analysis
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Data mode */}
          <div style={{ display: "flex", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
            {(["demo", "csv", "live"] as const).map((m) => (
              <button
                key={m}
                onClick={() => state.switchMode(m)}
                style={{
                  ...btnBase,
                  border: "none",
                  borderRadius: 0,
                  background: state.dataMode === m ? theme.colors.primary : "transparent",
                  color: state.dataMode === m ? "#fff" : theme.colors.textSecondary,
                }}
              >
                {m === "live" ? <Wifi size={12} /> : <Activity size={12} />}
                {m === "demo" ? "Demo" : m === "csv" ? "CSV" : "Live"}
              </button>
            ))}
          </div>

          {/* WS status */}
          {state.dataMode === "live" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 11,
              color: state.wsConnected ? theme.colors.success : theme.colors.danger,
              padding: "4px 10px",
              background: state.wsConnected ? `${theme.colors.success}15` : `${theme.colors.danger}15`,
              border: `1px solid ${state.wsConnected ? theme.colors.success : theme.colors.danger}40`,
              borderRadius: theme.radius.md,
            }}>
              {state.wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {state.wsConnected ? "Connected" : "Reconnecting..."}
            </div>
          )}

          {/* View tabs */}
          <div style={{ display: "flex", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
            {TABS.map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  ...btnBase,
                  border: "none",
                  borderRadius: 0,
                  color: activeTab === id ? theme.colors.primary : theme.colors.textSecondary,
                  borderBottom: activeTab === id ? `2px solid ${theme.colors.primary}` : "2px solid transparent",
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Analytics toggle */}
          <button
            onClick={() => setShowAnalytics((v) => !v)}
            style={{
              ...btnBase,
              background: showAnalytics ? "rgba(17,193,202,0.12)" : "transparent",
              color: showAnalytics ? "#11C1CA" : theme.colors.textSecondary,
              border: `1px solid ${showAnalytics ? "rgba(17,193,202,0.4)" : theme.colors.border}`,
            }}
          >
            <BarChart2 size={13} />
            Analytics
          </button>

          {/* Export */}
          <button onClick={() => exportCSV(state.records)} style={{ ...btnBase, color: theme.colors.textSecondary }}>
            <Download size={13} />CSV
          </button>
          <button
            onClick={async () => {
              setExporting(true);
              try { await exportPDF(state.records); } finally { setExporting(false); }
            }}
            disabled={exporting}
            style={{ ...btnBase, color: exporting ? theme.colors.textMuted : theme.colors.textSecondary, cursor: exporting ? "not-allowed" : "pointer" }}
          >
            <FileText size={13} />{exporting ? "Exporting..." : "PDF"}
          </button>
        </div>
      </div>

      {/* ── CSV banner ──────────────────────────────────────────────────────── */}
      {state.csvError && (
        <div style={{
          padding: "8px 14px",
          borderRadius: theme.radius.md,
          fontSize: 12,
          background: csvBannerIsSuccess ? `${theme.colors.success}15` : `${theme.colors.danger}15`,
          border: `1px solid ${csvBannerIsSuccess ? theme.colors.success : theme.colors.danger}50`,
          color: csvBannerIsSuccess ? theme.colors.success : theme.colors.danger,
        }}>
          {state.csvError}
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
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

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <TelecomKPICards kpis={state.kpis} />

      {/* ── Analytics Section (NEW — below KPIs, collapsible) ──────────────── */}
      {showAnalytics && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* AI Insights + Extended KPIs */}
          <Suspense fallback={panelFallback}>
            <TelecomAIInsights
              insights={analytics.insights}
              extKPIs={analytics.extKPIs}
              totalRecords={state.records.length}
            />
          </Suspense>

          {/* Charts */}
          <Suspense fallback={panelFallback}>
            <TelecomChartsPanel
              dailyVolume={analytics.dailyVolume}
              callTypeDist={analytics.callTypeDist}
              operatorDist={analytics.operatorDist}
              topContacts={analytics.topContacts}
              durationTrend={analytics.durationTrend}
            />
          </Suspense>
        </div>
      )}

      {/* ── Main Content (unchanged) ────────────────────────────────────────── */}
      {activeTab === "map" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr 260px",
            gap: 10,
          }}
        >
          <div style={{ minHeight: 0, overflowY: "auto" }}>
            <Suspense fallback={panelFallback}>
              <TelecomCallerPanel
                records={state.records}
                selectedRecord={state.selectedRecord}
                onSelect={state.setSelectedId}
                onFocusTarget={state.focusTarget}
              />
            </Suspense>
          </div>
          <div style={{ minHeight: 480 }}>
            <Suspense fallback={panelFallback}>
              <TelecomMapPanel
                records={state.records}
                selectedRecord={state.selectedRecord}
                msisdnFilter={state.filters.msisdn}
                onSelect={state.setSelectedId}
                onFocusTarget={state.focusTarget}
              />
            </Suspense>
          </div>
          <div style={{ minHeight: 0, overflowY: "auto" }}>
            <TelecomInsightsPanel record={state.selectedRecord} />
          </div>
        </div>
      )}

      {activeTab === "table" && (
        <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Suspense fallback={panelFallback}>
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
          </Suspense>
        </div>
      )}

      {activeTab === "timeline" && (
        <div style={{ overflowY: "auto" }}>
          <Suspense fallback={panelFallback}>
            <TelecomTimeline dayGroups={state.dayGroups} />
          </Suspense>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div style={{ fontSize: 11, color: theme.colors.textMuted, textAlign: "right" }}>
        Showing {state.records.length} of {state.rawData.length} records
        {state.dataMode === "demo" && " · Demo Data"}
        {state.dataMode === "csv" && " · CSV Upload"}
        {state.filters.msisdn && ` · MSISDN: ${state.filters.msisdn}`}
      </div>
    </div>
  );
}
