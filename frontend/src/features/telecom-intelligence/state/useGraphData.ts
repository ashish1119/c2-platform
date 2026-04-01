/**
 * useGraphData — universal data adapter for the Call Relationship Graph.
 *
 * Priority:
 *  1. If backend returns data → use it
 *  2. Otherwise → derive graph client-side from TelecomRecord[]
 *     (works with demo, CSV, and live stream data)
 *
 * Field normalisation:
 *  Caller  = msisdn || originator
 *  Receiver = recipient || target
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { TelecomRecord, TelecomFilters } from "../model";
import { getNetworkGraph, type GraphNode, type GraphLink, type NetworkGraphResponse } from "../../../api/cdr";

// ── Re-export so consumers only import from here ──────────────────────────────
export type { GraphNode, GraphLink, NetworkGraphResponse };

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  center_msisdn: string;
  total_records: number;
  /** ID of the most-connected contact node (highest degree centrality) */
  central_node_id: string | null;
}

// ── Client-side graph builder ─────────────────────────────────────────────────

export function buildGraphFromRecords(
  records: TelecomRecord[],
  msisdn: string,
): GraphData {
  // Normalise caller field
  const callerRecords = records.filter((r) => {
    const caller = r.msisdn || r.originator || "";
    return caller === msisdn || caller.includes(msisdn);
  });

  if (!callerRecords.length) {
    return { nodes: [], links: [], center_msisdn: msisdn, total_records: 0 };
  }

  // Centre node
  const fakeCount = callerRecords.filter((r) => r.fake).length;
  const silentCount = callerRecords.filter((r) => r.silentCallType !== "None").length;
  const centre: GraphNode = {
    id: msisdn, label: msisdn, type: "main",
    total_calls: callerRecords.length,
    total_duration: callerRecords.reduce((s, r) => s + (r.duration || 0), 0),
    operator: callerRecords[0].operator || null,
    network: callerRecords[0].network || null,
    device: callerRecords[0].deviceModel || null,
    location: callerRecords[0].gpsCity || callerRecords[0].place || null,
    imsi: callerRecords[0].imsi || null,
    imei: callerRecords[0].imei || null,
    suspicious: fakeCount > 0 || silentCount > 0,
    fake_count: fakeCount,
    silent_count: silentCount,
  };

  // Aggregate contacts — normalise receiver field
  const contactMap = new Map<string, {
    callCount: number; durSum: number; fakeCount: number; silentCount: number;
    callTypes: Set<string>; operator: string; network: string; location: string;
  }>();

  for (const r of callerRecords) {
    const receiver = r.recipient || r.target || r.smsReceiver || "";
    if (!receiver) continue;
    if (!contactMap.has(receiver)) {
      contactMap.set(receiver, {
        callCount: 0, durSum: 0, fakeCount: 0, silentCount: 0,
        callTypes: new Set(),
        operator: r.operator || "", network: r.network || "",
        location: r.gpsCity || r.place || "",
      });
    }
    const c = contactMap.get(receiver)!;
    c.callCount++;
    c.durSum += r.duration || 0;
    if (r.fake) c.fakeCount++;
    if (r.silentCallType !== "None") c.silentCount++;
    if (r.callType) c.callTypes.add(r.callType);
  }

  const maxCalls = Math.max(1, ...[...contactMap.values()].map((v) => v.callCount));

  // Sort by call count, cap at 100
  const sorted = [...contactMap.entries()]
    .sort((a, b) => b[1].callCount - a[1].callCount)
    .slice(0, 99);

  const nodes: GraphNode[] = [centre];
  const links: GraphLink[] = [];

  for (const [receiver, c] of sorted) {
    const suspicious = c.fakeCount > 0 || c.silentCount > 0;
    nodes.push({
      id: receiver, label: receiver, type: "contact",
      total_calls: c.callCount, total_duration: c.durSum,
      operator: c.operator || null, network: c.network || null,
      device: null, location: c.location || null,
      imsi: null, imei: null,
      suspicious, fake_count: c.fakeCount, silent_count: c.silentCount,
    });
    links.push({
      source: msisdn, target: receiver,
      count: c.callCount, duration: c.durSum,
      suspicious, call_types: [...c.callTypes].sort(),
      weight: c.callCount / maxCalls,
    });
  }

  return { nodes, links, center_msisdn: msisdn, total_records: callerRecords.length, central_node_id: sorted[0]?.[0] ?? null };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGraphData(
  records: TelecomRecord[],
  filters: TelecomFilters,
) {
  const [apiData, setApiData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const msisdn = filters.msisdn.trim();

  // Try backend first; fall back silently to client-side
  useEffect(() => {
    if (!msisdn) { setApiData(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getNetworkGraph({
          msisdn,
          start_date: filters.dateFrom || undefined,
          end_date: filters.dateTo || undefined,
          operator: filters.operator !== "All" ? filters.operator : undefined,
          network: filters.network !== "All" ? filters.network : undefined,
          fake_only: filters.fake === "Yes" ? true : undefined,
        });
        if (res.data.nodes.length > 0) setApiData({ ...res.data, central_node_id: res.data.nodes.filter(n => n.type === "contact").sort((a, b) => b.total_calls - a.total_calls)[0]?.id ?? null });
        else setApiData(null);
      } catch {
        setApiData(null); // fall through to client-side
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [msisdn, filters.dateFrom, filters.dateTo, filters.operator, filters.network, filters.fake]);

  // Client-side derivation (always available — demo/CSV/live)
  const clientData = useMemo(
    () => msisdn ? buildGraphFromRecords(records, msisdn) : null,
    [records, msisdn]
  );

  // Prefer API data if available, else client-side
  const graphData: GraphData | null = (apiData && apiData.nodes.length > 0) ? apiData : clientData;

  return { graphData, loading };
}
