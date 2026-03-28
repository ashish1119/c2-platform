import { useRef } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { TelecomFilters } from "../model";
import { Search, X, Upload, Calendar } from "lucide-react";

type Props = {
  filters: TelecomFilters;
  onUpdate: <K extends keyof TelecomFilters>(key: K, value: TelecomFilters[K]) => void;
  onReset: () => void;
  onUploadCSV: (file: File) => void;
  onResetData?: () => void;       // ← NEW: clears uploaded CSV data
  csvLoading: boolean;
  hasUploadedData?: boolean;      // ← NEW: show Reset Data only when CSV is loaded
  uniqueValues: {
    operators: string[];
    networks: string[];
    bands: string[];
    modes: string[];
    msisdns: string[];
  };
};

function Sel({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, color: theme.colors.textMuted, letterSpacing: "0.6px", fontWeight: 600 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: theme.colors.surfaceAlt,
          color: theme.colors.textPrimary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          padding: "5px 8px",
          fontSize: 12,
          cursor: "pointer",
          minWidth: 90,
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export default function TelecomFilterBar({
  filters,
  onUpdate,
  onReset,
  onUploadCSV,
  onResetData,
  csvLoading,
  hasUploadedData,
  uniqueValues,
}: Props) {
  const { theme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    background: theme.colors.surfaceAlt,
    color: theme.colors.textPrimary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: "5px 8px",
    fontSize: 12,
  };

  return (
    <div
      style={{
        background: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(17,193,202,0.3)",
        borderRadius: theme.radius.lg,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Row 1: MSISDN + Date + Upload */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        {/* MSISDN primary search */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 10, color: "#11C1CA", letterSpacing: "0.6px", fontWeight: 700 }}>
            MSISDN (PRIMARY)
          </label>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: theme.colors.textMuted }} />
            <input
              type="text"
              value={filters.msisdn}
              onChange={(e) => onUpdate("msisdn", e.target.value)}
              placeholder="Enter mobile number..."
              list="msisdn-list"
              style={{ ...inputStyle, paddingLeft: 28, width: 200 }}
            />
            <datalist id="msisdn-list">
              {uniqueValues.msisdns.slice(0, 20).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Date preset */}
        <Sel
          label="DATE RANGE"
          value={filters.datePreset}
          options={["all", "today", "last3", "last7", "last10", "custom"]}
          onChange={(v) => onUpdate("datePreset", v as TelecomFilters["datePreset"])}
        />

        {/* Custom date range */}
        {filters.datePreset === "custom" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 10, color: theme.colors.textMuted, letterSpacing: "0.6px", fontWeight: 600 }}>FROM</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onUpdate("dateFrom", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 10, color: theme.colors.textMuted, letterSpacing: "0.6px", fontWeight: 600 }}>TO</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onUpdate("dateTo", e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Upload CSV */}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadCSV(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={csvLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: csvLoading ? theme.colors.surfaceAlt : "rgba(17,193,202,0.15)",
            border: "1px solid rgba(17,193,202,0.5)",
            borderRadius: theme.radius.md,
            color: csvLoading ? theme.colors.textMuted : "#11C1CA",
            fontSize: 12,
            fontWeight: 600,
            cursor: csvLoading ? "not-allowed" : "pointer",
          }}
        >
          <Upload size={13} />
          {csvLoading ? "Parsing..." : "Upload CSV"}
        </button>

        {/* Reset Data — only shown when CSV data is loaded */}
        {hasUploadedData && onResetData && (
          <button
            onClick={onResetData}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: theme.radius.md,
              color: "#EF4444",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <X size={13} />
            Reset Data
          </button>
        )}

        {/* Reset */}
        <button
          onClick={onReset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            background: "transparent",
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.textSecondary,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <X size={13} />
          Reset
        </button>
      </div>

      {/* Row 2: secondary filters */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Sel label="TYPE" value={filters.callType} options={["All", "Voice", "SMS", "Data"]} onChange={(v) => onUpdate("callType", v as any)} />
        <Sel label="OPERATOR" value={filters.operator} options={["All", ...uniqueValues.operators]} onChange={(v) => onUpdate("operator", v)} />
        <Sel label="NETWORK" value={filters.network} options={["All", ...uniqueValues.networks]} onChange={(v) => onUpdate("network", v)} />
        <Sel label="BAND" value={filters.band} options={["All", ...uniqueValues.bands]} onChange={(v) => onUpdate("band", v)} />
        <Sel label="MODE" value={filters.mode} options={["All", ...uniqueValues.modes]} onChange={(v) => onUpdate("mode", v)} />
        <Sel label="FAKE" value={filters.fake} options={["All", "Yes", "No"]} onChange={(v) => onUpdate("fake", v as any)} />
        <Sel label="SILENT CALL" value={filters.silentCallType} options={["All", "None", "Ping", "Spy"]} onChange={(v) => onUpdate("silentCallType", v as any)} />
      </div>
    </div>
  );
}
