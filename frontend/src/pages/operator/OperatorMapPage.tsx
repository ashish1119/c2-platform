import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import MapView, { type JammerControlConfig } from "../../components/MapView";
import {
  getAssets,
  getJammerProfiles,
  updateJammerProfile,
  type AssetRecord,
  type JammerProfileRecord,
} from "../../api/assets";
import { getAlerts, type AlertRecord } from "../../api/alerts";
import {
  getHeatMap,
  getRFSignals,
  type HeatCell,
  type RFSignal,
} from "../../api/rf";
import { getTcpClientStatus, type TcpClientStatus } from "../../api/tcpListener";
import { useTheme } from "../../context/ThemeContext";
import api from "../../api/axios";
import {
  getDashboardSimulationSnapshot,
  isDashboardSimulationActive,
  stopDashboardSimulation,
  subscribeDashboardSimulation,
  type DashboardSimulationSnapshot,
} from "../../features/signal-simulation/state/dashboardSimulationBridge";

const ASSET_TREE_VISIBLE_KEY = "ui.operator.assetTree.visible";
const ASSET_TREE_PINNED_KEY = "ui.operator.assetTree.pinned";
const OPERATOR_MAP_PANEL_HEIGHT = "calc(100vh - 190px)";
const OPERATOR_MAP_MIN_HEIGHT_PX = 420;
const TCP_STATUS_REFRESH_MS = 2000;

const MODULE_ID_OPTIONS = ["1", "2", "3", "4"];
const GAIN_OPTIONS = Array.from({ length: 35 }, (_, index) => String(index + 1));
const JAMMING_CODE_OPTIONS: Array<{ code: number; name: string }> = [
  { code: 0, name: "CW" },
  { code: 1, name: "TBS_868" },
  { code: 2, name: "TBS_915" },
  { code: 3, name: "TBS_868+915" },
  { code: 4, name: "ELRS_868" },
  { code: 5, name: "ELRS_915" },
  { code: 6, name: "ELRS_2450_A" },
  { code: 7, name: "ELRS_868+915" },
  { code: 8, name: "TBS+ELRS_A" },
  { code: 9, name: "GNSS_70M" },
  { code: 10, name: "OFDM_5M" },
  { code: 11, name: "OFDM_10M" },
  { code: 12, name: "OFDM_20M" },
  { code: 13, name: "OFDM_70M" },
  { code: 14, name: "OFDM_100M" },
  { code: 15, name: "OFDM_150M" },
  { code: 16, name: "OFDM_140M" },
  { code: 17, name: "OFDM_200M" },
  { code: 18, name: "LFM_5M" },
  { code: 19, name: "LFM_10M" },
];

type JammerTreeControlState = {
  moduleId: string;
  jammingCode: string;
  frequency: string;
  gain: string;
};

const DEFAULT_JAMMER_TREE_CONTROL_STATE: JammerTreeControlState = {
  moduleId: "1",
  jammingCode: "0",
  frequency: "",
  gain: "35",
};

function buildJammerApiTarget(ipAddress: string, port: number): string {
  const host = ipAddress.trim();
  if (!host) {
    throw new Error("Jammer API IP is missing in jammer profile.");
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Jammer API port is invalid in jammer profile.");
  }

  return `${host}:${port}`;
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as
      | { detail?: string; message?: string }
      | string
      | undefined;

    if (typeof payload === "string" && payload.trim()) {
      return payload;
    }

    if (payload && typeof payload === "object") {
      if (typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail;
      }
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

const resolveAlertsWsUrl = () => {
  if (typeof window === "undefined") {
    return "ws://localhost:8000/ws/alerts";
  }
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${window.location.hostname}:8000/ws/alerts`;
};

export default function OperatorMapPage() {
  const { theme } = useTheme();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [jammerProfiles, setJammerProfiles] = useState<JammerProfileRecord[]>([]);
  const [jammerActionAssetId, setJammerActionAssetId] = useState<string | null>(null);
  const [jammerToast, setJammerToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [jammerTreeControlByAssetId, setJammerTreeControlByAssetId] = useState<Record<string, JammerTreeControlState>>({});
  const [showAllAssets, setShowAllAssets] = useState(true);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [expandedAssetTypes, setExpandedAssetTypes] = useState<string[]>([]);
  const [isTreeVisible, setIsTreeVisible] = useState<boolean>(() => {
    const stored = localStorage.getItem(ASSET_TREE_VISIBLE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [isTreePinned, setIsTreePinned] = useState<boolean>(() => {
    const stored = localStorage.getItem(ASSET_TREE_PINNED_KEY);
    return stored === "true";
  });
  const hasInitializedSelectionsRef = useRef(false);
  const hasInitializedExpandedRef = useRef(false);

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [signals, setSignals] = useState<RFSignal[]>([]);
  const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
  const [tcpRecentMessages, setTcpRecentMessages] = useState<TcpClientStatus["recent_messages"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulationSnapshot, setSimulationSnapshot] = useState<DashboardSimulationSnapshot | null>(null);

  const refreshTcpStatus = useCallback(async () => {
    try {
      const tcpStatusRes = await getTcpClientStatus();
      setTcpRecentMessages(tcpStatusRes.data.recent_messages ?? []);
    } catch {
      // Keep last known TCP frames on transient read failures.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [assetsRes, jammerProfilesRes, alertsRes, signalsRes, heatRes, tcpStatusRes] = await Promise.all([
        getAssets(),
        getJammerProfiles(),
        getAlerts(),
        getRFSignals(),
        getHeatMap(),
        getTcpClientStatus().catch(() => null),
      ]);

      const loadedAssets = assetsRes.data;
      const allTypes = Array.from(new Set(loadedAssets.map((asset) => (asset.type ?? "UNKNOWN").toUpperCase()))).sort();
      const allIds = loadedAssets.map((asset) => asset.id);

      setAssets(loadedAssets);
      setSelectedAssetTypes((current) => {
        if (!hasInitializedSelectionsRef.current) {
          return allTypes;
        }
        return current.filter((t) => allTypes.includes(t));
      });
      setSelectedAssetIds((current) => {
        if (!hasInitializedSelectionsRef.current) {
          return allIds;
        }
        return current.filter((id) => allIds.includes(id));
      });
      if (!hasInitializedSelectionsRef.current) {
        hasInitializedSelectionsRef.current = true;
      }

      setJammerProfiles(jammerProfilesRes.data);
      setAlerts(alertsRes.data);
      setSignals(signalsRes.data);
      setHeatCells(heatRes.data);
      setTcpRecentMessages(tcpStatusRes?.data?.recent_messages ?? []);
    } catch {
      setError("Failed to load map data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const ws = new WebSocket(resolveAlertsWsUrl());
    ws.onmessage = () => load();

    const interval = setInterval(load, 15000);
    const tcpInterval = setInterval(() => {
      refreshTcpStatus();
    }, TCP_STATUS_REFRESH_MS);
    return () => {
      clearInterval(interval);
      clearInterval(tcpInterval);
      ws.close();
    };
  }, [load, refreshTcpStatus]);

  useEffect(() => {
    const unsubscribe = subscribeDashboardSimulation((snapshot) => {
      if (!snapshot) {
        setSimulationMode(false);
        setSimulationSnapshot(null);
        return;
      }

      setSimulationMode(true);
      setSimulationSnapshot(snapshot);
    });

    if (isDashboardSimulationActive()) {
      const snapshot = getDashboardSimulationSnapshot();
      if (snapshot) {
        setSimulationMode(true);
        setSimulationSnapshot(snapshot);
      }
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const assetTypeGroups = useMemo(
    () => Array.from(new Set(assets.map((asset) => (asset.type ?? "UNKNOWN").toUpperCase()))).sort(),
    [assets]
  );

  useEffect(() => {
    setExpandedAssetTypes((current) => {
      if (!hasInitializedExpandedRef.current) {
        hasInitializedExpandedRef.current = true;
        return assetTypeGroups;
      }

      if (current.length === 0) {
        return current;
      }

      const retained = current.filter((type) => assetTypeGroups.includes(type));
      return retained;
    });
  }, [assetTypeGroups]);

  useEffect(() => {
    localStorage.setItem(ASSET_TREE_VISIBLE_KEY, String(isTreeVisible));
  }, [isTreeVisible]);

  useEffect(() => {
    localStorage.setItem(ASSET_TREE_PINNED_KEY, String(isTreePinned));
  }, [isTreePinned]);

  const assetsByType = useMemo(() => {
    const grouped = new Map<string, AssetRecord[]>();
    for (const asset of assets) {
      const typeKey = (asset.type ?? "UNKNOWN").toUpperCase();
      const existing = grouped.get(typeKey) ?? [];
      existing.push(asset);
      grouped.set(typeKey, existing);
    }
    for (const [typeKey, groupAssets] of grouped.entries()) {
      grouped.set(typeKey, [...groupAssets].sort((a, b) => a.name.localeCompare(b.name)));
    }
    return grouped;
  }, [assets]);

  useEffect(() => {
    if (!showAllAssets) {
      return;
    }

    const allAssetIds = assets.map((asset) => asset.id);

    setSelectedAssetTypes((current) => {
      if (current.length === assetTypeGroups.length && current.every((type, index) => type === assetTypeGroups[index])) {
        return current;
      }
      return assetTypeGroups;
    });

    setSelectedAssetIds((current) => {
      if (current.length === allAssetIds.length && current.every((assetId, index) => assetId === allAssetIds[index])) {
        return current;
      }
      return allAssetIds;
    });
  }, [assets, assetTypeGroups, showAllAssets]);

  const filteredAssets = useMemo(() => {
    if (showAllAssets) {
      return assets;
    }

    const allowedTypes = new Set(selectedAssetTypes);
    const allowedIds = new Set(selectedAssetIds);
    return assets.filter((asset) => {
      const typeKey = (asset.type ?? "UNKNOWN").toUpperCase();
      return allowedTypes.has(typeKey) && allowedIds.has(asset.id);
    });
  }, [assets, selectedAssetIds, selectedAssetTypes, showAllAssets]);

  const mapAssets = simulationMode ? simulationSnapshot?.directionFinderAssets ?? [] : filteredAssets;
  const mapAlerts = simulationMode ? simulationSnapshot?.alerts ?? [] : alerts;
  const mapSignals = simulationMode ? simulationSnapshot?.signals ?? [] : signals;
  const mapHeatCells = simulationMode ? simulationSnapshot?.heatCells ?? [] : heatCells;
  const mapTriangulation = simulationMode ? simulationSnapshot?.triangulation ?? null : null;

  const jammerProfileByAssetId = useMemo(
    () =>
      jammerProfiles.reduce((acc, profile) => {
        acc[profile.asset_id] = profile;
        return acc;
      }, {} as Record<string, JammerProfileRecord>),
    [jammerProfiles]
  );

  const jammerLifecycleByAssetId = useMemo(
    () =>
      jammerProfiles.reduce((acc, profile) => {
        acc[profile.asset_id] = profile.lifecycle_state ?? "ACTIVE_SERVICE";
        return acc;
      }, {} as Record<string, string>),
    [jammerProfiles]
  );

  const handleJammerToggle = useCallback(
    async (assetId: string, nextAction: "start" | "stop", config?: JammerControlConfig) => {
      const profile = jammerProfileByAssetId[assetId];
      const jammerName = assets.find((asset) => asset.id === assetId)?.name ?? "Jammer";
      if (!profile) {
        setError("Jammer profile not found for selected asset.");
        setJammerToast({ type: "error", message: "Jammer profile not found for selected asset." });
        return;
      }

      if (nextAction === "start" && !config) {
        setError("Jammer configuration is required before starting.");
        setJammerToast({ type: "error", message: "Select module, code, frequency and gain before starting jammer." });
        return;
      }

      try {
        setError(null);
        setJammerActionAssetId(assetId);

        const apiTarget = buildJammerApiTarget(profile.ip_address, profile.port);

        if (nextAction === "start") {
          const moduleId = Number(config?.moduleId);
          const jammingCode = Number(config?.jammingCode);
          const gain = Number(config?.gain);

          if (!Number.isInteger(moduleId) || moduleId < 1 || moduleId > 4) {
            throw new Error("Module ID must be between 1 and 4.");
          }

          if (!Number.isInteger(jammingCode) || jammingCode < 0 || jammingCode > 19) {
            throw new Error("Jamming code must be between 0 and 19.");
          }

          if (!Number.isInteger(gain) || gain < 1 || gain > 35) {
            throw new Error("Gain must be between 1 and 35.");
          }

          const configurePayload: Record<string, number> = {
            moduleId,
            jammingCode,
            ch1Gain: gain,
            ch2Gain: gain,
          };

          if (typeof config?.frequency === "number" && Number.isFinite(config.frequency)) {
            configurePayload.frequency = config.frequency;
          }

          await api.post("/jammer-control/configure", configurePayload, {
            params: {
              api_target: apiTarget,
            },
          });

          await api.post(
            "/jammer-control/jamming/start",
            { moduleId },
            {
              params: {
                api_target: apiTarget,
              },
            }
          );
        } else {
          await api.post(
            "/jammer-control/jamming/stop",
            {},
            {
              params: {
                api_target: apiTarget,
              },
            }
          );
        }

        await updateJammerProfile(profile.id, {
          lifecycle_state: nextAction === "start" ? "JAMMING" : "ACTIVE_SERVICE",
        });
        await load();
        setJammerToast({
          type: "success",
          message:
            nextAction === "start"
              ? `Started jamming for ${jammerName}.`
              : `Stopped jamming for ${jammerName}.`,
        });
      } catch (err: unknown) {
        const details = extractApiErrorMessage(err, `Failed to ${nextAction === "start" ? "start" : "stop"} jamming.`);
        setError(details);
        setJammerToast({
          type: "error",
          message: `Failed to ${nextAction === "start" ? "start" : "stop"} jamming for ${jammerName}. ${details}`,
        });
      } finally {
        setJammerActionAssetId(null);
      }
    },
    [assets, jammerProfileByAssetId, load]
  );

  const setJammerTreeControlField = useCallback(
    (assetId: string, field: keyof JammerTreeControlState, value: string) => {
      setJammerTreeControlByAssetId((current) => ({
        ...current,
        [assetId]: {
          ...(current[assetId] ?? DEFAULT_JAMMER_TREE_CONTROL_STATE),
          [field]: value,
        },
      }));
    },
    []
  );

  useEffect(() => {
    if (!jammerToast) {
      return;
    }

    const timer = setTimeout(() => {
      setJammerToast(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [jammerToast]);

  const setAllSelections = () => {
    setSelectedAssetTypes(assetTypeGroups);
    setSelectedAssetIds(assets.map((asset) => asset.id));
  };

  const getGroupAssetIds = (assetType: string) => (assetsByType.get(assetType) ?? []).map((asset) => asset.id);

  const toggleAssetType = (assetType: string) => {
    setShowAllAssets(false);
    const groupAssetIds = getGroupAssetIds(assetType);

    setSelectedAssetTypes((current) => {
      const isSelected = current.includes(assetType);
      const nextTypes = isSelected ? current.filter((type) => type !== assetType) : [...current, assetType];

      setSelectedAssetIds((existing) => {
        if (isSelected) {
          return existing.filter((assetId) => !groupAssetIds.includes(assetId));
        }
        return Array.from(new Set([...existing, ...groupAssetIds]));
      });

      return nextTypes;
    });
  };

  const toggleAssetId = (assetId: string, assetType: string) => {
    setShowAllAssets(false);

    setSelectedAssetIds((current) => {
      const nextIds = current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId];

      const groupAssetIds = getGroupAssetIds(assetType);
      const selectedInGroup = nextIds.filter((id) => groupAssetIds.includes(id)).length;

      setSelectedAssetTypes((existingTypes) => {
        if (selectedInGroup > 0) {
          return existingTypes.includes(assetType) ? existingTypes : [...existingTypes, assetType];
        }
        return existingTypes.filter((type) => type !== assetType);
      });

      return nextIds;
    });
  };

  const toggleGroupExpanded = (assetType: string) => {
    setExpandedAssetTypes((current) =>
      current.includes(assetType)
        ? current.filter((type) => type !== assetType)
        : [...current, assetType]
    );
  };

  const isGroupChecked = (assetType: string) => {
    if (showAllAssets) {
      return true;
    }

    const groupAssetIds = getGroupAssetIds(assetType);
    return groupAssetIds.length > 0 && groupAssetIds.every((assetId) => selectedAssetIds.includes(assetId));
  };

  const groupSummary = (assetType: string) => {
    const groupAssetIds = getGroupAssetIds(assetType);
    if (showAllAssets) {
      return `${groupAssetIds.length}/${groupAssetIds.length}`;
    }

    const selectedCount = groupAssetIds.filter((assetId) => selectedAssetIds.includes(assetId)).length;
    return `${selectedCount}/${groupAssetIds.length}`;
  };

  return (
    <AppLayout>
      <PageContainer title="Operator Map">
        {loading && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.textSecondary }}>Loading map feeds...</div>}
        {error && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.danger }}>{error}</div>}
        {jammerToast && (
          <div
            style={{
              marginBottom: theme.spacing.md,
              color: jammerToast.type === "success" ? theme.colors.success : theme.colors.danger,
              background: theme.colors.surfaceAlt,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            }}
          >
            {jammerToast.message}
          </div>
        )}
        {simulationMode && (
          <div
            style={{
              marginBottom: theme.spacing.md,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: theme.spacing.md,
              color: theme.colors.warning,
              background: theme.colors.surfaceAlt,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            }}
          >
            <span>Simulation feed active on operator map. Rendering DF sensors, rays, centroid, and uncertainty layers.</span>
            <button
              type="button"
              onClick={() => {
                stopDashboardSimulation();
                setSimulationMode(false);
                setSimulationSnapshot(null);
              }}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                background: theme.colors.surface,
                color: theme.colors.textPrimary,
                cursor: "pointer",
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              }}
            >
              Stop Simulation
            </button>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isTreeVisible ? "minmax(0, 1fr) 420px" : "minmax(0, 1fr) 44px",
            gap: theme.spacing.md,
            alignItems: "start",
          }}
        >
          <div
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              overflow: "hidden",
              minHeight: OPERATOR_MAP_MIN_HEIGHT_PX,
            }}
          >
            <MapView
              assets={mapAssets}
              alerts={mapAlerts}
              signals={mapSignals}
              heatCells={mapHeatCells}
              triangulation={mapTriangulation}
              tcpRecentMessages={tcpRecentMessages}
              jammerLifecycleByAssetId={jammerLifecycleByAssetId}
              onJammerToggle={handleJammerToggle}
              jammerActionInProgressId={jammerActionAssetId}
              mapHeight={OPERATOR_MAP_PANEL_HEIGHT}
            />
          </div>

          {!isTreeVisible && (
            <div
              onMouseEnter={() => setIsTreeVisible(true)}
              style={{
                width: "44px",
                height: OPERATOR_MAP_PANEL_HEIGHT,
                minHeight: OPERATOR_MAP_MIN_HEIGHT_PX,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surfaceAlt,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Show filters"
            >
              <button
                type="button"
                onClick={() => setIsTreeVisible(true)}
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                  cursor: "pointer",
                  width: 28,
                  height: 28,
                  lineHeight: 1,
                }}
                aria-label="Show asset tree"
              >
                »
              </button>
            </div>
          )}

          {isTreeVisible && (
            <div
              onMouseLeave={() => {
                if (!isTreePinned) {
                  setIsTreeVisible(false);
                }
              }}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                background: theme.colors.surfaceAlt,
                maxHeight: OPERATOR_MAP_PANEL_HEIGHT,
                minHeight: OPERATOR_MAP_MIN_HEIGHT_PX,
                overflowY: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: theme.spacing.sm }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsTreePinned((current) => {
                      const next = !current;
                      if (!next) {
                        setIsTreeVisible(false);
                      }
                      return next;
                    });
                  }}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.md,
                    background: theme.colors.surface,
                    color: theme.colors.textPrimary,
                    cursor: "pointer",
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  }}
                >
                  {isTreePinned ? "Unpin" : "Pin"}
                </button>
              </div>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: theme.spacing.sm }}>
                <input
                  type="checkbox"
                  checked={showAllAssets}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setShowAllAssets(checked);
                    if (checked) {
                      setAllSelections();
                    } else {
                      setSelectedAssetTypes([]);
                      setSelectedAssetIds([]);
                    }
                  }}
                />
                Show all assets
              </label>

              <div style={{ display: "grid", gap: 12 }}>
                {assetTypeGroups.map((assetType) => {
                  const groupAssets = assetsByType.get(assetType) ?? [];
                  const expanded = expandedAssetTypes.includes(assetType);

                  return (
                    <div
                      key={assetType}
                      style={{
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.md,
                        padding: theme.spacing.sm,
                        background: theme.colors.surface,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => toggleGroupExpanded(assetType)}
                            style={{
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: theme.radius.sm,
                              background: theme.colors.surfaceAlt,
                              color: theme.colors.textPrimary,
                              cursor: "pointer",
                              width: 24,
                              height: 24,
                              lineHeight: 1,
                            }}
                            aria-label={expanded ? `Collapse ${assetType}` : `Expand ${assetType}`}
                          >
                            {expanded ? "−" : "+"}
                          </button>

                          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                            <input
                              type="checkbox"
                              checked={isGroupChecked(assetType)}
                              onChange={() => toggleAssetType(assetType)}
                            />
                            <span>{assetType}</span>
                          </label>
                        </div>

                        <span style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{groupSummary(assetType)}</span>
                      </div>

                      {expanded && (
                        <div style={{ paddingLeft: 18, display: "grid", gap: 4 }}>
                          {groupAssets.map((asset) => {
                            const isJammerAsset = assetType === "JAMMER";
                            const jammerState = jammerLifecycleByAssetId[asset.id] ?? "ACTIVE_SERVICE";
                            const isJamming = jammerState.toUpperCase() === "JAMMING";
                            const actionPending = jammerActionAssetId === asset.id;
                            const hasJammerProfile = Boolean(jammerProfileByAssetId[asset.id]);
                            const jammerTreeControl =
                              jammerTreeControlByAssetId[asset.id] ?? DEFAULT_JAMMER_TREE_CONTROL_STATE;

                            return (
                              <div key={asset.id} style={{ display: "grid", gap: 6 }}>
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                  <input
                                    type="checkbox"
                                    checked={showAllAssets || selectedAssetIds.includes(asset.id)}
                                    onChange={() => toggleAssetId(asset.id, assetType)}
                                  />
                                  <span>{asset.name}</span>
                                </label>

                                {isJammerAsset && (
                                  <div
                                    style={{
                                      marginLeft: 24,
                                      border: `1px solid ${theme.colors.border}`,
                                      borderRadius: theme.radius.sm,
                                      background: theme.colors.surfaceAlt,
                                      padding: theme.spacing.xs,
                                      display: "grid",
                                      gap: theme.spacing.xs,
                                    }}
                                  >
                                    <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                      Jammer State: {jammerState}
                                    </div>

                                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                                      Module
                                      <select
                                        value={jammerTreeControl.moduleId}
                                        onChange={(event) =>
                                          setJammerTreeControlField(asset.id, "moduleId", event.target.value)
                                        }
                                        disabled={actionPending || !hasJammerProfile}
                                      >
                                        {MODULE_ID_OPTIONS.map((moduleId) => (
                                          <option key={moduleId} value={moduleId}>
                                            {moduleId}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                                      Code
                                      <select
                                        value={jammerTreeControl.jammingCode}
                                        onChange={(event) =>
                                          setJammerTreeControlField(asset.id, "jammingCode", event.target.value)
                                        }
                                        disabled={actionPending || !hasJammerProfile}
                                      >
                                        {JAMMING_CODE_OPTIONS.map((option) => (
                                          <option key={option.code} value={String(option.code)}>
                                            {option.code} - {option.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                                      Frequency (MHz)
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={jammerTreeControl.frequency}
                                        onChange={(event) =>
                                          setJammerTreeControlField(asset.id, "frequency", event.target.value)
                                        }
                                        disabled={actionPending || !hasJammerProfile}
                                        placeholder="optional"
                                      />
                                    </label>

                                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                                      Gain
                                      <select
                                        value={jammerTreeControl.gain}
                                        onChange={(event) =>
                                          setJammerTreeControlField(asset.id, "gain", event.target.value)
                                        }
                                        disabled={actionPending || !hasJammerProfile}
                                      >
                                        {GAIN_OPTIONS.map((gain) => (
                                          <option key={gain} value={gain}>
                                            {gain}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    {!hasJammerProfile && (
                                      <div style={{ fontSize: 12, color: theme.colors.danger }}>
                                        Jammer profile not found.
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      disabled={actionPending || !hasJammerProfile}
                                      onClick={() => {
                                        if (isJamming) {
                                          handleJammerToggle(asset.id, "stop");
                                          return;
                                        }

                                        const parsedFrequency = jammerTreeControl.frequency.trim()
                                          ? Number(jammerTreeControl.frequency)
                                          : undefined;

                                        handleJammerToggle(asset.id, "start", {
                                          moduleId: Number(jammerTreeControl.moduleId),
                                          jammingCode: Number(jammerTreeControl.jammingCode),
                                          frequency:
                                            typeof parsedFrequency === "number" && Number.isFinite(parsedFrequency)
                                              ? parsedFrequency
                                              : undefined,
                                          gain: Number(jammerTreeControl.gain),
                                        });
                                      }}
                                      style={{
                                        border: "none",
                                        borderRadius: theme.radius.md,
                                        background: isJamming ? theme.colors.danger : theme.colors.success,
                                        color: "#fff",
                                        cursor: actionPending || !hasJammerProfile ? "not-allowed" : "pointer",
                                        opacity: actionPending || !hasJammerProfile ? 0.7 : 1,
                                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                      }}
                                    >
                                      {actionPending ? "Processing..." : isJamming ? "Stop Jamming" : "Start Jamming"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedAssetIds.length === 0 && (
                <div style={{ marginTop: theme.spacing.sm, color: theme.colors.textSecondary }}>
                  No asset selected. Choose one or more nodes in the tree to display on map.
                </div>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
