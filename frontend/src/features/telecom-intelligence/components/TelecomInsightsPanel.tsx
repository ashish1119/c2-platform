import { useTheme } from "../../../context/ThemeContext";
import type { TelecomRecord } from "../model";
import { Signal, Radio, Users, AlertTriangle, MapPin } from "lucide-react";

function Row({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${theme.colors.border}15`, fontSize: 12 }}>
      <span style={{ color: theme.colors.textSecondary }}>{label}</span>
      <span style={{ fontWeight: 600, color: danger ? theme.colors.danger : theme.colors.textPrimary }}>{value}</span>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "#11C1CA", letterSpacing: "0.8px", marginBottom: 8 }}>
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

export default function TelecomInsightsPanel({ record }: { record: TelecomRecord | null }) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const glass: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(17,193,202,0.35)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  };

  if (!record) {
    return (
      <div style={{ ...glass, display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
        <span style={{ color: theme.colors.textMuted, fontSize: 13 }}>Select a record</span>
      </div>
    );
  }

  const isSuspicious = record.fake || record.silentCallType !== "None";

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      {/* Identity */}
      <div style={glass}>
        <Section icon={<Users size={12} />} title="IDENTITY">
          <Row label="MSISDN" value={record.msisdn} />
          <Row label="Target" value={record.target || "—"} />
          {record.imsi && <Row label="IMSI" value={record.imsi} />}
          {record.imei && <Row label="IMEI" value={record.imei} />}
          {record.deviceModel && <Row label="Device" value={record.deviceModel} />}
        </Section>
      </div>

      {/* Network */}
      <div style={glass}>
        <Section icon={<Radio size={12} />} title="NETWORK">
          <Row label="Operator" value={record.operator || "—"} />
          <Row label="Network" value={record.network || "—"} />
          <Row label="Band" value={record.band || "—"} />
          <Row label="RAN" value={record.ran || "—"} />
          <Row label="Mode" value={record.mode || "—"} />
          {record.arfcn !== undefined && <Row label="ARFCN" value={record.arfcn} />}
          {record.rxLevel !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
              <span style={{ color: theme.colors.textSecondary }}>Rx Level</span>
              <span style={{ fontWeight: 700, color: record.rxLevel > -80 ? theme.colors.success : record.rxLevel > -95 ? theme.colors.warning : theme.colors.danger }}>
                {record.rxLevel} dBm
              </span>
            </div>
          )}
        </Section>
      </div>

      {/* Location */}
      <div style={glass}>
        <Section icon={<MapPin size={12} />} title="LOCATION">
          <Row label="Place" value={record.place || "—"} />
          <Row label="Country" value={record.country || "—"} />
          <Row label="Latitude" value={record.latitude?.toFixed(5) ?? "—"} />
          <Row label="Longitude" value={record.longitude?.toFixed(5) ?? "—"} />
        </Section>
      </div>

      {/* Suspicious */}
      {isSuspicious && (
        <div
          style={{
            ...glass,
            border: `1px solid ${theme.colors.danger}60`,
            background: isDark ? `${theme.colors.danger}10` : `${theme.colors.danger}06`,
          }}
        >
          <Section icon={<AlertTriangle size={12} />} title="SUSPICIOUS ACTIVITY">
            {record.fake && (
              <div style={{ padding: "6px 10px", background: `${theme.colors.danger}15`, borderRadius: 6, marginBottom: 6, fontSize: 12, color: theme.colors.danger, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={12} /> Fake Signal Detected
              </div>
            )}
            {record.silentCallType !== "None" && (
              <div style={{ padding: "6px 10px", background: `${theme.colors.warning}15`, borderRadius: 6, fontSize: 12, color: theme.colors.warning, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={12} /> Silent Call: {record.silentCallType}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
