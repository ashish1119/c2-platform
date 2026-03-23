import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, Polygon, Polyline, ScaleControl, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import type { AssetRecord } from "../api/assets";
import type { AlertRecord } from "../api/alerts";
import type { HeatCell, RFSignal, TriangulationResult } from "../api/rf";
import type { TcpClientStatus } from "../api/tcpListener";
import type { CoveragePoint } from "../api/planning";
import { useTheme } from "../context/ThemeContext";
import {
  ASSET_TYPE_ORDER,
  ASSET_TYPE_SETTINGS,
  BASE_MAP_OPTIONS,
  DEFAULT_DF_RANGE_COLOR,
  DEFAULT_JAMMER_POPUP_ALPHA,
  DEFAULT_JAMMER_POPUP_CONTROL_STATE,
  DEFAULT_JAMMER_RANGE_COLOR,
  DF_RANGE_COLOR_KEY,
  DRAW_SHAPES_STORAGE_KEY,
  GAIN_OPTIONS,
  JAMMER_POPUP_ALPHA_KEY,
  JAMMER_RANGE_COLOR_KEY,
  JAMMER_RANGE_SPOKE_COUNT,
  JAMMER_SIGNAL_RING_COUNT,
  MAP_NODE_LABELS_VISIBLE_KEY,
  MAP_SAVED_VIEW_KEY,
  MAX_JAMMER_POPUP_ALPHA,
  MIN_JAMMER_POPUP_ALPHA,
  MODULE_ID_OPTIONS,
  TCP_DF_LINE_DISTANCE_METERS,
  type AssetTypeSettings,
  type BaseMapOption,
  type DrawShapeType,
  type JammerPopupControlState,
  type PersistedDrawShape,
  type SavedMapView,
  JAMMING_CODE_OPTIONS,
  DELHI_CENTER,
} from "./mapViewConfig";
import {
  buildAssetIcon,
  buildPointDetails,
  destinationPointFromBearing,
  extractTcpBearing,
  getAssetCircleRadiusMeters,
  getAssetTypeSettings,
  getBearingDegrees,
  getHeatCellColor,
  getTriangulationColor,
  isJammerAssetType,
  toQuadKey,
} from "./mapViewUtils";
import MapOverlaysPanel from "./MapOverlaysPanel";

type Props = {
  assets?: AssetRecord[];
  alerts?: AlertRecord[];
  signals?: RFSignal[];
  tcpRecentMessages?: TcpClientStatus["recent_messages"];
  heatCells?: HeatCell[];
  coveragePoints?: CoveragePoint[];
  triangulation?: TriangulationResult | null;
  assetConnectionMode?: "none" | "mesh";
  mapHeight?: string;
  showOnlyDirectionFinders?: boolean;
  jammerLifecycleByAssetId?: Record<string, string>;
  jammerActionInProgressId?: string | null;
  onJammerToggle?: (assetId: string, nextAction: "start" | "stop", config?: JammerControlConfig) => void;
};

export type JammerControlConfig = {
  moduleId: number;
  jammingCode: number;
  frequency?: number;
  gain: number;
};

function MapCenterController({
  center,
  onZoomChange,
  shouldFollowCenter,
}: {
  center: [number, number];
  onZoomChange: (zoom: number) => void;
  shouldFollowCenter: boolean;
}) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    if (!shouldFollowCenter) {
      return;
    }
    map.setView(center, map.getZoom());
  }, [center[0], center[1], map, shouldFollowCenter]);

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function MousePositionTracker({
  onPositionChange,
}: {
  onPositionChange: (position: [number, number] | null) => void;
}) {
  useMapEvents({
    mousemove: (event) => {
      onPositionChange([event.latlng.lat, event.latlng.lng]);
    },
    mouseout: () => {
      onPositionChange(null);
    },
  });

  return null;
}

function MapViewportTracker({
  onViewChange,
}: {
  onViewChange: (view: SavedMapView) => void;
}) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
    },
    zoomend: () => {
      const center = map.getCenter();
      onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
    },
  });

  useEffect(() => {
    const center = map.getCenter();
    onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
  }, [map, onViewChange]);

  return null;
}

function AttributionPrefixController() {
  const map = useMap();

  useEffect(() => {
    map.attributionControl.setPrefix(false);
  }, [map]);

  return null;
}


function BingTileLayer({
  option,
  url,
  className,
  onTileError,
  onTileLoad,
}: {
  option: BaseMapOption;
  url: string;
  className?: string;
  onTileError: () => void;
  onTileLoad: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    const BingLayerCtor = (L.TileLayer as any).extend({
      getTileUrl(this: any, coords: { x: number; y: number }) {
        const z = this._getZoomForUrl();
        const data = {
          s: this._getSubdomain(coords),
          x: coords.x,
          y: coords.y,
          z,
          quadkey: toQuadKey(coords.x, coords.y, z),
          r: L.Browser.retina ? "@2x" : "",
        };
        return L.Util.template(this._url, data);
      },
    });

    const layer: L.TileLayer = new BingLayerCtor(url, {
      attribution: option.attribution,
      subdomains: option.subdomains,
      maxZoom: option.maxZoom,
      className,
    });

    layer.on("tileerror", onTileError);
    layer.on("tileload", onTileLoad);
    layer.addTo(map);

    return () => {
      layer.off("tileerror", onTileError);
      layer.off("tileload", onTileLoad);
      map.removeLayer(layer);
    };
  }, [map, option.attribution, option.maxZoom, option.subdomains, url, className, onTileError, onTileLoad]);

  return null;
}

function DrawMeasureControl({
  polygonColor,
  polylineColor,
  circleColor,
  showNodeLabels,
  onActiveShapeChange,
}: {
  polygonColor: string;
  polylineColor: string;
  circleColor: string;
  showNodeLabels: boolean;
  onActiveShapeChange: (shape: DrawShapeType | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const editableLayers = new L.FeatureGroup();
    const shapeNodeLayerGroups = new Map<number, L.LayerGroup>();
    map.addLayer(editableLayers);

    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: true,
          showArea: true,
          shapeOptions: {
            color: polygonColor,
            weight: 2,
          },
        },
        polyline: {
          metric: true,
          shapeOptions: {
            color: polylineColor,
            weight: 3,
          },
        },
        rectangle: false,
        circle: {
          shapeOptions: {
            color: circleColor,
            weight: 2,
          },
          showRadius: true,
          metric: true,
        },
        marker: {
          repeatMode: false,
        },
        circlemarker: false,
      },
      edit: {
        featureGroup: editableLayers,
        remove: true,
      },
    });

    map.addControl(drawControl);

    const onDrawStart: L.LeafletEventHandlerFn = (event) => {
      const layerType = (event as L.DrawEvents.DrawStart).layerType;
      if (layerType === "polygon" || layerType === "polyline" || layerType === "circle") {
        onActiveShapeChange(layerType);
      } else {
        onActiveShapeChange(null);
      }
    };

    const onDrawStop: L.LeafletEventHandlerFn = () => {
      onActiveShapeChange(null);
    };

    map.on(L.Draw.Event.DRAWSTART, onDrawStart);
    map.on(L.Draw.Event.DRAWSTOP, onDrawStop);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") {
        return;
      }

      const drawToolbar = (drawControl as any)._toolbars?.draw;
      const polygonHandler = drawToolbar?._modes?.polygon?.handler;
      const polylineHandler = drawToolbar?._modes?.polyline?.handler;

      if (polygonHandler?.enabled?.() && (polygonHandler._markers?.length ?? 0) >= 4) {
        polygonHandler.completeShape();
        return;
      }

      if (polylineHandler?.enabled?.() && (polylineHandler._markers?.length ?? 0) >= 2) {
        polylineHandler.completeShape();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const renderLineNodeDetails = (lineLayer: L.Polyline) => {
      const ownerId = L.Util.stamp(lineLayer);
      const existing = shapeNodeLayerGroups.get(ownerId);
      if (existing) {
        map.removeLayer(existing);
        shapeNodeLayerGroups.delete(ownerId);
      }

      const latLngs = lineLayer.getLatLngs() as L.LatLng[];
      if (!Array.isArray(latLngs) || latLngs.length === 0) {
        return;
      }

      const layerColor = String(lineLayer.options.color ?? polylineColor);
      const labelsGroup = L.layerGroup();
      let cumulativeMeters = 0;

      for (let index = 0; index < latLngs.length; index += 1) {
        const point = latLngs[index];
        const previousPoint = index > 0 ? latLngs[index - 1] : null;
        const nextPoint = index < latLngs.length - 1 ? latLngs[index + 1] : null;

        if (previousPoint) {
          cumulativeMeters += previousPoint.distanceTo(point);
        }

        const segmentMeters = previousPoint ? previousPoint.distanceTo(point) : 0;
        const angleText = nextPoint ? `${getBearingDegrees(point, nextPoint).toFixed(1)} deg` : "-";
        const labelText = `P${index + 1}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} | ${(segmentMeters / 1000).toFixed(3)} km | ${angleText}`;

        const nodeLayer = L.circleMarker(point, {
          radius: 4,
          color: layerColor,
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 1,
          interactive: false,
        });

        nodeLayer.bindTooltip(labelText, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          opacity: 0.95,
        });

        labelsGroup.addLayer(nodeLayer);
      }

      if (showNodeLabels) {
        labelsGroup.addTo(map);
      }
      shapeNodeLayerGroups.set(ownerId, labelsGroup);
    };

    const renderPolygonNodeDetails = (polygonLayer: L.Polygon) => {
      const ownerId = L.Util.stamp(polygonLayer);
      const existing = shapeNodeLayerGroups.get(ownerId);
      if (existing) {
        map.removeLayer(existing);
        shapeNodeLayerGroups.delete(ownerId);
      }

      const latLngs = (polygonLayer.getLatLngs()[0] ?? []) as L.LatLng[];
      if (!Array.isArray(latLngs) || latLngs.length < 3) {
        return;
      }

      const layerColor = String(polygonLayer.options.color ?? polygonColor);
      const labelsGroup = L.layerGroup();

      for (let index = 0; index < latLngs.length; index += 1) {
        const point = latLngs[index];
        const previousPoint = index > 0 ? latLngs[index - 1] : latLngs[latLngs.length - 1];
        const nextPoint = index < latLngs.length - 1 ? latLngs[index + 1] : latLngs[0];

        const segmentMeters = previousPoint.distanceTo(point);
        const angleText = `${getBearingDegrees(point, nextPoint).toFixed(1)} deg`;
        const labelText = `P${index + 1}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} | ${(segmentMeters / 1000).toFixed(3)} km | ${angleText}`;

        const nodeLayer = L.circleMarker(point, {
          radius: 4,
          color: layerColor,
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 1,
          interactive: false,
        });

        nodeLayer.bindTooltip(labelText, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          opacity: 0.95,
        });

        labelsGroup.addLayer(nodeLayer);
      }

      if (showNodeLabels) {
        labelsGroup.addTo(map);
      }
      shapeNodeLayerGroups.set(ownerId, labelsGroup);
    };

    const bindPolylinePopup = (polylineLayer: L.Polyline) => {
      const latLngs = polylineLayer.getLatLngs() as L.LatLng[];
      const distanceMeters = latLngs.slice(1).reduce((total, point, index) => {
        return total + point.distanceTo(latLngs[index]);
      }, 0);
      const distanceKm = (distanceMeters / 1000).toFixed(3);
      polylineLayer.bindPopup(`Distance: ${distanceKm} km`);
    };

    const bindPolygonPopup = (polygonLayer: L.Polygon) => {
      const polygonLatLngs = polygonLayer.getLatLngs()[0] as L.LatLng[];
      const areaSqM = L.GeometryUtil.geodesicArea(polygonLatLngs);
      const areaSqKm = (areaSqM / 1_000_000).toFixed(3);
      polygonLayer.bindPopup(`Area: ${areaSqKm} km^2`);
    };

    const bindCirclePopup = (circleLayer: L.Circle) => {
      const radiusM = circleLayer.getRadius();
      const radiusKm = (radiusM / 1000).toFixed(3);
      const areaSqKm = (Math.PI * radiusM * radiusM / 1_000_000).toFixed(3);
      circleLayer.bindPopup(`Radius: ${radiusKm} km | Area: ${areaSqKm} km^2`);
    };

    const bindMarkerPopup = (markerLayer: L.Marker, bookmarkText: string, createdAt: string) => {
      const markerWithMeta = markerLayer as L.Marker & { __bookmarkText?: string; __bookmarkCreatedAt?: string };
      markerWithMeta.__bookmarkText = bookmarkText;
      markerWithMeta.__bookmarkCreatedAt = createdAt;

      const latLng = markerLayer.getLatLng();
      markerLayer.bindTooltip(bookmarkText, {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        opacity: 0.95,
      });
      markerLayer.bindPopup(
        `<strong>${bookmarkText}</strong><br/>Lat: ${latLng.lat.toFixed(6)}<br/>Lon: ${latLng.lng.toFixed(6)}<br/>Time: ${createdAt}`,
      );
    };

    const syncShapePresentation = (shapeLayer: L.Layer) => {
      if (shapeLayer instanceof L.Polyline && !(shapeLayer instanceof L.Polygon)) {
        renderLineNodeDetails(shapeLayer as L.Polyline);
        bindPolylinePopup(shapeLayer as L.Polyline);
        return;
      }

      if (shapeLayer instanceof L.Polygon) {
        renderPolygonNodeDetails(shapeLayer as L.Polygon);
        bindPolygonPopup(shapeLayer as L.Polygon);
        return;
      }

      if (shapeLayer instanceof L.Circle) {
        bindCirclePopup(shapeLayer as L.Circle);
      }
    };

    const saveDrawingsToStorage = () => {
      const persistedShapes: PersistedDrawShape[] = [];

      editableLayers.eachLayer((currentLayer: L.Layer) => {
        if (currentLayer instanceof L.Polyline && !(currentLayer instanceof L.Polygon)) {
          const latLngs = currentLayer.getLatLngs() as L.LatLng[];
          persistedShapes.push({
            type: "polyline",
            color: String(currentLayer.options.color ?? polylineColor),
            points: latLngs.map((point) => [point.lat, point.lng]),
          });
          return;
        }

        if (currentLayer instanceof L.Polygon) {
          const latLngs = (currentLayer.getLatLngs()[0] ?? []) as L.LatLng[];
          persistedShapes.push({
            type: "polygon",
            color: String(currentLayer.options.color ?? polygonColor),
            points: latLngs.map((point) => [point.lat, point.lng]),
          });
          return;
        }

        if (currentLayer instanceof L.Circle) {
          const center = currentLayer.getLatLng();
          persistedShapes.push({
            type: "circle",
            color: String(currentLayer.options.color ?? circleColor),
            center: [center.lat, center.lng],
            radiusM: currentLayer.getRadius(),
          });
          return;
        }

        if (currentLayer instanceof L.Marker) {
          const markerLayer = currentLayer as L.Marker & { __bookmarkText?: string; __bookmarkCreatedAt?: string };
          const latLng = markerLayer.getLatLng();
          const bookmarkText = markerLayer.__bookmarkText ?? String(markerLayer.getTooltip()?.getContent() ?? "Bookmark Pin");
          const createdAt = markerLayer.__bookmarkCreatedAt ?? new Date().toLocaleString();
          persistedShapes.push({
            type: "marker",
            center: [latLng.lat, latLng.lng],
            bookmarkText,
            createdAt,
          });
        }
      });

      localStorage.setItem(DRAW_SHAPES_STORAGE_KEY, JSON.stringify(persistedShapes));
    };

    const restoreDrawingsFromStorage = () => {
      let persistedShapes: PersistedDrawShape[] = [];
      try {
        const raw = localStorage.getItem(DRAW_SHAPES_STORAGE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as PersistedDrawShape[];
        if (Array.isArray(parsed)) {
          persistedShapes = parsed;
        }
      } catch {
        return;
      }

      for (const shape of persistedShapes) {
        if (shape.type === "polyline" && Array.isArray(shape.points) && shape.points.length >= 2) {
          const polylineLayer = L.polyline(
            shape.points.map(([lat, lng]) => [lat, lng] as [number, number]),
            { color: shape.color ?? polylineColor, weight: 3 },
          );
          editableLayers.addLayer(polylineLayer);
          syncShapePresentation(polylineLayer);
          continue;
        }

        if (shape.type === "polygon" && Array.isArray(shape.points) && shape.points.length >= 3) {
          const polygonLayer = L.polygon(
            shape.points.map(([lat, lng]) => [lat, lng] as [number, number]),
            { color: shape.color ?? polygonColor, weight: 2 },
          );
          editableLayers.addLayer(polygonLayer);
          syncShapePresentation(polygonLayer);
          continue;
        }

        if (shape.type === "circle" && shape.center && typeof shape.radiusM === "number") {
          const circleLayer = L.circle(shape.center, {
            radius: shape.radiusM,
            color: shape.color ?? circleColor,
            weight: 2,
          });
          editableLayers.addLayer(circleLayer);
          syncShapePresentation(circleLayer);
          continue;
        }

        if (shape.type === "marker" && shape.center) {
          const markerLayer = L.marker(shape.center);
          const bookmarkText = (shape.bookmarkText ?? "Bookmark Pin").trim() || "Bookmark Pin";
          const createdAt = shape.createdAt ?? new Date().toLocaleString();
          bindMarkerPopup(markerLayer, bookmarkText, createdAt);
          editableLayers.addLayer(markerLayer);
        }
      }
    };

    const onCreated: L.LeafletEventHandlerFn = (event) => {
      const drawEvent = event as L.DrawEvents.Created;
      const layer = drawEvent.layer;

      if (drawEvent.layerType === "polygon") {
        (layer as L.Polygon).setStyle({ color: polygonColor });
      }
      if (drawEvent.layerType === "polyline") {
        (layer as L.Polyline).setStyle({ color: polylineColor });
      }
      if (drawEvent.layerType === "circle") {
        (layer as L.Circle).setStyle({ color: circleColor });
      }

      editableLayers.addLayer(layer);

      if (drawEvent.layerType === "polyline") {
        const polylineLayer = layer as L.Polyline;
        syncShapePresentation(polylineLayer);
        polylineLayer.openPopup();
      }

      if (drawEvent.layerType === "polygon") {
        const polygonLayer = layer as L.Polygon;
        syncShapePresentation(polygonLayer);
        polygonLayer.openPopup();
      }

      if (drawEvent.layerType === "circle") {
        const circleLayer = layer as L.Circle;
        syncShapePresentation(circleLayer);
        circleLayer.openPopup();
      }

      if (drawEvent.layerType === "marker") {
        const marker = layer as L.Marker;
        const createdAt = new Date().toLocaleString();
        const bookmarkTextInput = window.prompt("Enter bookmark text", "Bookmark Pin") ?? "Bookmark Pin";
        const bookmarkText = bookmarkTextInput.trim() || "Bookmark Pin";
        bindMarkerPopup(marker, bookmarkText, createdAt);
        marker.openPopup();
      }

      saveDrawingsToStorage();
    };

    const onEdited: L.LeafletEventHandlerFn = (event) => {
      const editedLayers = (event as L.DrawEvents.Edited).layers;
      editedLayers.eachLayer((editedLayer: L.Layer) => {
        syncShapePresentation(editedLayer);
      });
      saveDrawingsToStorage();
    };

    const onDeleted: L.LeafletEventHandlerFn = (event) => {
      const deletedLayers = (event as L.DrawEvents.Deleted).layers;
      deletedLayers.eachLayer((deletedLayer: L.Layer) => {
        const ownerId = L.Util.stamp(deletedLayer);
        const labelsGroup = shapeNodeLayerGroups.get(ownerId);
        if (!labelsGroup) {
          return;
        }
        map.removeLayer(labelsGroup);
        shapeNodeLayerGroups.delete(ownerId);
      });
      saveDrawingsToStorage();
    };

    restoreDrawingsFromStorage();

    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.EDITED, onEdited);
    map.on(L.Draw.Event.DELETED, onDeleted);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      map.off(L.Draw.Event.DRAWSTART, onDrawStart);
      map.off(L.Draw.Event.DRAWSTOP, onDrawStop);
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.EDITED, onEdited);
      map.off(L.Draw.Event.DELETED, onDeleted);
      saveDrawingsToStorage();
      shapeNodeLayerGroups.forEach((labelsGroup) => {
        map.removeLayer(labelsGroup);
      });
      shapeNodeLayerGroups.clear();
      map.removeControl(drawControl);
      map.removeLayer(editableLayers);
    };
  }, [map, polygonColor, polylineColor, circleColor, showNodeLabels, onActiveShapeChange]);

  return null;
}

function MapResetController({
  center,
  fitPoints,
  savedView,
  resetCounter,
}: {
  center: [number, number];
  fitPoints: Array<[number, number]>;
  savedView: SavedMapView | null;
  resetCounter: number;
}) {
  const map = useMap();
  const lastHandledResetRef = useRef(0);

  useEffect(() => {
    if (resetCounter <= 0 || resetCounter === lastHandledResetRef.current) {
      return;
    }
    lastHandledResetRef.current = resetCounter;

    map.invalidateSize();
    requestAnimationFrame(() => {
      if (savedView) {
        map.setView(savedView.center, savedView.zoom, { animate: false });
      } else if (fitPoints.length > 0) {
        const bounds = L.latLngBounds(fitPoints);
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16, animate: false });
      } else {
        map.setView(center, 13, { animate: false });
      }
      map.invalidateSize();
    });
  }, [center, fitPoints, map, resetCounter, savedView]);

  return null;
}

function MapResizeController() {
  const map = useMap();

  useEffect(() => {
    let rafId = 0;

    const scheduleInvalidate = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        map.invalidateSize();
      });
    };

    scheduleInvalidate();
    const earlyTimer = window.setTimeout(scheduleInvalidate, 150);
    const settleTimer = window.setTimeout(scheduleInvalidate, 800);

    window.addEventListener("resize", scheduleInvalidate);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleInvalidate();
      });
      resizeObserver.observe(map.getContainer());
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.clearTimeout(earlyTimer);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", scheduleInvalidate);
      resizeObserver?.disconnect();
    };
  }, [map]);

  return null;
}

export default function MapView({
  assets = [],
  alerts = [],
  signals = [],
  tcpRecentMessages = [],
  heatCells = [],
  coveragePoints = [],
  triangulation = null,
  assetConnectionMode = "none",
  mapHeight = "500px",
  showOnlyDirectionFinders = false,
  jammerLifecycleByAssetId = {},
  jammerActionInProgressId = null,
  onJammerToggle,
}: Props) {
  const { mode } = useTheme();
  const defaultCenter = DELHI_CENTER;
  const [blinkOn, setBlinkOn] = useState(true);
  const [mapZoom, setMapZoom] = useState(13);
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const [showAssets, setShowAssets] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [showHeatOverlay, setShowHeatOverlay] = useState(true);
  const [showTriangulationOverlay, setShowTriangulationOverlay] = useState(true);
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(() => {
    const raw = localStorage.getItem(MAP_NODE_LABELS_VISIBLE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return true;
  });
  const [polygonColor, setPolygonColor] = useState("#0ea5e9");
  const [polylineColor, setPolylineColor] = useState("#16a34a");
  const [circleColor, setCircleColor] = useState("#f59e0b");
  const [activeDrawShape, setActiveDrawShape] = useState<DrawShapeType | null>(null);
  const [baseMapId, setBaseMapId] = useState<string>("osm");
  const [showBaseMapSelector, setShowBaseMapSelector] = useState(false);
  const [baseMapTileErrors, setBaseMapTileErrors] = useState(0);
  const [baseMapTileLoads, setBaseMapTileLoads] = useState(0);
  const [autoOfflineFallbackActive, setAutoOfflineFallbackActive] = useState(false);
  const [showAssetLegend, setShowAssetLegend] = useState(false);
  const [showTransparencySlider, setShowTransparencySlider] = useState(false);
  const [showJammerColorPicker, setShowJammerColorPicker] = useState(false);
  const [showDfColorPicker, setShowDfColorPicker] = useState(false);
  const [jammerPopupAlpha, setJammerPopupAlpha] = useState<number>(() => {
    const raw = localStorage.getItem(JAMMER_POPUP_ALPHA_KEY);
    if (!raw) {
      return DEFAULT_JAMMER_POPUP_ALPHA;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_JAMMER_POPUP_ALPHA;
    }

    return Math.max(MIN_JAMMER_POPUP_ALPHA, Math.min(MAX_JAMMER_POPUP_ALPHA, parsed));
  });
  const [jammerRangeColor, setJammerRangeColor] = useState<string>(() => {
    const raw = localStorage.getItem(JAMMER_RANGE_COLOR_KEY);
    if (!raw) {
      return DEFAULT_JAMMER_RANGE_COLOR;
    }

    const normalized = raw.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      return DEFAULT_JAMMER_RANGE_COLOR;
    }

    return normalized;
  });
  const [dfRangeColor, setDfRangeColor] = useState<string>(() => {
    const raw = localStorage.getItem(DF_RANGE_COLOR_KEY);
    if (!raw) {
      return DEFAULT_DF_RANGE_COLOR;
    }

    const normalized = raw.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      return DEFAULT_DF_RANGE_COLOR;
    }

    return normalized;
  });
  const [jammerControlByAssetId, setJammerControlByAssetId] = useState<Record<string, JammerPopupControlState>>({});
  const [currentView, setCurrentView] = useState<SavedMapView | null>(null);
  const [savedView, setSavedView] = useState<SavedMapView | null>(() => {
    try {
      const raw = localStorage.getItem(MAP_SAVED_VIEW_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as SavedMapView;
      if (
        Array.isArray(parsed.center) &&
        parsed.center.length === 2 &&
        typeof parsed.center[0] === "number" &&
        typeof parsed.center[1] === "number" &&
        typeof parsed.zoom === "number"
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (savedView) {
      localStorage.setItem(MAP_SAVED_VIEW_KEY, JSON.stringify(savedView));
      return;
    }
    localStorage.removeItem(MAP_SAVED_VIEW_KEY);
  }, [savedView]);

  useEffect(() => {
    localStorage.setItem(MAP_NODE_LABELS_VISIBLE_KEY, String(showNodeLabels));
  }, [showNodeLabels]);

  useEffect(() => {
    localStorage.setItem(JAMMER_POPUP_ALPHA_KEY, jammerPopupAlpha.toString());
  }, [jammerPopupAlpha]);

  useEffect(() => {
    localStorage.setItem(JAMMER_RANGE_COLOR_KEY, jammerRangeColor);
  }, [jammerRangeColor]);

  useEffect(() => {
    localStorage.setItem(DF_RANGE_COLOR_KEY, dfRangeColor);
  }, [dfRangeColor]);

  useEffect(() => {
    const timer = setInterval(() => setBlinkOn((current) => !current), 500);
    return () => clearInterval(timer);
  }, []);

  const visibleAssets = useMemo(
    () =>
      showOnlyDirectionFinders
        ? assets.filter((asset) => (asset.type ?? "").trim().toUpperCase() === "DIRECTION_FINDER")
        : assets,
    [assets, showOnlyDirectionFinders]
  );

  const setJammerControlField = useCallback(
    (assetId: string, field: keyof JammerPopupControlState, value: string) => {
      setJammerControlByAssetId((current) => ({
        ...current,
        [assetId]: {
          ...(current[assetId] ?? DEFAULT_JAMMER_POPUP_CONTROL_STATE),
          [field]: value,
        },
      }));
    },
    []
  );

  const alertMarkers = alerts.filter((alert) => {
    const status = String(alert.status ?? "").toUpperCase();
    return (
      (status === "NEW" || status === "ACKNOWLEDGED") &&
      typeof alert.latitude === "number" &&
      typeof alert.longitude === "number"
    );
  });
  const directionFinderAssets = visibleAssets.filter(
    (asset) => (asset.type ?? "").trim().toUpperCase() === "DIRECTION_FINDER"
  );
  const pointerAnchorAsset =
    directionFinderAssets.find((asset) => asset.name?.toLowerCase().includes("bravo east"))
    ?? directionFinderAssets[0]
    ?? null;
  const latestTcpFrame = useMemo(() => {
    if (tcpRecentMessages.length === 0) {
      return null;
    }

    return tcpRecentMessages.reduce((latest, current) => {
      const latestTs = latest.received_at ? new Date(latest.received_at).getTime() : Number.NEGATIVE_INFINITY;
      const currentTs = current.received_at ? new Date(current.received_at).getTime() : Number.NEGATIVE_INFINITY;
      return currentTs > latestTs ? current : latest;
    });
  }, [tcpRecentMessages]);
  const latestTcpFrameWithBearing = useMemo(() => {
    if (!latestTcpFrame) {
      return null;
    }

    const extracted = extractTcpBearing(latestTcpFrame.parsed_fields);
    if (!extracted) {
      return null;
    }

    return {
      frame: latestTcpFrame,
      ...extracted,
    };
  }, [latestTcpFrame]);
  const tcpPointerLine = useMemo(() => {
    if (!pointerAnchorAsset || !latestTcpFrameWithBearing) {
      return null;
    }

    const start: [number, number] = [pointerAnchorAsset.latitude, pointerAnchorAsset.longitude];
    const end = destinationPointFromBearing(
      start,
      latestTcpFrameWithBearing.bearingDeg,
      TCP_DF_LINE_DISTANCE_METERS,
    );

    return {
      start,
      end,
    };
  }, [pointerAnchorAsset, latestTcpFrameWithBearing]);
  const jammerAssets = visibleAssets.filter((asset) => isJammerAssetType(asset.type));
  const activeJammerAssets = useMemo(
    () =>
      jammerAssets.filter((asset) => {
        const lifecycleState = String(jammerLifecycleByAssetId[asset.id] ?? "").toUpperCase();
        return lifecycleState === "JAMMING";
      }),
    [jammerAssets, jammerLifecycleByAssetId],
  );
  const activeJammerAssetsWithRange = useMemo(
    () =>
      activeJammerAssets.flatMap((asset) => {
        const radiusM = getAssetCircleRadiusMeters(asset);
        if (!radiusM) {
          return [];
        }
        return [{ asset, radiusM }];
      }),
    [activeJammerAssets],
  );
  const jammerRangeSpokes = useMemo(
    () =>
      activeJammerAssetsWithRange.flatMap(({ asset, radiusM }) => {
        const center: [number, number] = [asset.latitude, asset.longitude];
        return Array.from({ length: JAMMER_RANGE_SPOKE_COUNT }, (_, index) => {
          const bearing = (360 / JAMMER_RANGE_SPOKE_COUNT) * index;
          const perimeter = destinationPointFromBearing(center, bearing, radiusM);
          return {
            key: `jammer-spoke-${asset.id}-${index}`,
            center,
            perimeter,
          };
        });
      }),
    [activeJammerAssetsWithRange],
  );
  const assetTypeLegend = useMemo(() => {
    const seen = new Set<string>();
    for (const asset of visibleAssets) {
      const typeKey = (asset.type ?? "").trim().toUpperCase() || "UNKNOWN";
      seen.add(typeKey);
    }

    const orderedKnown = ASSET_TYPE_ORDER.filter((typeKey) => seen.has(typeKey)).map((typeKey) => [
      typeKey,
      ASSET_TYPE_SETTINGS[typeKey],
    ] as [string, AssetTypeSettings]);

    const unknown = Array.from(seen)
      .filter((typeKey) => !ASSET_TYPE_SETTINGS[typeKey])
      .map((typeKey) => [typeKey, getAssetTypeSettings(typeKey)] as [string, AssetTypeSettings]);

    return [...orderedKnown, ...unknown];
  }, [visibleAssets]);
  const hasAlertMarkers = alertMarkers.length > 0;
  const hasAssets = visibleAssets.length > 0;
  const hasSignals = signals.length > 0;
  const hasHeatCells = heatCells.length > 0;
  const hasCoverage = coveragePoints.length > 0;
  const triangulationCentroid: [number, number] | null =
    typeof triangulation?.centroid_latitude === "number" && typeof triangulation?.centroid_longitude === "number"
      ? [triangulation.centroid_latitude, triangulation.centroid_longitude]
      : null;
  const triangulationPolygon = triangulation?.roi_polygon?.map((point) => [point.latitude, point.longitude] as [number, number]) ?? [];
  const triangulationIntersections = triangulation?.intersections ?? [];
  const triangulationRayColorBySource = useMemo(() => {
    const bySource = new Map<string, string>();
    for (const ray of triangulation?.rays ?? []) {
      bySource.set(ray.source_id, getTriangulationColor(ray.source_id));
    }
    return bySource;
  }, [triangulation]);
  const triangulationLegendEntries = useMemo(
    () =>
      Array.from(triangulationRayColorBySource.entries())
        .map(([sourceId, color]) => ({ sourceId, color }))
        .sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
    [triangulationRayColorBySource]
  );
  const lowZoomStyleScale = useMemo(() => {
    if (mapZoom <= 9) return 1.5;
    if (mapZoom <= 11) return 1.3;
    if (mapZoom <= 13) return 1.15;
    return 1;
  }, [mapZoom]);
  const mapCenter: [number, number] = useMemo(
    () =>
      triangulationCentroid
        ? triangulationCentroid
        : hasAlertMarkers
        ? [alertMarkers[0].latitude as number, alertMarkers[0].longitude as number]
        : hasAssets
        ? [visibleAssets[0].latitude, visibleAssets[0].longitude]
        : hasSignals
          ? [signals[0].latitude, signals[0].longitude]
        : hasHeatCells
          ? [heatCells[0].latitude_bucket, heatCells[0].longitude_bucket]
        : hasCoverage
            ? [coveragePoints[0].latitude, coveragePoints[0].longitude]
            : defaultCenter,
    [
      triangulationCentroid,
      hasAlertMarkers,
      hasAssets,
      hasSignals,
      hasHeatCells,
      hasCoverage,
      alertMarkers,
      visibleAssets,
      signals,
      heatCells,
      coveragePoints,
      defaultCenter,
    ],
  );
  const hasSavedView = savedView !== null;
  const initialMapCenter: [number, number] = hasSavedView ? (savedView as SavedMapView).center : mapCenter;
  const initialMapZoom = hasSavedView ? (savedView as SavedMapView).zoom : 13;
  const selectedBaseMap = BASE_MAP_OPTIONS.find((option) => option.id === baseMapId) ?? BASE_MAP_OPTIONS[0];
  const selectedBaseMapUrl = mode === "dark" && selectedBaseMap.darkUrl ? selectedBaseMap.darkUrl : selectedBaseMap.url;
  const selectedBaseMapClassName = mode === "dark" && selectedBaseMap.useDarkFilter ? "map-tiles-dark-filter" : undefined;
  const mapDarkFilterClass = mode === "dark" && selectedBaseMap.useDarkFilter ? "map-theme-dark" : "";
  const isOfflineBaseMap = baseMapId === "offline-local" || baseMapId === "offline-blank";
  const activeShapeMenuTop =
    activeDrawShape === "polyline" ? 50 : activeDrawShape === "polygon" ? 80 : activeDrawShape === "circle" ? 110 : 50;
  const activeShapeColor =
    activeDrawShape === "polygon" ? polygonColor : activeDrawShape === "polyline" ? polylineColor : circleColor;
  const activeShapeLabel =
    activeDrawShape === "polygon" ? "Polygon" : activeDrawShape === "polyline" ? "Line" : "Circle";
  const handleBaseMapTileError = useCallback(() => {
    setBaseMapTileErrors((current) => current + 1);
  }, []);
  const handleBaseMapTileLoad = useCallback(() => {
    setBaseMapTileLoads((current) => current + 1);
  }, []);
  const handleBaseMapSelectionChange = useCallback((nextBaseMapId: string) => {
    setAutoOfflineFallbackActive(false);
    setBaseMapId(nextBaseMapId);
  }, []);
  const handleResetView = useCallback(() => {
    setResetCounter((current) => current + 1);
  }, []);
  const handleActiveShapeColorChange = useCallback(
    (color: string) => {
      if (activeDrawShape === "polygon") {
        setPolygonColor(color);
        return;
      }
      if (activeDrawShape === "polyline") {
        setPolylineColor(color);
        return;
      }
      if (activeDrawShape === "circle") {
        setCircleColor(color);
      }
    },
    [activeDrawShape],
  );

  useEffect(() => {
    setBaseMapTileErrors(0);
    setBaseMapTileLoads(0);
  }, [baseMapId, mode]);

  useEffect(() => {
    if (!isOfflineBaseMap && baseMapTileLoads > 0) {
      setAutoOfflineFallbackActive(false);
    }
  }, [isOfflineBaseMap, baseMapTileLoads]);

  useEffect(() => {
    if (isOfflineBaseMap || baseMapTileLoads > 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBaseMapId((current) => {
        if (current === "offline-local" || current === "offline-blank") {
          return current;
        }
        setAutoOfflineFallbackActive(true);
        return "offline-local";
      });
    }, 12000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOfflineBaseMap, baseMapTileLoads]);

  useEffect(() => {
    if (!autoOfflineFallbackActive || !isOfflineBaseMap || !navigator.onLine) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBaseMapId("osm");
    }, 15000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoOfflineFallbackActive, isOfflineBaseMap]);

  useEffect(() => {
    if (baseMapTileErrors < 2 || baseMapId === "offline-blank") {
      return;
    }

    if (baseMapId !== "offline-local") {
      setAutoOfflineFallbackActive(true);
      setBaseMapId("offline-local");
      return;
    }

    setAutoOfflineFallbackActive(true);
    setBaseMapId("offline-blank");
  }, [baseMapId, baseMapTileErrors]);
  const resetFitPoints: Array<[number, number]> = useMemo(() => {
    const points: Array<[number, number]> = [];

    if (showAlerts) {
      for (const alert of alertMarkers) {
        points.push([alert.latitude as number, alert.longitude as number]);
      }
    }

    if (showAssets) {
      for (const asset of visibleAssets) {
        points.push([asset.latitude, asset.longitude]);
      }
    }

    if (showSignals) {
      for (const signal of signals) {
        points.push([signal.latitude, signal.longitude]);
      }

      if (showHeatOverlay) {
        for (const cell of heatCells) {
          points.push([cell.latitude_bucket, cell.longitude_bucket]);
        }
      }

      if (showTriangulationOverlay) {
        if (triangulationCentroid) {
          points.push(triangulationCentroid);
        }

        for (const point of triangulationPolygon) {
          points.push(point);
        }

        for (const point of triangulationIntersections) {
          points.push([point.latitude, point.longitude]);
        }
      }
    }

    for (const point of coveragePoints) {
      points.push([point.latitude, point.longitude]);
    }

    return points;
  }, [
    alertMarkers,
    visibleAssets,
    signals,
    heatCells,
    triangulationCentroid,
    triangulationPolygon,
    triangulationIntersections,
    coveragePoints,
    showAlerts,
    showAssets,
    showSignals,
    showHeatOverlay,
    showTriangulationOverlay,
  ]);

  return (
    <div
      style={
        {
          position: "relative",
          ["--jammer-popup-alpha" as string]: jammerPopupAlpha,
        } as React.CSSProperties
      }
    >
    <MapContainer className={mapDarkFilterClass} center={initialMapCenter} zoom={initialMapZoom} zoomControl={false} style={{ height: mapHeight }}>
      <MapCenterController center={mapCenter} onZoomChange={setMapZoom} shouldFollowCenter={!hasSavedView} />
      <MapResetController center={mapCenter} fitPoints={resetFitPoints} savedView={savedView} resetCounter={resetCounter} />
      <MapResizeController />
      <MousePositionTracker onPositionChange={setMousePosition} />
      <MapViewportTracker onViewChange={setCurrentView} />
      <AttributionPrefixController />
      <DrawMeasureControl
        polygonColor={polygonColor}
        polylineColor={polylineColor}
        circleColor={circleColor}
        showNodeLabels={showNodeLabels}
        onActiveShapeChange={setActiveDrawShape}
      />
      <ScaleControl position="bottomleft" />
      <ZoomControl position="bottomright" />
      {selectedBaseMap.requiresQuadKey ? (
        <BingTileLayer
          key={`${selectedBaseMap.id}-${mode}`}
          option={selectedBaseMap}
          url={selectedBaseMapUrl}
          className={selectedBaseMapClassName}
          onTileError={handleBaseMapTileError}
          onTileLoad={handleBaseMapTileLoad}
        />
      ) : (
        <TileLayer
          key={`${selectedBaseMap.id}-${mode}`}
          attribution={selectedBaseMap.attribution}
          url={selectedBaseMapUrl}
          subdomains={selectedBaseMap.subdomains}
          maxZoom={selectedBaseMap.maxZoom}
          className={selectedBaseMapClassName}
          eventHandlers={{
            tileerror: handleBaseMapTileError,
            tileload: handleBaseMapTileLoad,
          }}
        />
      )}

      {showAssets && visibleAssets.map((asset) => {
        const assetTypeKey = (asset.type ?? "UNKNOWN").trim().toUpperCase();
        const jammerLifecycleState = jammerLifecycleByAssetId[asset.id] ?? "ACTIVE_SERVICE";
        const isJammer = assetTypeKey === "JAMMER";
        const isJamming = jammerLifecycleState.toUpperCase() === "JAMMING";
        const actionPending = jammerActionInProgressId === asset.id;
        const markerStatus = isJammer && isJamming ? "JAMMING" : asset.status;
        const baseAssetSettings = getAssetTypeSettings(asset.type);
        const assetSettings =
          assetTypeKey === "DIRECTION_FINDER"
            ? ({ ...baseAssetSettings, markerColor: dfRangeColor } as AssetTypeSettings)
            : baseAssetSettings;
        const jammerControl = jammerControlByAssetId[asset.id] ?? DEFAULT_JAMMER_POPUP_CONTROL_STATE;

        return (
          <Marker
            key={asset.id}
            position={[asset.latitude, asset.longitude]}
            icon={buildAssetIcon(assetSettings, markerStatus, mapZoom)}
          >
            <Popup className={isJammer ? "jammer-flash-popup" : undefined}>
              <div style={isJammer ? { minWidth: 250 } : undefined}>
                <strong>{asset.name}</strong>
                <div>Type: {asset.type ?? "UNKNOWN"}</div>
                <div>Status: {asset.status}</div>
                <div>Profile: {assetSettings.label}</div>
                {isJammer && <div>Jammer State: {jammerLifecycleState}</div>}
                {isJammer && onJammerToggle && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                      Module
                      <select
                        value={jammerControl.moduleId}
                        onChange={(event) => setJammerControlField(asset.id, "moduleId", event.target.value)}
                        disabled={actionPending}
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
                        value={jammerControl.jammingCode}
                        onChange={(event) => setJammerControlField(asset.id, "jammingCode", event.target.value)}
                        disabled={actionPending}
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
                        value={jammerControl.frequency}
                        onChange={(event) => setJammerControlField(asset.id, "frequency", event.target.value)}
                        disabled={actionPending}
                        placeholder="optional"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                      Gain
                      <select
                        value={jammerControl.gain}
                        onChange={(event) => setJammerControlField(asset.id, "gain", event.target.value)}
                        disabled={actionPending}
                      >
                        {GAIN_OPTIONS.map((gain) => (
                          <option key={gain} value={gain}>
                            {gain}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {isJammer && onJammerToggle && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isJamming) {
                        onJammerToggle(asset.id, "stop");
                        return;
                      }

                      const parsedFrequency = jammerControl.frequency.trim()
                        ? Number(jammerControl.frequency)
                        : undefined;

                      onJammerToggle(asset.id, "start", {
                        moduleId: Number(jammerControl.moduleId),
                        jammingCode: Number(jammerControl.jammingCode),
                        frequency: Number.isFinite(parsedFrequency as number) ? parsedFrequency : undefined,
                        gain: Number(jammerControl.gain),
                      });
                    }}
                    disabled={actionPending}
                    style={{
                      marginTop: 8,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: isJamming ? "#dc2626" : "#16a34a",
                      color: "#ffffff",
                      cursor: actionPending ? "not-allowed" : "pointer",
                      opacity: actionPending ? 0.7 : 1,
                    }}
                  >
                    {actionPending ? "Processing..." : isJamming ? "Stop Jamming" : "Start Jamming"}
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {showAssets && directionFinderAssets.map((asset) => {
        const radiusM = getAssetCircleRadiusMeters(asset);
        if (!radiusM) {
          return null;
        }

        return (
          <Circle
            key={`df-circle-${asset.id}`}
            center={[asset.latitude, asset.longitude]}
            radius={radiusM}
            pathOptions={{
              color: dfRangeColor,
              weight: 2,
              fillColor: dfRangeColor,
              fillOpacity: 0.08,
            }}
          />
        );
      })}

      {showAssets && activeJammerAssetsWithRange.map(({ asset, radiusM }) => (
        <Circle
          key={`jammer-range-${asset.id}`}
          center={[asset.latitude, asset.longitude]}
          radius={radiusM}
          pathOptions={{
            color: jammerRangeColor,
            weight: 3,
            dashArray: "8 5",
            fillColor: jammerRangeColor,
            fillOpacity: 0.05,
            opacity: blinkOn ? 0.95 : 0.6,
          }}
        />
      ))}

      {showAssets && activeJammerAssetsWithRange.flatMap(({ asset, radiusM }) => Array.from({ length: JAMMER_SIGNAL_RING_COUNT }, (_, ringIndex) => (<Circle key={`jammer-inner-${asset.id}-${ringIndex}`} center={[asset.latitude, asset.longitude]} radius={((ringIndex + 1) / (JAMMER_SIGNAL_RING_COUNT + 1)) * radiusM} pathOptions={{ color: jammerRangeColor, weight: blinkOn ? (ringIndex % 2 === 0 ? 2.2 : 1.4) : (ringIndex % 2 === 0 ? 1.4 : 2.2), opacity: blinkOn ? (ringIndex % 2 === 0 ? 0.95 : 0.35) : (ringIndex % 2 === 0 ? 0.35 : 0.95), dashArray: "6 6", fillOpacity: 0 }} />)))}

      {showAssets && jammerRangeSpokes.map((spoke) => (
        <Polyline
          key={spoke.key}
          positions={[spoke.center, spoke.perimeter]}
          pathOptions={{
            color: jammerRangeColor,
            weight: 2,
            opacity: blinkOn ? 0.9 : 0.45,
          }}
        />
      ))}
      {showAlerts && alertMarkers.map((alert) => (
        <CircleMarker
          key={`alert-${alert.id}`}
          center={[alert.latitude as number, alert.longitude as number]}
          radius={String(alert.status).toUpperCase() === "NEW" ? (blinkOn ? 12 : 6) : 8}
          pathOptions={{
            color: String(alert.status).toUpperCase() === "NEW" ? "#ef4444" : "#f59e0b",
            fillColor: String(alert.status).toUpperCase() === "NEW" ? "#ef4444" : "#f59e0b",
            fillOpacity: String(alert.status).toUpperCase() === "NEW" ? (blinkOn ? 0.7 : 0.2) : 0.65,
            weight: 2,
          }}
        >
          <Popup>
            <div>
              <div><strong>Alert: {alert.severity}</strong></div>
              <div>{alert.description ?? "Decodio Trigger"}</div>
              <div>Status: {alert.status}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {coveragePoints.map((point, idx) => (
        <CircleMarker
          key={`cov-${idx}`}
          center={[point.latitude, point.longitude]}
          radius={4}
          pathOptions={{ color: "#16a34a" }}
        >
          <Popup>Coverage: {point.coverage_db} dB</Popup>
        </CircleMarker>
      ))}

      {showSignals && showHeatOverlay && heatCells.map((cell, index) => (
        <CircleMarker
          key={`heat-${cell.latitude_bucket}-${cell.longitude_bucket}-${index}`}
          center={[cell.latitude_bucket, cell.longitude_bucket]}
          radius={Math.max(4, 10 * cell.density) * lowZoomStyleScale}
          pathOptions={{
            color: getHeatCellColor(cell.density),
            fillColor: getHeatCellColor(cell.density),
            fillOpacity: Math.min(0.55, 0.1 + cell.density * 0.4),
            weight: 1.2,
            opacity: 0.7,
          }}
        >
          <Popup>
            <div>
              <strong>Probability Cell</strong>
              <div>Density: {cell.density.toFixed(2)}</div>
              <div>{cell.latitude_bucket.toFixed(5)}, {cell.longitude_bucket.toFixed(5)}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {showSignals && showTriangulationOverlay && triangulation?.rays.map((ray) => (
        <Fragment key={`tri-ray-group-${ray.source_id}`}>
          <Polyline
            key={`tri-ray-halo-${ray.source_id}`}
            positions={[
              [ray.source_latitude, ray.source_longitude],
              [ray.end_latitude, ray.end_longitude],
            ]}
            pathOptions={{
              color: "#f8fafc",
              weight: Math.min(6.8, 4.2 * lowZoomStyleScale),
              opacity: 0.5,
            }}
          />
          <Polyline
            key={`tri-ray-${ray.source_id}`}
            positions={[
              [ray.source_latitude, ray.source_longitude],
              [ray.end_latitude, ray.end_longitude],
            ]}
            pathOptions={{
              color: triangulationRayColorBySource.get(ray.source_id) ?? "#ef4444",
              weight: Math.min(5.4, 3.2 * lowZoomStyleScale),
              dashArray: "8 6",
              opacity: 0.9,
            }}
          >
            <Popup>
              <div>
                <strong>{ray.source_id}</strong>
                <div>Bearing: {ray.bearing_deg.toFixed(1)} deg</div>
                <div>Confidence: {(ray.confidence * 100).toFixed(1)}%</div>
              </div>
            </Popup>
          </Polyline>
        </Fragment>
      ))}

      {showSignals && showTriangulationOverlay && triangulationIntersections.map((point, index) => (
        <CircleMarker
          key={`tri-x-${index}`}
          center={[point.latitude, point.longitude]}
          radius={4.2 * lowZoomStyleScale}
          pathOptions={{ color: "#f8fafc", fillColor: "#f59e0b", fillOpacity: 0.92, weight: 1.5 }}
        >
          <Popup>
            <div>
              <strong>Triangulation Intersection</strong>
              <div>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {showSignals && showTriangulationOverlay && triangulationCentroid && (
        <>
          <CircleMarker
            center={triangulationCentroid}
            radius={12 * lowZoomStyleScale}
            pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.12, weight: 1 }}
          />
          <CircleMarker
            center={triangulationCentroid}
            radius={7 * lowZoomStyleScale}
            pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.88, weight: 2 }}
          >
            <Popup>
              <div>
                <strong>Estimated Emitter</strong>
                <div>{triangulationCentroid[0].toFixed(5)}, {triangulationCentroid[1].toFixed(5)}</div>
                {typeof triangulation?.confidence_level === "number" && (
                  <div>Confidence: {(triangulation.confidence_level * 100).toFixed(1)}%</div>
                )}
                {triangulation?.warning && <div>{triangulation.warning}</div>}
              </div>
            </Popup>
          </CircleMarker>
        </>
      )}

      {showSignals && showTriangulationOverlay && triangulationPolygon.length > 2 && (
        <Polygon
          positions={triangulationPolygon}
          pathOptions={{
            color: "#22c55e",
            weight: Math.min(3.8, 2.4 * lowZoomStyleScale),
            dashArray: "11 7",
            fillOpacity: 0.16,
          }}
        />
      )}

      {showSignals && signals.map((signal) => (
        <CircleMarker
          key={`sig-${signal.id}`}
          center={[signal.latitude, signal.longitude]}
          radius={5 * lowZoomStyleScale}
          pathOptions={{ color: "#1d4ed8" }}
        >
          <Popup>
            <div>
              <div>Frequency: {signal.frequency}</div>
              <div>Modulation: {signal.modulation}</div>
              <div>Power: {signal.power_level}</div>
              <div>Detected: {new Date(signal.detected_at).toLocaleString()}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {tcpPointerLine && pointerAnchorAsset && latestTcpFrameWithBearing && (
        <>
          <CircleMarker
            center={tcpPointerLine.end}
            radius={6}
            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.85, weight: 2 }}
          >
            <Popup>
              <div>
                <strong>TCP DF Bearing Line</strong>
                <div>Anchor: {pointerAnchorAsset.name}</div>
                <div>Bearing: {latestTcpFrameWithBearing.bearingDeg.toFixed(1)} deg</div>
                <div>Field: {latestTcpFrameWithBearing.sourceKey} = {latestTcpFrameWithBearing.sourceValue}</div>
                <div>Length: {(TCP_DF_LINE_DISTANCE_METERS / 1000).toFixed(1)} km</div>
                <div>Frame Time: {latestTcpFrameWithBearing.frame.received_at ? new Date(latestTcpFrameWithBearing.frame.received_at).toLocaleString() : "-"}</div>
                <div>Protocol: {latestTcpFrameWithBearing.frame.protocol ?? "-"}</div>
              </div>
            </Popup>
          </CircleMarker>
          <Polyline
            positions={[tcpPointerLine.start, tcpPointerLine.end]}
            pathOptions={{ color: '#ef4444', weight: 4, dashArray: '8 6', opacity: 0.85 }}
          />
        </>
      )}
    </MapContainer>

    <MapOverlaysPanel
      dfRangeColor={dfRangeColor}
      showTransparencySlider={showTransparencySlider}
      onToggleTransparencySlider={() => setShowTransparencySlider((current) => !current)}
      jammerPopupAlpha={jammerPopupAlpha}
      onJammerPopupAlphaChange={setJammerPopupAlpha}
      showJammerColorPicker={showJammerColorPicker}
      onToggleJammerColorPicker={() => setShowJammerColorPicker((current) => !current)}
      jammerRangeColor={jammerRangeColor}
      onJammerRangeColorChange={setJammerRangeColor}
      showDfColorPicker={showDfColorPicker}
      onToggleDfColorPicker={() => setShowDfColorPicker((current) => !current)}
      onDfRangeColorChange={setDfRangeColor}
      showBaseMapSelector={showBaseMapSelector}
      onToggleBaseMapSelector={() => setShowBaseMapSelector((current) => !current)}
      baseMapId={baseMapId}
      onBaseMapSelectionChange={handleBaseMapSelectionChange}
      isOfflineBaseMap={isOfflineBaseMap}
      baseMapTileErrors={baseMapTileErrors}
      autoOfflineFallbackActive={autoOfflineFallbackActive}
      navigatorOnline={typeof navigator !== "undefined" ? navigator.onLine : false}
      currentViewAvailable={Boolean(currentView)}
      onSaveCurrentView={() => {
        if (!currentView) {
          return;
        }
        setSavedView(currentView);
      }}
      hasSavedView={Boolean(savedView)}
      onResetView={handleResetView}
      showAssets={showAssets}
      onToggleAssets={() => setShowAssets((current) => !current)}
      showSignals={showSignals}
      onToggleSignals={() => setShowSignals((current) => !current)}
      showHeatOverlay={showHeatOverlay}
      onToggleHeatOverlay={() => setShowHeatOverlay((current) => !current)}
      showTriangulationOverlay={showTriangulationOverlay}
      onToggleTriangulationOverlay={() => setShowTriangulationOverlay((current) => !current)}
      showNodeLabels={showNodeLabels}
      onToggleNodeLabels={() => setShowNodeLabels((current) => !current)}
      showAlerts={showAlerts}
      onToggleAlerts={() => setShowAlerts((current) => !current)}
      activeDrawShape={activeDrawShape}
      activeShapeMenuTop={activeShapeMenuTop}
      activeShapeColor={activeShapeColor}
      activeShapeLabel={activeShapeLabel}
      onActiveShapeColorChange={handleActiveShapeColorChange}
      mousePosition={mousePosition}
      assetTypeLegend={assetTypeLegend}
      triangulationLegendEntries={triangulationLegendEntries}
      showAssetLegend={showAssetLegend}
      onToggleAssetLegend={() => setShowAssetLegend((current) => !current)}
    />
    </div>
  );
}
