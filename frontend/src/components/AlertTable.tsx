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

type SortColumn =
  | "id"
  | "details"
  | "type"
  | "source"
  | "date"
  | "time"
  | "latitude"
  | "longitude"
  | "status"
  | "ack"
  | "others";

type SortDirection = "asc" | "desc";

export default function AlertTable({ showAcknowledge = true }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [idFilter, setIdFilter] = useState("");
  const [detailsFilter, setDetailsFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [latitudeFilter, setLatitudeFilter] = useState("");
  const [longitudeFilter, setLongitudeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ackFilter, setAckFilter] = useState("");
  const [othersFilter, setOthersFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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

  const getDateValue = (alert: AlertRecord) => {
    if (!alert.created_at) return "-";
    return new Date(alert.created_at).toLocaleDateString();
  };
  const getTimeValue = (alert: AlertRecord) => {
    if (!alert.created_at) return "-";
    return new Date(alert.created_at).toLocaleTimeString();
  };
  const getDateSortValue = (alert: AlertRecord) => {
    if (!alert.created_at) return 0;
    const date = new Date(alert.created_at);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const getTimeSortValue = (alert: AlertRecord) => {
    if (!alert.created_at) return 0;
    const date = new Date(alert.created_at);
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  };
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
  const dateOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getDateValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const timeOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getTimeValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const latitudeOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getLatitudeValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const longitudeOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getLongitudeValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const statusOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => alert.status))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const ackOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => getAckValue(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);
  const othersOptions = useMemo(() => Array.from(new Set(alerts.map((alert) => renderOthers(alert)))).sort((a, b) => a.localeCompare(b)), [alerts]);

  const filteredAlerts = useMemo(() => {
    const matchesFilter = (value: string, filterValue: string) => {
      const trimmed = filterValue.trim().toLowerCase();
      if (!trimmed) return true;
      return value.toLowerCase().includes(trimmed);
    };

    return alerts.filter((alert) => {
      const idValue = displayIdByAlertId[alert.id] ?? "AL000";
      const detailsValue = inferAlertName(alert);
      const typeValue = inferAlertType(alert);
      const sourceValue = inferAlertSource(alert);
      const dateValue = getDateValue(alert);
      const timeValue = getTimeValue(alert);
      const latitudeValue = getLatitudeValue(alert);
      const longitudeValue = getLongitudeValue(alert);
      const statusValue = alert.status ?? "";
      const ackValue = getAckValue(alert);
      const othersValue = renderOthers(alert);

      if (!matchesFilter(idValue, idFilter)) return false;
      if (!matchesFilter(detailsValue, detailsFilter)) return false;
      if (!matchesFilter(typeValue, typeFilter)) return false;
      if (!matchesFilter(sourceValue, sourceFilter)) return false;
      if (!matchesFilter(dateValue, dateFilter)) return false;
      if (!matchesFilter(timeValue, timeFilter)) return false;
      if (!matchesFilter(latitudeValue, latitudeFilter)) return false;
      if (!matchesFilter(longitudeValue, longitudeFilter)) return false;
      if (!matchesFilter(statusValue, statusFilter)) return false;
      if (!matchesFilter(ackValue, ackFilter)) return false;
      if (!matchesFilter(othersValue, othersFilter)) return false;

      return true;
    });
  }, [
    ackFilter,
    alerts,
    dateFilter,
    detailsFilter,
    displayIdByAlertId,
    idFilter,
    latitudeFilter,
    longitudeFilter,
    othersFilter,
    sourceFilter,
    statusFilter,
    ackFilter,
    timeFilter,
    typeFilter,
  ]);

  const getSortLabel = (column: SortColumn) => {
    if (sortColumn !== column) return " ↕";
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  };

  const sortedAlerts = useMemo(() => {
    const sortable = [...filteredAlerts];

    const compareValues = (left: string | number, right: string | number) => {
      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }
      return String(left).localeCompare(String(right), undefined, { sensitivity: "base" });
    };

    const resolveValue = (alert: AlertRecord): string | number => {
      if (sortColumn === "id") return displayIdByAlertId[alert.id] ?? "AL000";
      if (sortColumn === "details") return inferAlertName(alert);
      if (sortColumn === "type") return inferAlertType(alert);
      if (sortColumn === "source") return inferAlertSource(alert);
      if (sortColumn === "date") return getDateSortValue(alert);
      if (sortColumn === "time") return getTimeSortValue(alert);
      if (sortColumn === "latitude") return typeof alert.latitude === "number" ? alert.latitude : Number.NEGATIVE_INFINITY;
      if (sortColumn === "longitude") return typeof alert.longitude === "number" ? alert.longitude : Number.NEGATIVE_INFINITY;
      if (sortColumn === "status") return alert.status ?? "";
      if (sortColumn === "ack") return getAckValue(alert);
      return renderOthers(alert);
    };

    sortable.sort((leftAlert, rightAlert) => {
      const leftValue = resolveValue(leftAlert);
      const rightValue = resolveValue(rightAlert);
      const result = compareValues(leftValue, rightValue);
      return sortDirection === "asc" ? result : -result;
    });

    return sortable;
  }, [filteredAlerts, sortColumn, sortDirection, displayIdByAlertId, assetNameById]);

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
    "Date",
    "Time",
    "Latitude",
    "Longitude",
    "Status",
    "Ack",
    "Others",
  ];

  const exportRows = useMemo(
    () =>
      sortedAlerts.map((alert) => [
        displayIdByAlertId[alert.id] ?? "AL000",
        inferAlertName(alert),
        inferAlertType(alert),
        inferAlertSource(alert),
        getDateValue(alert),
        getTimeValue(alert),
        getLatitudeValue(alert),
        getLongitudeValue(alert),
        alert.status ?? "-",
        getAckValue(alert),
        renderOthers(alert),
      ]),
    [sortedAlerts, displayIdByAlertId],
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

  const sortButtonStyle = {
    border: "none",
    background: "transparent",
    color: theme.colors.textPrimary,
    cursor: "pointer",
    padding: 0,
    font: "inherit",
    width: "100%",
    textAlign: "left" as const,
  };

  const filterInputStyle = {
    width: "100%",
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    background: theme.colors.surface,
    color: theme.colors.textPrimary,
  };

  const clearAllFilters = () => {
    setIdFilter("");
    setDetailsFilter("");
    setTypeFilter("");
    setSourceFilter("");
    setDateFilter("");
    setTimeFilter("");
    setLatitudeFilter("");
    setLongitudeFilter("");
    setStatusFilter("");
    setAckFilter("");
    setOthersFilter("");
  };

  const hasActiveFilters = [
    idFilter,
    detailsFilter,
    typeFilter,
    sourceFilter,
    dateFilter,
    timeFilter,
    latitudeFilter,
    longitudeFilter,
    statusFilter,
    ackFilter,
    othersFilter,
  ].some((value) => value.trim().length > 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.sm }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>Alert List</h3>
        <div style={{ display: "inline-flex", gap: theme.spacing.sm }}>
          <button
            type="button"
            onClick={clearAllFilters}
            disabled={!hasActiveFilters}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: theme.colors.surface,
              color: theme.colors.textPrimary,
              cursor: hasActiveFilters ? "pointer" : "not-allowed",
              opacity: hasActiveFilters ? 1 : 0.6,
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            }}
          >
            Clear Filters
          </button>
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
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("id")} style={sortButtonStyle}>
                {`ID${getSortLabel("id")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("details")} style={sortButtonStyle}>
                {`Details${getSortLabel("details")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("type")} style={sortButtonStyle}>
                {`Type${getSortLabel("type")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("source")} style={sortButtonStyle}>
                {`Source${getSortLabel("source")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("date")} style={sortButtonStyle}>
                {`Date${getSortLabel("date")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("time")} style={sortButtonStyle}>
                {`Time${getSortLabel("time")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("latitude")} style={sortButtonStyle}>
                {`Latitude${getSortLabel("latitude")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("longitude")} style={sortButtonStyle}>
                {`Longitude${getSortLabel("longitude")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("status")} style={sortButtonStyle}>
                {`Status${getSortLabel("status")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("ack")} style={sortButtonStyle}>
                {`Ack${getSortLabel("ack")}`}
              </button>
            </th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              <button type="button" onClick={() => toggleSort("others")} style={sortButtonStyle}>
                {`Others${getSortLabel("others")}`}
              </button>
            </th>
          </tr>
          <tr>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={idFilter} onChange={(event) => setIdFilter(event.target.value)} placeholder="Search" list="id-filter-options" style={filterInputStyle} />
              <datalist id="id-filter-options">
                {idOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={detailsFilter} onChange={(event) => setDetailsFilter(event.target.value)} placeholder="Search" list="details-filter-options" style={filterInputStyle} />
              <datalist id="details-filter-options">
                {detailsOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} placeholder="Search" list="type-filter-options" style={filterInputStyle} />
              <datalist id="type-filter-options">
                {typeOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="Search" list="source-filter-options" style={filterInputStyle} />
              <datalist id="source-filter-options">
                {sourceOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} placeholder="Search" list="date-filter-options" style={filterInputStyle} />
              <datalist id="date-filter-options">
                {dateOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} placeholder="Search" list="time-filter-options" style={filterInputStyle} />
              <datalist id="time-filter-options">
                {timeOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={latitudeFilter} onChange={(event) => setLatitudeFilter(event.target.value)} placeholder="Search" list="latitude-filter-options" style={filterInputStyle} />
              <datalist id="latitude-filter-options">
                {latitudeOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={longitudeFilter} onChange={(event) => setLongitudeFilter(event.target.value)} placeholder="Search" list="longitude-filter-options" style={filterInputStyle} />
              <datalist id="longitude-filter-options">
                {longitudeOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder="Search" list="status-filter-options" style={filterInputStyle} />
              <datalist id="status-filter-options">
                {statusOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={ackFilter} onChange={(event) => setAckFilter(event.target.value)} placeholder="Search" list="ack-filter-options" style={filterInputStyle} />
              <datalist id="ack-filter-options">
                {ackOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
            <th style={{ padding: theme.spacing.xs, borderBottom: `1px solid ${theme.colors.border}` }}>
              <input value={othersFilter} onChange={(event) => setOthersFilter(event.target.value)} placeholder="Search" list="others-filter-options" style={filterInputStyle} />
              <datalist id="others-filter-options">
                {othersOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedAlerts.map((alert) => (
            <tr key={alert.id}>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{displayIdByAlertId[alert.id] ?? "AL000"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertName(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertType(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertSource(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{getDateValue(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{getTimeValue(alert)}</td>
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
          {sortedAlerts.length === 0 && (
            <tr>
              <td style={{ padding: theme.spacing.sm }} colSpan={11}>No matching alerts found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}