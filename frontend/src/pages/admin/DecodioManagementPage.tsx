import { useEffect, useMemo, useState } from "react";

import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import { getAuditLogs } from "../../api/audit";
import { grantDecodioReadToOperator } from "../../api/roles";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  addDecodioNeighbourStreams,
  deleteDecodioDevice,
  deleteDecodioStream,
  type DecodioHealth,
  getDecodioConfig,
  getDecodioCarrierInfo,
  getDecodioHealth,
  modifyDecodioDevice,
  modifyDecodioStream,
  seedDecodioTestEvents,
  startDecodioDevice,
  stopDecodioDevice,
  updateDecodioConfig,
  type DecodioConfig,
} from "../../api/decodio";

type CommandKey =
  | "modifyDevice"
  | "startDevice"
  | "stopDevice"
  | "deleteDevice"
  | "modifyStream"
  | "deleteStream"
  | "GetCarrierInfo"
  | "AddNeighbourStreams";

const commandOptions: { key: CommandKey; label: string }[] = [
  { key: "modifyDevice", label: "modifyDevice" },
  { key: "startDevice", label: "startDevice" },
  { key: "stopDevice", label: "stopDevice" },
  { key: "deleteDevice", label: "deleteDevice" },
  { key: "modifyStream", label: "modifyStream" },
  { key: "deleteStream", label: "deleteStream" },
  { key: "GetCarrierInfo", label: "GetCarrierInfo" },
  { key: "AddNeighbourStreams", label: "AddNeighbourStreams" },
];

export default function DecodioManagementPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const canRead =
    permissions.includes("decodio:read") ||
    permissions.includes("decodio:*") ||
    permissions.includes("*:read") ||
    permissions.includes("*:*");
  const canWrite =
    permissions.includes("decodio:write") ||
    permissions.includes("decodio:*") ||
    permissions.includes("*:write") ||
    permissions.includes("*:*");
  const canReadAudit =
    permissions.includes("audit:read") ||
    permissions.includes("audit:*") ||
    permissions.includes("*:read") ||
    permissions.includes("*:*");
  const [selectedCommand, setSelectedCommand] = useState<CommandKey>("GetCarrierInfo");
  const [payloadText, setPayloadText] = useState("{}");
  const [health, setHealth] = useState<string>("Not loaded");
  const [responseText, setResponseText] = useState<string>("");
  const [simulationText, setSimulationText] = useState<string>("No simulation executed yet");
  const [seedText, setSeedText] = useState<string>("No seed executed yet");
  const [config, setConfig] = useState<DecodioConfig | null>(null);
  const [configAliasesText, setConfigAliasesText] = useState<string>("{}");
  const [configStatus, setConfigStatus] = useState<string>("Config not loaded");
  const [connectionStatus, setConnectionStatus] = useState<string>("Connection test not run");
  const [busy, setBusy] = useState(false);

  const loadConfig = async () => {
    if (!canRead) {
      setConfigStatus("Forbidden: missing decodio:read permission");
      return;
    }
    try {
      setBusy(true);
      const result = await getDecodioConfig();
      setConfig(result.data);
      setConfigAliasesText(JSON.stringify(result.data.event_aliases ?? {}, null, 2));
      setConfigStatus("Configuration loaded");
    } catch (error: any) {
      setConfigStatus(error?.response?.data ? JSON.stringify(error.response.data, null, 2) : "Failed to load configuration");
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async () => {
    if (!canWrite || !config) {
      setConfigStatus("Forbidden: missing decodio:write permission");
      return;
    }

    try {
      setBusy(true);
      const parsedAliases = configAliasesText.trim().length ? JSON.parse(configAliasesText) : {};
      const payload: DecodioConfig = {
        ...config,
        event_aliases: parsedAliases,
      };
      const result = await updateDecodioConfig(payload);
      setConfig(result.data);
      setConfigAliasesText(JSON.stringify(result.data.event_aliases ?? {}, null, 2));
      setConfigStatus("Configuration saved and applied");
      await loadHealth();
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setConfigStatus("Invalid event aliases JSON");
      } else {
        setConfigStatus(
          error?.response?.data
            ? JSON.stringify(error.response.data, null, 2)
            : "Failed to save configuration"
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const executeCommand = useMemo(
    () =>
      ({ command, payload }: { command: CommandKey; payload: Record<string, unknown> }) => {
        switch (command) {
          case "modifyDevice":
            return modifyDecodioDevice(payload);
          case "startDevice":
            return startDecodioDevice(payload);
          case "stopDevice":
            return stopDecodioDevice(payload);
          case "deleteDevice":
            return deleteDecodioDevice(payload);
          case "modifyStream":
            return modifyDecodioStream(payload);
          case "deleteStream":
            return deleteDecodioStream(payload);
          case "GetCarrierInfo":
            return getDecodioCarrierInfo();
          case "AddNeighbourStreams":
            return addDecodioNeighbourStreams(payload);
          default:
            return getDecodioCarrierInfo();
        }
      },
    []
  );

  const loadHealth = async () => {
    if (!canRead) {
      setHealth("Forbidden: missing decodio:read permission");
      return;
    }
    try {
      setBusy(true);
      const result = await getDecodioHealth();
      setHealth(JSON.stringify(result.data, null, 2));
    } catch (error: any) {
      setHealth(error?.response?.data ? JSON.stringify(error.response.data, null, 2) : "Failed to load health");
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    if (!canRead) {
      setConnectionStatus("Forbidden: missing decodio:read permission");
      return;
    }

    try {
      setBusy(true);
      const result = await getDecodioHealth();
      const healthData: DecodioHealth = result.data;
      setHealth(JSON.stringify(healthData, null, 2));

      if (!healthData.enabled) {
        setConnectionStatus("FAIL: integration is disabled");
      } else if (healthData.connected) {
        setConnectionStatus(`PASS: connected to ${healthData.host}:${healthData.port}`);
      } else {
        setConnectionStatus(
          `FAIL: not connected (${healthData.state}${healthData.last_error ? `, ${healthData.last_error}` : ""})`
        );
      }
    } catch (error: any) {
      setConnectionStatus(
        error?.response?.data
          ? `FAIL: ${JSON.stringify(error.response.data)}`
          : "FAIL: health check request failed"
      );
    } finally {
      setBusy(false);
    }
  };

  const runCommand = async () => {
    const isReadOnlyCommand = selectedCommand === "GetCarrierInfo";
    if (isReadOnlyCommand && !canRead) {
      setResponseText("Forbidden: missing decodio:read permission");
      return;
    }
    if (!isReadOnlyCommand && !canWrite) {
      setResponseText("Forbidden: missing decodio:write permission");
      return;
    }
    try {
      setBusy(true);
      const payload = payloadText.trim().length ? JSON.parse(payloadText) : {};
      const result = await executeCommand({ command: selectedCommand, payload });
      setResponseText(JSON.stringify(result.data, null, 2));
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setResponseText("Invalid JSON payload");
      } else {
        setResponseText(
          error?.response?.data
            ? JSON.stringify(error.response.data, null, 2)
            : "Command execution failed"
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const runSimulation = async () => {
    if (!canReadAudit) {
      setSimulationText("Forbidden: missing audit:read permission");
      return;
    }

    try {
      setBusy(true);
      const workflow = await grantDecodioReadToOperator();
      const audit = await getAuditLogs({ action: "PERMISSION_WORKFLOW_APPLY", limit: 1 });
      const latest = audit.data?.[0];

      const passed =
        latest?.action === "PERMISSION_WORKFLOW_APPLY" &&
        latest?.details?.workflow === "decodio-read-operator";

      setSimulationText(
        JSON.stringify(
          {
            status: passed ? "PASS" : "FAIL",
            workflow_response: workflow.data,
            latest_audit: latest ?? null,
          },
          null,
          2
        )
      );
    } catch (error: any) {
      setSimulationText(
        error?.response?.data
          ? JSON.stringify(error.response.data, null, 2)
          : "Simulation failed"
      );
    } finally {
      setBusy(false);
    }
  };

  const runSeedEvents = async () => {
    if (!canWrite) {
      setSeedText("Forbidden: missing decodio:write permission");
      return;
    }

    try {
      setBusy(true);
      const result = await seedDecodioTestEvents();
      setSeedText(JSON.stringify(result.data, null, 2));
      await loadHealth();
    } catch (error: any) {
      setSeedText(
        error?.response?.data
          ? JSON.stringify(error.response.data, null, 2)
          : "Failed to seed Decodio test events"
      );
    } finally {
      setBusy(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: theme.spacing.sm,
    color: theme.colors.textSecondary,
  };

  const controlStyle: React.CSSProperties = {
    width: "100%",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.background,
    color: theme.colors.textPrimary,
  };

  const buttonStyle: React.CSSProperties = {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.primary,
    color: "#ffffff",
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.7 : 1,
  };

  useEffect(() => {
    loadConfig();
    loadHealth();
  }, []);

  const preStyle: React.CSSProperties = {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: theme.colors.textPrimary,
  };

  const connectionStatusColor = connectionStatus.startsWith("PASS")
    ? theme.colors.success
    : connectionStatus.startsWith("FAIL")
      ? theme.colors.danger
      : theme.colors.textSecondary;

  return (
    <AppLayout>
      <PageContainer title="Decodio Control">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <Card>
            <div style={{ display: "flex", gap: theme.spacing.md, alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>Integration Configuration</h3>
              <div style={{ display: "flex", gap: theme.spacing.sm }}>
                <button type="button" onClick={loadConfig} disabled={busy} style={buttonStyle}>
                  Load Config
                </button>
                <button type="button" onClick={testConnection} disabled={busy || !canRead} style={buttonStyle}>
                  Test Connection
                </button>
                <button type="button" onClick={saveConfig} disabled={busy || !canWrite || !config} style={buttonStyle}>
                  Save Config
                </button>
              </div>
            </div>

            {config && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                <label style={labelStyle}>
                  Enabled
                  <select
                    value={config.enabled ? "true" : "false"}
                    onChange={(event) => setConfig({ ...config, enabled: event.target.value === "true" })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  JSON Format
                  <select
                    value={config.json_format}
                    onChange={(event) => setConfig({ ...config, json_format: event.target.value })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  >
                    <option value="auto">auto</option>
                    <option value="payload">payload</option>
                    <option value="data">data</option>
                    <option value="root">root</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Host / IP
                  <input
                    value={config.host}
                    onChange={(event) => setConfig({ ...config, host: event.target.value })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  />
                </label>

                <label style={labelStyle}>
                  Port
                  <input
                    type="number"
                    value={config.port}
                    onChange={(event) => setConfig({ ...config, port: Number(event.target.value) })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  />
                </label>

                <label style={labelStyle}>
                  Connect Timeout (s)
                  <input
                    type="number"
                    step="0.1"
                    value={config.connect_timeout_seconds}
                    onChange={(event) => setConfig({ ...config, connect_timeout_seconds: Number(event.target.value) })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  />
                </label>

                <label style={labelStyle}>
                  Read Timeout (s)
                  <input
                    type="number"
                    step="0.1"
                    value={config.read_timeout_seconds}
                    onChange={(event) => setConfig({ ...config, read_timeout_seconds: Number(event.target.value) })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  />
                </label>

                <label style={labelStyle}>
                  Heartbeat Interval (s)
                  <input
                    type="number"
                    value={config.heartbeat_interval_seconds}
                    onChange={(event) => setConfig({ ...config, heartbeat_interval_seconds: Number(event.target.value) })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  />
                </label>

                <label style={labelStyle}>
                  Ack Timeout (s)
                  <input
                    type="number"
                    step="0.1"
                    value={config.ack_timeout_seconds}
                    onChange={(event) => setConfig({ ...config, ack_timeout_seconds: Number(event.target.value) })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  />
                </label>

                <label style={labelStyle}>
                  Reconnect Max (s)
                  <input
                    type="number"
                    value={config.reconnect_max_seconds}
                    onChange={(event) => setConfig({ ...config, reconnect_max_seconds: Number(event.target.value) })}
                    style={{ ...controlStyle, marginTop: theme.spacing.xs }}
                  />
                </label>
              </div>
            )}

            {config && (
              <div style={{ marginTop: theme.spacing.md }}>
                <label style={labelStyle}>Event Aliases (JSON)</label>
                <textarea
                  rows={8}
                  value={configAliasesText}
                  onChange={(event) => setConfigAliasesText(event.target.value)}
                  style={controlStyle}
                />
              </div>
            )}

            <div style={{ marginTop: theme.spacing.md, color: theme.colors.textSecondary }}>
              {configStatus}
            </div>
            <div style={{ marginTop: theme.spacing.xs, color: connectionStatusColor }}>
              {connectionStatus}
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", gap: theme.spacing.md, alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>Health</h3>
              <button type="button" onClick={loadHealth} disabled={busy} style={buttonStyle}>
                Refresh Health
              </button>
            </div>
            <div style={{ marginTop: theme.spacing.md }}>
              <pre style={preStyle}>{health}</pre>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", gap: theme.spacing.md, alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>Simulation Runner</h3>
              <div style={{ display: "flex", gap: theme.spacing.sm }}>
                <button type="button" onClick={runSimulation} disabled={busy} style={buttonStyle}>
                  Run Workflow Simulation
                </button>
                <button type="button" onClick={runSeedEvents} disabled={busy || !canWrite} style={buttonStyle}>
                  Seed Decodio Events
                </button>
              </div>
            </div>
            <div style={{ marginTop: theme.spacing.md }}>
              <pre style={preStyle}>{simulationText}</pre>
            </div>
            <div style={{ marginTop: theme.spacing.md }}>
              <h4 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Seed Result</h4>
              <pre style={preStyle}>{seedText}</pre>
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Command Executor</h3>
            <label style={labelStyle}>Command</label>
            <select
              value={selectedCommand}
              onChange={(event) => setSelectedCommand(event.target.value as CommandKey)}
              style={controlStyle}
            >
              {commandOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>

            <div style={{ marginTop: theme.spacing.md }}>
              <label style={labelStyle}>Payload (JSON)</label>
              <textarea
                value={payloadText}
                onChange={(event) => setPayloadText(event.target.value)}
                rows={10}
                style={controlStyle}
              />
            </div>

            <div style={{ marginTop: theme.spacing.md, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={runCommand} disabled={busy} style={buttonStyle}>
                Run Command
              </button>
            </div>
            {!canWrite && (
              <div style={{ marginTop: theme.spacing.sm, color: theme.colors.textSecondary }}>
                Write commands require decodio:write permission.
              </div>
            )}
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Command Response</h3>
            <pre style={preStyle}>{responseText || "No command executed yet"}</pre>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
