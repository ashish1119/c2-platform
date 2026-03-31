import { useState } from "react";
import axios from "axios";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { uploadDecodioLog } from "../../api/decodio";

interface DecodioRecord {
  device_id?: number;
  alias?: string | null;
  stream_id?: number;
  protocol?: string | null;
  power?: number;
  status?: string | null;
  running?: boolean;
  disabled?: string | null;
  lock?: string | null;
  mode_id?: number;
  sample_rate?: string | null;
  reason?: string;
  label?: string | null;
  position?: string;
  time?: string;
  uuid?: string;
  version?: string;
  command?: string;
  color?: string | null;
  notes?: string | null;
  error?: string;
  raw_line?: string;
}

const DecodioLogUploadPage = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [records, setRecords] = useState<DecodioRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;

  const hasPermission = (requiredPermission: string) => {
    const permissions = user?.permissions ?? [];
    const [requiredResource, requiredAction] = requiredPermission.split(":");

    return (
      permissions.includes(requiredPermission) ||
      permissions.includes(`${requiredResource}:*`) ||
      permissions.includes(`*:${requiredAction}`) ||
      permissions.includes("*:*")
    );
  };

  const canReadDecodio = hasPermission("decodio:read");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.json')) {
        setError("Please select a .json file");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await uploadDecodioLog(file);

      setRecords(response.records);
      setTotalRecords(response.total_records);
      setCurrentPage(1);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || "Upload failed");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setUploading(false);
    }
  };

  const exportToCSV = () => {
    if (records.length === 0) return;

    const headers = [
      "Device ID",
      "Alias",
      "Stream ID",
      "Protocol",
      "Power",
      "Status",
      "Running",
      "Disabled",
      "Lock",
      "Mode ID",
      "Sample Rate",
      "Reason",
      "Label",
      "Position",
      "Time",
      "UUID",
      "Version",
      "Command",
      "Color",
      "Notes"
    ];

    const csvContent = [
      headers.join(","),
      ...records.map(record => [
        record.device_id || "",
        record.alias || "",
        record.stream_id || "",
        record.protocol || "",
        record.power || "",
        record.status || "",
        record.running || "",
        record.disabled || "",
        record.lock || "",
        record.mode_id || "",
        record.sample_rate || "",
        `"${record.reason || ""}"`,
        record.label || "",
        `"${record.position || ""}"`,
        record.time || "",
        record.uuid || "",
        record.version || "",
        record.command || "",
        record.color || "",
        `"${record.notes || ""}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "decodio_log_parsed.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const paginatedRecords = records.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const totalPages = Math.ceil(records.length / recordsPerPage);

  if (!canReadDecodio) {
    return (
      <AppLayout>
        <PageContainer title="Decodio Log Upload">
          <Card>
            <div style={{ color: theme.colors.danger, textAlign: "center", padding: theme.spacing.lg }}>
              You do not have permission to access Decodio log upload. Required permission: decodio:read
            </div>
          </Card>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer title="Decodio Log Upload">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Upload Decodio Log File</h3>
            <div style={{ display: "grid", gap: theme.spacing.md }}>
              <div>
                <label style={{ display: "block", marginBottom: theme.spacing.xs }}>
                  Select .json file:
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  style={{
                    width: "100%",
                    padding: theme.spacing.sm,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.sm,
                    background: theme.colors.surfaceAlt,
                    color: theme.colors.textPrimary,
                  }}
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  background: theme.colors.primary,
                  color: theme.colors.surface,
                  border: "none",
                  borderRadius: theme.radius.md,
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                {uploading ? "Uploading..." : "Upload and Parse"}
              </button>

              {error && (
                <div style={{ color: theme.colors.danger, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, borderRadius: theme.radius.sm }}>
                  {error}
                </div>
              )}
            </div>
          </Card>

          {records.length > 0 && (
            <>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.sm }}>
                  <h3 style={{ margin: 0 }}>Parsed Records ({totalRecords} total)</h3>
                  <button
                    onClick={exportToCSV}
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      background: theme.colors.success,
                      color: theme.colors.surface,
                      border: "none",
                      borderRadius: theme.radius.sm,
                      cursor: "pointer",
                    }}
                  >
                    Export CSV
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: theme.colors.surfaceAlt }}>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Device ID</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Alias</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Stream ID</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Protocol</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Power</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Status</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Running</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Mode ID</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Reason</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Time</th>
                        <th style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, textAlign: "left" }}>Command</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((record, index) => (
                        <tr key={index} style={{ background: index % 2 === 0 ? theme.colors.surface : theme.colors.surfaceAlt }}>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.device_id || "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.alias || "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.stream_id || "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.protocol || "-"}
                          </td>
                          <td
                            style={{
                              padding: theme.spacing.xs,
                              border: `1px solid ${theme.colors.border}`,
                              background: (record.power && record.power < -100) ? theme.colors.danger + "20" : "inherit"
                            }}
                          >
                            {record.power ? `${record.power} dBm` : "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.status || "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.running !== undefined ? (record.running ? "Yes" : "No") : "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.mode_id || "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {record.reason || "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.time || "-"}
                          </td>
                          <td style={{ padding: theme.spacing.xs, border: `1px solid ${theme.colors.border}` }}>
                            {record.command || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                        background: theme.colors.primary,
                        color: theme.colors.surface,
                        border: "none",
                        borderRadius: theme.radius.sm,
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        opacity: currentPage === 1 ? 0.5 : 1,
                      }}
                    >
                      Previous
                    </button>
                    <span style={{ alignSelf: "center" }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                        background: theme.colors.primary,
                        color: theme.colors.surface,
                        border: "none",
                        borderRadius: theme.radius.sm,
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                        opacity: currentPage === totalPages ? 0.5 : 1,
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
};

export default DecodioLogUploadPage;