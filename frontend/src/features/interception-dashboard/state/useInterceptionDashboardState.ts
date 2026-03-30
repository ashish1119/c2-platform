import { useEffect, useMemo, useState } from "react";
import { INTERCEPTION_SNAPSHOTS } from "../mockData";
import type { InterceptionSnapshot, InterceptionTimeWindowPreset } from "../model";

const SNAPSHOT_ROTATION_MS = 4000;
const EMPTY_SNAPSHOT: InterceptionSnapshot = {
  generatedAt: new Date(0).toISOString(),
  missionName: "Interception Dashboard",
  theater: "No source data available",
  posture: "Awaiting data",
  filters: [],
  reviewChecks: [],
  metrics: [],
  contacts: [],
  events: [],
  alerts: [],
  zones: [],
  platforms: [],
  directives: [],
};

function parseTimeWindowLabel(label: string) {
  const [startRaw, endRaw] = label.split(" to ");
  if (!startRaw || !endRaw) {
    return null;
  }

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return null;
  }

  return { start, end };
}

function windowBounds(snapshot: InterceptionSnapshot, preset: InterceptionTimeWindowPreset) {
  const timeWindowFilter = snapshot.filters.find((filter) => filter.id === "time_window");
  const parsed = timeWindowFilter ? parseTimeWindowLabel(timeWindowFilter.valueLabel) : null;
  if (!parsed) {
    return null;
  }

  if (preset === "full") {
    return parsed;
  }

  const midpoint = new Date(parsed.start.getTime() + (parsed.end.getTime() - parsed.start.getTime()) / 2);
  if (preset === "first_half") {
    return { start: parsed.start, end: midpoint };
  }

  return { start: midpoint, end: parsed.end };
}

function isWithinWindow(timestampUtc: string | undefined, bounds: { start: Date; end: Date } | null) {
  if (!bounds || !timestampUtc) {
    return true;
  }

  const value = new Date(timestampUtc);
  if (Number.isNaN(value.getTime())) {
    return true;
  }

  return value >= bounds.start && value <= bounds.end;
}

export function useInterceptionDashboardState() {
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [activeServiceTypes, setActiveServiceTypes] = useState<string[]>([]);
  const [timeWindowPreset, setTimeWindowPreset] = useState<InterceptionTimeWindowPreset>("full");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    INTERCEPTION_SNAPSHOTS[0]?.contacts[0]?.id ?? null
  );
  const hasSnapshots = INTERCEPTION_SNAPSHOTS.length > 0;

  useEffect(() => {
    if (!hasSnapshots) {
      return;
    }

    // Isolated mocked state makes the page easy to swap to a websocket/API store later.
    const intervalId = window.setInterval(() => {
      setSnapshotIndex((current) => (current + 1) % INTERCEPTION_SNAPSHOTS.length);
    }, SNAPSHOT_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [hasSnapshots]);

  const snapshot = INTERCEPTION_SNAPSHOTS[snapshotIndex] ?? EMPTY_SNAPSHOT;

  const serviceTypeFilter = snapshot.filters.find((filter) => filter.id === "service_type");
  const availableServiceTypes = serviceTypeFilter?.allowedValues ?? ["voice", "sms", "ott"];

  useEffect(() => {
    if (activeServiceTypes.length === 0) {
      setActiveServiceTypes(availableServiceTypes);
      return;
    }

    const normalized = activeServiceTypes.filter((service) => availableServiceTypes.includes(service));
    if (normalized.length !== activeServiceTypes.length) {
      setActiveServiceTypes(normalized);
    }
  }, [activeServiceTypes, availableServiceTypes]);

  const filteredSnapshot = useMemo(() => {
    const services = new Set(activeServiceTypes);
    const bounds = windowBounds(snapshot, timeWindowPreset);

    const contacts = snapshot.contacts.filter(
      (contact) => services.has("voice") && isWithinWindow(contact.observedAtUtc, bounds)
    );

    const events = snapshot.events.filter((event) => {
      const normalizedType = event.type.toLowerCase();
      if (normalizedType === "voice" && !services.has("voice")) {
        return false;
      }
      if (normalizedType === "sms" && !services.has("sms")) {
        return false;
      }
      if (normalizedType === "ott" && !services.has("ott")) {
        return false;
      }

      return isWithinWindow(event.timestampUtc, bounds);
    });

    const alerts = snapshot.alerts.filter((alert) => {
      if (alert.channel === "QA checks") {
        return services.has("voice");
      }
      if (alert.channel === "Policy enforcement") {
        return services.has("ott");
      }
      return true;
    });

    return {
      ...snapshot,
      contacts,
      events,
      alerts,
    };
  }, [activeServiceTypes, snapshot, timeWindowPreset]);

  function toggleServiceType(serviceType: string) {
    setActiveServiceTypes((current) => {
      if (current.includes(serviceType)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((entry) => entry !== serviceType);
      }
      return [...current, serviceType];
    });
  }

  useEffect(() => {
    if (!filteredSnapshot.contacts.some((contact) => contact.id === selectedContactId)) {
      setSelectedContactId(filteredSnapshot.contacts[0]?.id ?? null);
    }
  }, [filteredSnapshot, selectedContactId]);

  const selectedContact = useMemo(
    () => filteredSnapshot.contacts.find((contact) => contact.id === selectedContactId) ?? filteredSnapshot.contacts[0] ?? null,
    [filteredSnapshot, selectedContactId]
  );

  const filterCounts = useMemo(
    () => ({
      contacts: {
        shown: filteredSnapshot.contacts.length,
        total: snapshot.contacts.length,
      },
      events: {
        shown: filteredSnapshot.events.length,
        total: snapshot.events.length,
      },
      alerts: {
        shown: filteredSnapshot.alerts.length,
        total: snapshot.alerts.length,
      },
    }),
    [filteredSnapshot.alerts.length, filteredSnapshot.contacts.length, filteredSnapshot.events.length, snapshot.alerts.length, snapshot.contacts.length, snapshot.events.length]
  );

  return {
    snapshot: filteredSnapshot,
    filterCounts,
    selectedContact,
    selectedContactId,
    activeServiceTypes,
    availableServiceTypes,
    timeWindowPreset,
    setTimeWindowPreset,
    toggleServiceType,
    setSelectedContactId,
  };
}