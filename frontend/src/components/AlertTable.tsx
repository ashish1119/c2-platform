import { useCallback, useEffect, useMemo, useState } from "react";
import { acknowledgeAlert, clearAlert, getAlerts, type AlertRecord } from "../api/alerts";
import { getAssets } from "../api/assets";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Props = {
  showAcknowledge?: boolean;
};

export default function AlertTable({ showAcknowledge = true }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [idFilter, setIdFilter] = useState("ALL");
  const [detailsFilter, setDetailsFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [dateTimeFilter, setDateTimeFilter] = useState("ALL");
  const [latitudeFilter, setLatitudeFilter] = useState("ALL");
  const [longitudeFilter, setLongitudeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ackFilter, setAckFilter] = useState("ALL");
  const [othersFilter, setOthersFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackInProgressId, setAckInProgressId] = useState<string | null>(null);
  const [clearInProgressId, setClearInProgressId] = useState<string | null>(null);
  const [assetNameById, setAssetNameById] = useState<Record<string, string>>({});

  const inferAlertType = (alert: AlertRecord) => {
    if (alert.alert_type && alert.alert_type.trim().length > 0) {
      const normalized = alert.alert_type.trim().toUpperCase();
      if (normalized === "DF" || normalized === "DIRECTION_FINDER") {
        return "Direction Finder";
      }
      return alert.alert_type;
    }
    const description = alert.description ?? "";
    const eventMatch = description.match(/event=([^\s]+)/i);
    if (eventMatch?.[1]) {
      return eventMatch[1].toUpperCase();
    }
    return alert.severity;
  };

  const inferAlertName = (alert: AlertRecord) => {
    if (alert.alert_name && alert.alert_name.trim().length > 0) {
      return alert.alert_name;
    }
    const description = (alert.description ?? "").trim();
    if (description.length > 0) {
      return description.length > 64 ? `${description.slice(0, 64)}...` : description;
    }
    return `${alert.severity} Alert`;
  };

  const inferAlertSource = (alert: AlertRecord) => {
    if (alert.asset_id) {
      return assetNameById[alert.asset_id] ?? "Unknown Asset";
    }

    const description = alert.description ?? "";
    const sourceNameMatch = description.match(/source_name=([^|,\s]+)/i);
    if (sourceNameMatch?.[1]) {
      return sourceNameMatch[1].replace(/_/g, " ");
    }

    const senderMatch = description.match(/sender=([^\s|,]+)/i);
    if (senderMatch?.[1]) {
      return senderMatch[1].replace(/_/g, " ");
    }

    const fromMatch = description.match(/from\s([^:]+):/i);
    if (fromMatch?.[1]) {
      return fromMatch[1].trim();
    }

    return "-";
  };

  const renderOthers = (alert: AlertRecord) => {
    const bits: string[] = [];
    const acknowledgerLabel = alert.acknowledged_by_name ?? alert.acknowledged_by ?? null;
    if (acknowledgerLabel) {
      bits.push(`Ack By: ${acknowledgerLabel}`);
    }
    if (alert.acknowledged_at) {
      bits.push(`Ack At: ${new Date(alert.acknowledged_at).toLocaleString()}`);
    }
    return bits.length > 0 ? bits.join(" | ") : "-";
  };

  const getAlertPrefix = (alert: AlertRecord) => {
    const normalizedType = (alert.alert_type ?? "").trim().toUpperCase();
    if (normalizedType === "DF" || normalizedType === "DIRECTION_FINDER") return "DF";
    if (normalizedType === "JAMMER") return "JM";
    if (normalizedType === "RADAR") return "RD";
    if (normalizedType === "EO_SENSOR") return "EO";
    if (normalizedType === "SMS") return "SM";
    return "AL";
  };

  const displayIdByAlertId = useMemo(() => {
    const serialByPrefix: Record<string, number> = {};
    const mapping: Record<string, string> = {};

    for (const alert of alerts) {
      const prefix = getAlertPrefix(alert);
      const nextSerial = (serialByPrefix[prefix] ?? 0) + 1;
      serialByPrefix[prefix] = nextSerial;
      mapping[alert.id] = `${prefix}${String(nextSerial).padStart(3, "0")}`;
    }

    return mapping;
  }, [alerts]);

  const getDateTimeValue = (alert: AlertRecord) => (alert.created_at ? new Date(alert.created_at).toLocaleString() : "-");
  const getLatitudeValue = (alert: AlertRecord) => (typeof alert.latitude === "number" ? alert.latitude.toFixed(6) : "-");
  const getLongitudeValue = (alert: AlertRecord) => (typeof alert.longitude === "number" ? alert.longitude.toFixed(6) : "-");
  const getAckValue = (alert: AlertRecord) => {
    if (alert.status === "NEW") return "Ack";
    if (alert.status === "ACKNOWLEDGED") return "Clear";
    if (alert.acknowledged_at) return "Acknowledged";
    return "-";
  };

  const idOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => displayIdByAlertId[alert.id] ?? "AL000"))).sort((a, b) => a.localeCompare(b)), [alerts, displayIdByAlertId]);
  const detailsOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => inferAlertName(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const typeOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => inferAlertType(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const sourceOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => inferAlertSource(alert)))).sort((a, b) => a.localeCompare(b)), [alerts, assetNameById]);
  const dateTimeOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getDateTimeValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const latitudeOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getLatitudeValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const longitudeOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getLongitudeValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const statusOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => alert.status))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const ackOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getAckValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const othersOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => renderOthers(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const idValue = displayIdByAlertId[alert.id] ?? "AL000";
      const detailsValue = inferAlertName(alert);
      const typeValue = inferAlertType(alert);
      const sourceValue = inferAlertSource(alert);
      const dateTimeValue = getDateTimeValue(alert);
      const latitudeValue = getLatitudeValue(alert);
      const longitudeValue = getLongitudeValue(alert);
      const statusValue = alert.status ?? "";
      const ackValue = getAckValue(alert);
      const othersValue = renderOthers(alert);

      if (idFilter !== "ALL" && idValue !== idFilter) return false;
      if (detailsFilter !== "ALL" && detailsValue !== detailsFilter) return false;
      if (typeFilter !== "ALL" && typeValue !== typeFilter) return false;
      if (sourceFilter !== "ALL" && sourceValue !== sourceFilter) return false;
      if (dateTimeFilter !== "ALL" && dateTimeValue !== dateTimeFilter) return false;
      if (latitudeFilter !== "ALL" && latitudeValue !== latitudeFilter) return false;
      if (longitudeFilter !== "ALL" && longitudeValue !== longitudeFilter) return false;
      if (statusFilter !== "ALL" && statusValue !== statusFilter) return false;
      if (ackFilter !== "ALL" && ackValue !== ackFilter) return false;
      if (othersFilter !== "ALL" && othersValue !== othersFilter) return false;

      return true;
    });
  }, [
    ackFilter,
    alerts,
    dateTimeFilter,
    detailsFilter,
    displayIdByAlertId,
    idFilter,
    latitudeFilter,
    longitudeFilter,
    othersFilter,
    sourceFilter,
    statusFilter,
    typeFilter,
  ]);

  const loadAlerts = useCallback(async () => {
    try {
      setError(null);
      const [alertsResponse, assetsResponse] = await Promise.all([getAlerts(), getAssets()]);
      setAlerts(alertsResponse.data);
      setAssetNameById(
        Object.fromEntries(assetsResponse.data.map((asset) => [asset.id, asset.name]))
      );
    } catch {
      setError("Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const ws = new WebSocket("ws://localhost:8000/ws/alerts");
    ws.onmessage = () => {
      loadAlerts();
    };

    const interval = setInterval(loadAlerts, 10000);
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [loadAlerts]);

  const handleAcknowledge = async (id: string) => {
    if (!user) return;
    try {
      setAckInProgressId(id);
      await acknowledgeAlert(id, user.id);
      await loadAlerts();
    } catch {
      setError("Failed to acknowledge alert.");
    } finally {
      setAckInProgressId(null);
    }
  };

  const handleClear = async (id: string) => {
    try {
      setClearInProgressId(id);
      await clearAlert(id);
      await loadAlerts();
    } catch {
      setError("Failed to clear alert.");
    } finally {
      setClearInProgressId(null);
    }
  };

  const exportHeaders = [
    "ID",
    "Details",
    "Type",
    "Source",
    "Date and Time",
    "Latitude",
    "Longitude",
    "Status",
    "Ack",
    "Others",
  ];

  const exportRows = useMemo(
    () =>
      filteredAlerts.map((alert) => [
        displayIdByAlertId[alert.id] ?? "AL000",
        inferAlertName(alert),
        inferAlertType(alert),
        inferAlertSource(alert),
        getDateTimeValue(alert),
        getLatitudeValue(alert),
        getLongitudeValue(alert),
        alert.status ?? "-",
        getAckValue(alert),
        renderOthers(alert),
      ]),
    [filteredAlerts, displayIdByAlertId],
  );

  const buildFileTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  };

  const exportCsv = () => {
    const escapeValue = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      exportHeaders.map(escapeValue).join(","),
      ...exportRows.map((row) => row.map((cell) => escapeValue(String(cell ?? ""))).join(",")),
    ];

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alerts_${buildFileTimestamp()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12);
    doc.text("Alert List", 14, 12);

    autoTable(doc, {
      startY: 16,
      head: [exportHeaders],
      body: exportRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95] },
      theme: "grid",
    });

    doc.save(`alerts_${buildFileTimestamp()}.pdf`);
  };

  if (loading) {
    return <div style={{ color: theme.colors.textSecondary }}>Loading alerts...</div>;
  }

  if (error) {
    return <div style={{ color: theme.colors.danger }}>{error}</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.sm }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>Alert List</h3>
        <div style={{ display: "inline-flex", gap: theme.spacing.sm }}>
          <button
            type="button"
            onClick={exportCsv}
            style={{
              border: "none",
              borderRadius: theme.radius.md,
              background: theme.colors.primary,
              color: "#fff",
              cursor: "pointer",
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            }}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportPdf}
            style={{
              border: "none",
              borderRadius: theme.radius.md,
              background: theme.colors.surface,
              color: theme.colors.textPrimary,
              cursor: "pointer",
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            }}
          >
            Export PDF
          </button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>ID</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Details</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Type</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Source</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Date and Time</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Latitude</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Longitude</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Status</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Ack</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Others</th>
          </tr>
          <tr>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={idFilter}
                onChange={(event) => setIdFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {idOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={detailsFilter}
                onChange={(event) => setDetailsFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {detailsOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {sourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={dateTimeFilter}
                onChange={(event) => setDateTimeFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {dateTimeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={latitudeFilter}
                onChange={(event) => setLatitudeFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {latitudeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={longitudeFilter}
                onChange={(event) => setLongitudeFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {longitudeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={ackFilter}
                onChange={(event) => setAckFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {ackOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <select
                value={othersFilter}
                onChange={(event) => setOthersFilter(event.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                }}
              >
                <option value="ALL">All</option>
                {othersOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredAlerts.map((alert) => (
            <tr key={alert.id}>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{displayIdByAlertId[alert.id] ?? "AL000"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertName(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertType(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertSource(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.created_at ? new Date(alert.created_at).toLocaleString() : "-"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{typeof alert.latitude === "number" ? alert.latitude.toFixed(6) : "-"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{typeof alert.longitude === "number" ? alert.longitude.toFixed(6) : "-"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.status}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                {alert.status === "NEW" && showAcknowledge ? (
                  <button
                    style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                    disabled={ackInProgressId === alert.id}
                    onClick={() => handleAcknowledge(alert.id)}
                  >
                    {ackInProgressId === alert.id ? "Acknowledging..." : "Ack"}
                  </button>
                ) : alert.status === "ACKNOWLEDGED" ? (
                  <button
                    style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.warning, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                    disabled={clearInProgressId === alert.id}
                    onClick={() => handleClear(alert.id)}
                  >
                    {clearInProgressId === alert.id ? "Clearing..." : "Clear"}
                  </button>
                ) : alert.acknowledged_at ? "Acknowledged" : "-"}
              </td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{renderOthers(alert)}</td>
            </tr>
          ))}
          {filteredAlerts.length === 0 && (
            <tr>
              <td style={{ padding: theme.spacing.sm }} colSpan={10}>No matching alerts found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}