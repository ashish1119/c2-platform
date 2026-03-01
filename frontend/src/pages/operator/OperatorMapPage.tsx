import { useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import MapView from "../../components/MapView";
import { getAssets, type AssetRecord } from "../../api/assets";
import { getAlerts, type AlertRecord } from "../../api/alerts";
import {
  getHeatMap,
  getRFSignals,
  getTriangulation,
  type HeatCell,
  type RFSignal,
  type TriangulationResult,
} from "../../api/rf";
import { useTheme } from "../../context/ThemeContext";

const ASSET_TREE_VISIBLE_KEY = "ui.operator.assetTree.visible";
const ASSET_TREE_PINNED_KEY = "ui.operator.assetTree.pinned";

export default function OperatorMapPage() {
  const { theme } = useTheme();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
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
  const [triangulation, setTriangulation] = useState<TriangulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const [assetsRes, alertsRes, signalsRes, heatRes, triangulationRes] = await Promise.all([
          getAssets(),
          getAlerts(),
          getRFSignals(),
          getHeatMap(),
          getTriangulation(),
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

        setAlerts(alertsRes.data);
        setSignals(signalsRes.data);
        setHeatCells(heatRes.data);
        setTriangulation(triangulationRes.data);
      } catch {
        setError("Failed to load map data.");
      } finally {
        setLoading(false);
      }
    };

    load();
    const ws = new WebSocket("ws://localhost:8000/ws/alerts");
    ws.onmessage = () => load();

    const interval = setInterval(load, 15000);
    return () => {
      clearInterval(interval);
      ws.close();
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
    const groupAssetIds = getGroupAssetIds(assetType);
    return groupAssetIds.length > 0 && groupAssetIds.every((assetId) => selectedAssetIds.includes(assetId));
  };

  const groupSummary = (assetType: string) => {
    const groupAssetIds = getGroupAssetIds(assetType);
    const selectedCount = groupAssetIds.filter((assetId) => selectedAssetIds.includes(assetId)).length;
    return `${selectedCount}/${groupAssetIds.length}`;
  };

  return (
    <AppLayout>
      <PageContainer title="Operator Map">
        {loading && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.textSecondary }}>Loading map feeds...</div>}
        {error && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.danger }}>{error}</div>}
        {triangulation?.warning && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.warning }}>{triangulation.warning}</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isTreeVisible ? "minmax(0, 1fr) 420px" : "minmax(0, 1fr) 44px",
            gap: theme.spacing.md,
            alignItems: "start",
          }}
        >
          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
            <MapView
              assets={filteredAssets}
              alerts={alerts}
              signals={signals}
              heatCells={heatCells}
              triangulation={triangulation}
              mapHeight="calc(100dvh - 190px)"
            />
          </div>

          {!isTreeVisible && (
            <div
              onMouseEnter={() => setIsTreeVisible(true)}
              style={{
                width: "44px",
                height: "calc(100dvh - 190px)",
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
                maxHeight: "calc(100dvh - 190px)",
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
                          {groupAssets.map((asset) => (
                            <label key={asset.id} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={selectedAssetIds.includes(asset.id)}
                                onChange={() => toggleAssetId(asset.id, assetType)}
                              />
                              <span>{asset.name}</span>
                            </label>
                          ))}
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
