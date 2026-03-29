import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import { ChevronLeft } from "lucide-react";
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
const DEFAULT_OPERATOR_VISIBLE_TYPES = ["C2_NODE", "DIRECTION_FINDER"];

function normalizeType(assetType: string | null | undefined): string {
  return (assetType ?? "UNKNOWN").toUpperCase();
}

function isOperatorAllowedAssetType(assetType: string | null | undefined): boolean {
  const type = normalizeType(assetType);
  return DEFAULT_OPERATOR_VISIBLE_TYPES.includes(type);
}

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

      const loadedAssets = assetsRes.data.filter((asset) => isOperatorAllowedAssetType(asset.type));
      const allTypes = Array.from(new Set(loadedAssets.map((asset) => normalizeType(asset.type)))).sort();
      const allIds = loadedAssets.map((asset) => asset.id);
      const initialTypes = allTypes;
      const initialIds = allIds;

      setAssets(loadedAssets);
      setSelectedAssetTypes((current) => {
        if (!hasInitializedSelectionsRef.current) {
          return initialTypes;
        }
        return current.filter((t) => allTypes.includes(t));
      });
      setSelectedAssetIds((current) => {
        if (!hasInitializedSelectionsRef.current) {
          return initialIds;
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
    } catch (err: any) {
      if (err?.response?.status === 401) {
        // Interceptor will redirect; suppress the error banner
        return;
      }
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

  const mapAssets = filteredAssets;
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

      {/* STATUS & ALERTS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {loading && (
          <div style={{
            color: "#38bdf8",
            fontSize: 12,
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1.5s infinite' }} />
            SYSTEM: LOADING MAP FEEDS...
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

        {error && (
          <div style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            color: "#ef4444",
            fontSize: 13,
            fontWeight: 600
          }}>
            ERROR_REPORT: {error}
          </div>
        )}

        {/* TOAST */}
        {jammerToast && (
          <div style={{
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            borderLeft: `4px solid ${jammerToast.type === "success" ? "#10b981" : "#ef4444"}`,
            background: "rgba(30, 41, 59, 0.9)",
            color: jammerToast.type === "success" ? "#10b981" : "#f87171",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)"
          }}>
            {jammerToast.message.toUpperCase()}
          </div>
        )}
      </div>

      {/* MAIN GRID */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isTreeVisible ? "1fr 400px" : "1fr 60px",
        gap: 20,
        alignItems: "stretch",
        transition: "grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      }}>

        {/* MAP PANEL */}
        <div style={{
          borderRadius: 16,
          overflow: "hidden",
          minHeight: OPERATOR_MAP_MIN_HEIGHT_PX,
          background: "#0f172a",
          border: `1px solid rgba(56, 189, 248, 0.2)`,
          boxShadow: "0 0 40px rgba(0,0,0,0.3)",
          position: 'relative'
        }}>
          {/* Subtle UI overlay effect for corners */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTop: '2px solid #38bdf8', borderLeft: '2px solid #38bdf8', pointerEvents: 'none', zIndex: 10 }} />
          <MapView
            assets={mapAssets}
            alerts={mapAlerts}
            signals={mapSignals}
            heatCells={mapHeatCells}
            tcpRecentMessages={tcpRecentMessages}
            triangulation={mapTriangulation}
            jammerLifecycleByAssetId={jammerLifecycleByAssetId}
            onJammerToggle={handleJammerToggle}
            jammerActionInProgressId={jammerActionAssetId}
            initialShowAlerts={false}
            initialShowSignals={false}
            mapHeight={OPERATOR_MAP_PANEL_HEIGHT}
          />
        </div>

        {/* COLLAPSED TAB */}
        {!isTreeVisible && (
          <button
            type="button"
            onClick={() => setIsTreeVisible(true)}
            onMouseEnter={() => setIsTreeVisible(true)}
            title="Expand system assets panel"
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              border: `1px solid rgba(56, 189, 248, 0.3)`,
              background: "#ffffff",
              color: "#0f172a",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)",
              transition: "all 0.2s ease",
              padding: 0,
              fontWeight: 700,
              lineHeight: 1,
            }}
            onMouseOver={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "#e2e8f0";
              el.style.borderColor = "rgba(56, 189, 248, 0.5)";
            }}
            onMouseOut={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "#ffffff";
              el.style.borderColor = "rgba(56, 189, 248, 0.3)";
            }}
          >
            <ChevronLeft size={20} strokeWidth={2.2} />
          </button>
        )}

        {/* SIDEBAR */}
        {isTreeVisible && (
          <div
            onMouseLeave={() => !isTreePinned && setIsTreeVisible(false)}
            style={{
              borderRadius: 16,
              padding: 20,
              background: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(12px)",
              border: `1px solid rgba(56, 189, 248, 0.2)`,
              overflowY: "auto",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
              maxHeight: OPERATOR_MAP_PANEL_HEIGHT
            }}
          >

            {/* HEADER */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: 'center',
              marginBottom: 20,
              paddingBottom: 10,
              borderBottom: "1px solid rgba(56, 189, 248, 0.1)"
            }}>
              <strong style={{ fontSize: 16, color: "#f8fafc", letterSpacing: '1px' }}>SYSTEM ASSETS</strong>

              <button
                onClick={() => setIsTreePinned(p => !p)}
                style={{
                  borderRadius: 6,
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  background: isTreePinned ? "#38bdf8" : "transparent",
                  color: isTreePinned ? "#0f172a" : "#38bdf8",
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 'bold',
                  cursor: "pointer",
                  transition: 'all 0.2s'
                }}
              >
                {isTreePinned ? "PINNED" : "PIN"}
              </button>
            </div>

            {/* SHOW ALL */}
            <label style={{ 
              display: "flex", 
              alignItems: 'center', 
              gap: 10, 
              marginBottom: 16, 
              cursor: 'pointer',
              fontSize: 13,
              color: '#94a3b8'
            }}>
              <input
                type="checkbox"
                style={{ accentColor: '#38bdf8', width: 16, height: 16 }}
                checked={showAllAssets}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowAllAssets(checked);
                  checked ? setAllSelections() : (
                    setSelectedAssetTypes([]),
                    setSelectedAssetIds([])
                  );
                }}
              />
              SELECT ALL ASSETS
            </label>

            {/* GROUPS */}
            <div style={{ display: "grid", gap: 12 }}>
              {assetTypeGroups.map(type => {
                const groupAssets = assetsByType.get(type) ?? [];
                const expanded = expandedAssetTypes.includes(type);

                return (
                  <div key={type} style={{
                    borderRadius: 12,
                    border: `1px solid ${expanded ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                    background: expanded ? "rgba(30, 41, 59, 0.5)" : "rgba(30, 41, 59, 0.2)",
                    overflow: 'hidden'
                  }}>

                    {/* GROUP HEADER */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px"
                    }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <button
                          onClick={() => toggleGroupExpanded(type)}
                          style={{
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 4,
                            border: "1px solid rgba(56, 189, 248, 0.4)",
                            background: "transparent",
                            color: "#38bdf8",
                            cursor: "pointer",
                            fontSize: 14
                          }}
                        >
                          {expanded ? "−" : "+"}
                        </button>

                        <label style={{ display: "flex", gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            style={{ accentColor: '#38bdf8' }}
                            checked={isGroupChecked(type)}
                            onChange={() => toggleAssetType(type)}
                          />
                          <span style={{ fontWeight: 600, color: expanded ? "#fff" : "#cbd5e1", fontSize: 13 }}>{type}</span>
                        </label>
                      </div>

                      <span style={{ fontSize: 10, color: "#64748b", fontWeight: 'bold' }}>
                        {groupSummary(type)}
                      </span>
                    </div>

                    {/* ITEMS */}
                    {expanded && (
                      <div style={{
                        padding: "0 12px 12px 40px",
                        display: "grid",
                        gap: 8,
                        borderTop: "1px solid rgba(56, 189, 248, 0.1)",
                        paddingTop: 12
                      }}>
                        {groupAssets.map(asset => {
                          const isJammer = type === "JAMMER";
                          const isJamming =
                            (jammerLifecycleByAssetId[asset.id] ?? "")
                              .toUpperCase() === "JAMMING";

                          const control =
                            jammerTreeControlByAssetId[asset.id] ??
                            DEFAULT_JAMMER_TREE_CONTROL_STATE;

                          return (
                            <div key={asset.id} style={{ paddingBottom: 8 }}>

                              {/* ASSET LABEL */}
                              <label style={{
                                display: "flex",
                                gap: 10,
                                fontSize: 13,
                                color: "#e2e8f0",
                                cursor: 'pointer',
                                alignItems: 'center'
                              }}>
                                <input
                                  type="checkbox"
                                  style={{ accentColor: '#38bdf8' }}
                                  checked={showAllAssets || selectedAssetIds.includes(asset.id)}
                                  onChange={() => toggleAssetId(asset.id, type)}
                                />
                                {asset.name}
                              </label>

                              {/* JAMMER PANEL */}
                              {isJammer && (
                                <div style={{
                                  marginTop: 10,
                                  padding: 12,
                                  borderRadius: 8,
                                  background: "#0f172a",
                                  border: `1px solid ${isJamming ? '#ef4444' : 'rgba(56, 189, 248, 0.2)'}`,
                                  display: "grid",
                                  gap: 10,
                                  boxShadow: isJamming ? "0 0 15px rgba(239, 68, 68, 0.1)" : "none"
                                }}>
                                  <div style={{ 
                                    fontSize: 10, 
                                    color: isJamming ? "#f87171" : "#94a3b8", 
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5
                                  }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isJamming ? "#ef4444" : "#38bdf8" }} />
                                    STATUS: {jammerLifecycleByAssetId[asset.id] || "IDLE"}
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div style={{ display: 'grid', gap: 4 }}>
                                      <span style={{ fontSize: 9, color: '#64748b' }}>MODULE</span>
                                      <select
                                        style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '4px', fontSize: 11 }}
                                        value={control.moduleId}
                                        onChange={e => setJammerTreeControlField(asset.id, "moduleId", e.target.value)}
                                      >
                                        {MODULE_ID_OPTIONS.map(m => <option key={m}>{m}</option>)}
                                      </select>
                                    </div>

                                    <div style={{ display: 'grid', gap: 4 }}>
                                      <span style={{ fontSize: 9, color: '#64748b' }}>GAIN</span>
                                      <select
                                        style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '4px', fontSize: 11 }}
                                        value={control.gain}
                                        onChange={e => setJammerTreeControlField(asset.id, "gain", e.target.value)}
                                      >
                                        {GAIN_OPTIONS.map(g => <option key={g}>{g}</option>)}
                                      </select>
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gap: 4 }}>
                                    <span style={{ fontSize: 9, color: '#64748b' }}>JAMMING CODE</span>
                                    <select
                                      style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '4px', fontSize: 11 }}
                                      value={control.jammingCode}
                                      onChange={e => setJammerTreeControlField(asset.id, "jammingCode", e.target.value)}
                                    >
                                      {JAMMING_CODE_OPTIONS.map(o => (
                                        <option key={o.code} value={o.code}>{o.code} - {o.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ display: 'grid', gap: 4 }}>
                                    <span style={{ fontSize: 9, color: '#64748b' }}>FREQUENCY (MHz)</span>
                                    <input
                                      type="number"
                                      placeholder="0.00"
                                      style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '4px', fontSize: 11 }}
                                      value={control.frequency}
                                      onChange={e => setJammerTreeControlField(asset.id, "frequency", e.target.value)}
                                    />
                                  </div>

                                  <button
                                    onClick={() => {
                                      if (isJamming) {
                                        handleJammerToggle(asset.id, "stop");
                                      } else {
                                        handleJammerToggle(asset.id, "start", {
                                          moduleId: Number(control.moduleId),
                                          jammingCode: Number(control.jammingCode),
                                          gain: Number(control.gain),
                                          frequency: control.frequency ? Number(control.frequency) : undefined
                                        });
                                      }
                                    }}
                                    style={{
                                      borderRadius: 6,
                                      border: "none",
                                      padding: "10px",
                                      background: isJamming 
                                        ? "linear-gradient(to bottom, #ef4444, #991b1b)" 
                                        : "linear-gradient(to bottom, #10b981, #065f46)",
                                      color: "#fff",
                                      fontWeight: "bold",
                                      fontSize: 11,
                                      cursor: "pointer",
                                      textTransform: 'uppercase',
                                      letterSpacing: '1px',
                                      marginTop: 4,
                                      boxShadow: isJamming ? "0 4px 12px rgba(239, 68, 68, 0.2)" : "0 4px 12px rgba(16, 185, 129, 0.2)"
                                    }}
                                  >
                                    {isJamming ? "⚡ TERMINATE JAMMING" : "▶ INITIATE JAMMING"}
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
          </div>
        )}
      </div>
    </PageContainer>
  </AppLayout>
);
}
