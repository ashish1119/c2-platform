import type { CSSProperties, ReactNode } from "react";
import Card from "../../../components/ui/Card";
import { useTheme } from "../../../context/ThemeContext";
import type {
  InterceptionAlert,
  InterceptionContact,
  InterceptionFilterPreset,
  InterceptionPlatformStatus,
  InterceptionReviewCheck,
  InterceptionSeverity,
  InterceptionSnapshot,
  InterceptionTimeWindowPreset,
  InterceptionZone,
} from "../model";
import "./interceptionDashboard.css";

type InterceptionDashboardViewProps = {
  snapshot: InterceptionSnapshot;
  filterCounts: {
    contacts: { shown: number; total: number };
    events: { shown: number; total: number };
    alerts: { shown: number; total: number };
  };
  selectedContactId: string | null;
  selectedContact: InterceptionContact | null;
  activeServiceTypes: string[];
  availableServiceTypes: string[];
  timeWindowPreset: InterceptionTimeWindowPreset;
  onToggleServiceType: (serviceType: string) => void;
  onSetTimeWindowPreset: (preset: InterceptionTimeWindowPreset) => void;
  onSelectContact: (contactId: string) => void;
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function severityColor(theme: ReturnType<typeof useTheme>["theme"], severity: InterceptionSeverity) {
  switch (severity) {
    case "critical":
      return theme.colors.danger;
    case "warning":
      return theme.colors.warning;
    case "info":
      return theme.colors.info;
    case "stable":
      return theme.colors.success;
    default:
      return theme.colors.textMuted;
  }
}

function contactPriorityColor(
  theme: ReturnType<typeof useTheme>["theme"],
  priority: InterceptionContact["priority"]
) {
  if (priority === "high") {
    return theme.colors.danger;
  }
  if (priority === "medium") {
    return theme.colors.warning;
  }
  return theme.colors.info;
}

function panelHeaderText(theme: ReturnType<typeof useTheme>["theme"]): CSSProperties {
  return {
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  };
}

function InterceptionPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.md, alignItems: "flex-start" }}>
        <div>
          <div style={panelHeaderText(theme)}>{title}</div>
          {subtitle ? (
            <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>{subtitle}</div>
          ) : null}
        </div>
        {action}
      </div>
      <div style={{ marginTop: theme.spacing.md }}>{children}</div>
    </Card>
  );
}

function TonePill({ label, tone }: { label: string; tone: InterceptionSeverity }) {
  const { theme } = useTheme();
  const color = severityColor(theme, tone);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        color,
        background: hexToRgba(color, theme.mode === "dark" ? 0.18 : 0.1),
        border: `1px solid ${hexToRgba(color, theme.mode === "dark" ? 0.38 : 0.2)}`,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function formatFilterType(type: InterceptionFilterPreset["type"]) {
  if (type === "single_select") {
    return "single select";
  }
  if (type === "multi_select") {
    return "multi select";
  }
  if (type === "time_range") {
    return "time range";
  }
  return "schema";
}

function MetricStrip({ snapshot }: { snapshot: InterceptionSnapshot }) {
  const { theme } = useTheme();

  return (
    <div className="interception-dashboard__metric-grid">
      {snapshot.metrics.map((metric) => {
        const color = severityColor(theme, metric.tone);

        return (
          <Card key={metric.id}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={panelHeaderText(theme)}>{metric.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: theme.colors.textPrimary }}>{metric.value}</span>
                {metric.unit ? <span style={{ color: theme.colors.textSecondary }}>{metric.unit}</span> : null}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{metric.delta}</span>
                <TonePill label={metric.trend} tone={metric.tone} />
              </div>
              <div style={{ height: 4, borderRadius: 999, background: theme.colors.surfaceAlt, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(metric.value, 100)}%`, background: color }} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function MissionOverview({ snapshot }: { snapshot: InterceptionSnapshot }) {
  const { theme, mode } = useTheme();
  const generatedAt = new Date(snapshot.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="interception-dashboard__hero">
      <Card>
        <div style={{ display: "grid", gap: theme.spacing.md }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={panelHeaderText(theme)}>Operator Integration</div>
              <div style={{ fontSize: theme.typography.h2.fontSize, fontWeight: theme.typography.h2.fontWeight }}>
                {snapshot.missionName}
              </div>
              <div style={{ marginTop: 6, color: theme.colors.textSecondary }}>{snapshot.theater}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TonePill label="live mock feed" tone="info" />
              <TonePill label={snapshot.posture} tone="stable" />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.border}`,
              background: mode === "dark" ? hexToRgba(theme.colors.surfaceAlt, 0.4) : hexToRgba(theme.colors.surfaceAlt, 0.65),
            }}
          >
            <div>
              <div style={panelHeaderText(theme)}>Routing fit</div>
              <div style={{ color: theme.colors.textSecondary }}>Operator page under shared AppLayout, Sidebar, and Topbar title mapping.</div>
            </div>
            <div>
              <div style={panelHeaderText(theme)}>Layout hierarchy</div>
              <div style={{ color: theme.colors.textSecondary }}>Mission summary, metric strip, two-column operational workspace, dense logs and alerts.</div>
            </div>
            <div>
              <div style={panelHeaderText(theme)}>State model</div>
              <div style={{ color: theme.colors.textSecondary }}>Feature-local hook with snapshot rotation, later replaceable by websocket or query cache.</div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: theme.spacing.md }}>
          <div>
            <div style={panelHeaderText(theme)}>Feed health</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>Nominal</div>
            <div style={{ color: theme.colors.textSecondary, marginTop: 6 }}>Last operator refresh {generatedAt}</div>
          </div>

          <div className="interception-dashboard__panel-grid">
            {snapshot.directives.map((directive, index) => (
              <div
                key={directive}
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.surfaceAlt,
                }}
              >
                <div style={panelHeaderText(theme)}>Directive {index + 1}</div>
                <div style={{ color: theme.colors.textSecondary, lineHeight: 1.45 }}>{directive}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function buttonStyle(isActive: boolean, theme: ReturnType<typeof useTheme>["theme"]): CSSProperties {
  return {
    borderRadius: 999,
    padding: "6px 12px",
    border: `1px solid ${isActive ? theme.colors.info : theme.colors.border}`,
    background: isActive ? hexToRgba(theme.colors.info, theme.mode === "dark" ? 0.22 : 0.12) : theme.colors.surface,
    color: isActive ? theme.colors.info : theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function FilterPresetsPanel({
  filters,
  filterCounts,
  activeServiceTypes,
  availableServiceTypes,
  timeWindowPreset,
  onToggleServiceType,
  onSetTimeWindowPreset,
}: {
  filters: InterceptionFilterPreset[];
  filterCounts: {
    contacts: { shown: number; total: number };
    events: { shown: number; total: number };
    alerts: { shown: number; total: number };
  };
  activeServiceTypes: string[];
  availableServiceTypes: string[];
  timeWindowPreset: InterceptionTimeWindowPreset;
  onToggleServiceType: (serviceType: string) => void;
  onSetTimeWindowPreset: (preset: InterceptionTimeWindowPreset) => void;
}) {
  const { theme } = useTheme();

  return (
    <InterceptionPanel
      title="Schema filters"
      subtitle="Global controls mapped from synthetic schema workbook definitions."
      action={
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <TonePill label={`C ${filterCounts.contacts.shown}/${filterCounts.contacts.total}`} tone="info" />
          <TonePill label={`E ${filterCounts.events.shown}/${filterCounts.events.total}`} tone="warning" />
          <TonePill label={`A ${filterCounts.alerts.shown}/${filterCounts.alerts.total}`} tone="stable" />
        </div>
      }
    >
      <div className="interception-dashboard__panel-grid">
        {filters.map((filter) => (
          <div
            key={filter.id}
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surfaceAlt,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong style={{ textTransform: "capitalize" }}>{filter.label}</strong>
              <TonePill label={formatFilterType(filter.type)} tone="info" />
            </div>
            <div style={{ color: theme.colors.textSecondary, lineHeight: 1.45 }}>{filter.valueLabel}</div>
            {filter.id === "service_type" ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {availableServiceTypes.map((service) => {
                  const active = activeServiceTypes.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() => onToggleServiceType(service)}
                      style={buttonStyle(active, theme)}
                    >
                      {service.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {filter.id === "time_window" ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onSetTimeWindowPreset("full")}
                  style={buttonStyle(timeWindowPreset === "full", theme)}
                >
                  Full window
                </button>
                <button
                  type="button"
                  onClick={() => onSetTimeWindowPreset("first_half")}
                  style={buttonStyle(timeWindowPreset === "first_half", theme)}
                >
                  First half
                </button>
                <button
                  type="button"
                  onClick={() => onSetTimeWindowPreset("second_half")}
                  style={buttonStyle(timeWindowPreset === "second_half", theme)}
                >
                  Second half
                </button>
              </div>
            ) : null}
            {filter.source ? (
              <div style={{ color: theme.colors.textMuted, fontSize: 12 }}>source: {filter.source}</div>
            ) : null}
          </div>
        ))}
      </div>
    </InterceptionPanel>
  );
}

function reviewTone(check: InterceptionReviewCheck): InterceptionSeverity {
  if (check.result === "fail") {
    return "critical";
  }
  if (check.result === "warn") {
    return "warning";
  }
  return check.tone;
}

function ReviewChecksPanel({ checks }: { checks: InterceptionReviewCheck[] }) {
  const { theme } = useTheme();

  return (
    <InterceptionPanel
      title="Review checks"
      subtitle="Compliance and QA checks generated from schema review table semantics."
    >
      <div className="interception-dashboard__panel-grid">
        {checks.map((check) => (
          <div
            key={check.id}
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surfaceAlt,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{check.label}</strong>
              <TonePill label={check.result.toUpperCase()} tone={reviewTone(check)} />
            </div>
            <div style={{ color: theme.colors.textSecondary, lineHeight: 1.45 }}>{check.detail}</div>
          </div>
        ))}
      </div>
    </InterceptionPanel>
  );
}

function ContactMatrix({
  contacts,
  selectedContactId,
  onSelectContact,
}: {
  contacts: InterceptionContact[];
  selectedContactId: string | null;
  onSelectContact: (contactId: string) => void;
}) {
  const { theme } = useTheme();

  return (
    <InterceptionPanel title="Real-time data panels" subtitle="High-density intercept contact matrix with operator-ready prioritization.">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: theme.colors.textMuted }}>
              {["Track", "Class", "Freq", "Bearing", "Confidence", "Source", "State"].map((header) => (
                <th key={header} style={{ padding: `0 0 ${theme.spacing.sm} 0`, fontWeight: 600 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const isSelected = contact.id === selectedContactId;
              const accent = contactPriorityColor(theme, contact.priority);

              return (
                <tr
                  key={contact.id}
                  onClick={() => onSelectContact(contact.id)}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? hexToRgba(accent, theme.mode === "dark" ? 0.14 : 0.08) : "transparent",
                  }}
                >
                  <td style={{ padding: `${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.md} 0`, borderTop: `1px solid ${theme.colors.border}` }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ color: theme.colors.textPrimary }}>{contact.callsign}</strong>
                      <span style={{ color: theme.colors.textMuted }}>{contact.lastSeenLabel}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing.md} ${theme.spacing.sm}`, borderTop: `1px solid ${theme.colors.border}`, color: theme.colors.textSecondary }}>
                    {contact.classification}
                  </td>
                  <td style={{ padding: `${theme.spacing.md} ${theme.spacing.sm}`, borderTop: `1px solid ${theme.colors.border}` }}>{contact.frequencyMHz.toFixed(3)} MHz</td>
                  <td style={{ padding: `${theme.spacing.md} ${theme.spacing.sm}`, borderTop: `1px solid ${theme.colors.border}` }}>{contact.bearing}°</td>
                  <td style={{ padding: `${theme.spacing.md} ${theme.spacing.sm}`, borderTop: `1px solid ${theme.colors.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 999, background: theme.colors.surfaceAlt, overflow: "hidden", minWidth: 60 }}>
                        <div style={{ height: "100%", width: `${contact.confidence}%`, background: accent }} />
                      </div>
                      <span>{contact.confidence}%</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing.md} ${theme.spacing.sm}`, borderTop: `1px solid ${theme.colors.border}`, color: theme.colors.textSecondary }}>
                    {contact.source}
                  </td>
                  <td style={{ padding: `${theme.spacing.md} 0 ${theme.spacing.md} ${theme.spacing.sm}`, borderTop: `1px solid ${theme.colors.border}` }}>
                    <TonePill label={contact.status} tone={contact.priority === "high" ? "critical" : contact.priority === "medium" ? "warning" : "info"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </InterceptionPanel>
  );
}

function GeospatialOverview({
  zones,
  contacts,
  selectedContact,
}: {
  zones: InterceptionZone[];
  contacts: InterceptionContact[];
  selectedContact: InterceptionContact | null;
}) {
  const { theme } = useTheme();

  return (
    <InterceptionPanel
      title="Geospatial visualization"
      subtitle={selectedContact ? `Focused on ${selectedContact.callsign} at ${selectedContact.bearing}° / ${selectedContact.frequencyMHz.toFixed(3)} MHz.` : "Coverage zones and intercept geometry."}
      action={selectedContact ? <TonePill label={selectedContact.callsign} tone="critical" /> : null}
    >
      <div
        style={{
          position: "relative",
          minHeight: 330,
          borderRadius: theme.radius.md,
          overflow: "hidden",
          border: `1px solid ${theme.colors.border}`,
          background: `linear-gradient(180deg, ${hexToRgba(theme.colors.surfaceAlt, 0.65)} 0%, ${hexToRgba(theme.colors.background, 0.9)} 100%)`,
        }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
          {Array.from({ length: 9 }, (_, index) => {
            const offset = (index + 1) * 10;
            return (
              <g key={offset}>
                <line x1={offset} y1={0} x2={offset} y2={100} stroke={hexToRgba(theme.colors.border, 0.7)} strokeWidth={0.35} />
                <line x1={0} y1={offset} x2={100} y2={offset} stroke={hexToRgba(theme.colors.border, 0.7)} strokeWidth={0.35} />
              </g>
            );
          })}

          {zones.map((zone) => {
            const color = zone.status === "covered" ? theme.colors.success : zone.status === "contested" ? theme.colors.warning : theme.colors.danger;
            const points = zone.polygon.map((point) => `${point.x},${point.y}`).join(" ");

            return (
              <polygon
                key={zone.id}
                points={points}
                fill={hexToRgba(color, 0.16)}
                stroke={hexToRgba(color, 0.8)}
                strokeWidth={0.8}
              />
            );
          })}

          {contacts.map((contact) => {
            const isSelected = contact.id === selectedContact?.id;
            const color = contactPriorityColor(theme, contact.priority);

            return (
              <g key={contact.id}>
                <circle cx={contact.location.x} cy={contact.location.y} r={isSelected ? 4.2 : 2.4} fill={hexToRgba(color, isSelected ? 0.18 : 0.1)} stroke="none" />
                <circle cx={contact.location.x} cy={contact.location.y} r={isSelected ? 2.1 : 1.4} fill={color} stroke="#ffffff" strokeWidth={0.6} />
                {isSelected ? (
                  <line x1={contact.location.x} y1={contact.location.y} x2={contact.location.x + 8} y2={contact.location.y - 6} stroke={color} strokeWidth={0.7} />
                ) : null}
              </g>
            );
          })}
        </svg>

        <div style={{ position: "absolute", inset: 12, pointerEvents: "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <TonePill label="covered" tone="stable" />
            <TonePill label="contested" tone="warning" />
            <TonePill label="blind" tone="critical" />
          </div>
          <div style={{ textAlign: "right", color: theme.colors.textSecondary, fontSize: 12 }}>
            <div>Sector grid view</div>
            <div>Abstracted for operator context</div>
          </div>
        </div>
      </div>

      <div className="interception-dashboard__panel-grid" style={{ marginTop: 12 }}>
        {zones.map((zone) => (
          <div
            key={zone.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto auto",
              gap: 12,
              alignItems: "center",
              padding: theme.spacing.sm,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{zone.name}</div>
              <div style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{zone.status}</div>
            </div>
            <div style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Coverage {zone.coveragePercent}%</div>
            <div style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Risk {zone.riskPercent}%</div>
          </div>
        ))}
      </div>
    </InterceptionPanel>
  );
}

function PlatformStatusRail({ platforms }: { platforms: InterceptionPlatformStatus[] }) {
  const { theme } = useTheme();

  return (
    <InterceptionPanel title="Status indicators" subtitle="Collector, network, and fusion health at a glance.">
      <div className="interception-dashboard__panel-grid">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            style={{
              display: "grid",
              gap: 8,
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surfaceAlt,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{platform.label}</strong>
              <TonePill label={platform.value} tone={platform.state} />
            </div>
            <div style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 1.45 }}>{platform.detail}</div>
          </div>
        ))}
      </div>
    </InterceptionPanel>
  );
}

function AlertsRail({ alerts }: { alerts: InterceptionAlert[] }) {
  const { theme } = useTheme();

  return (
    <InterceptionPanel title="Alerts" subtitle="Current operator warnings, escalations, and acknowledged mission notices.">
      <div className="interception-dashboard__panel-grid">
        {alerts.map((alert) => {
          const color = severityColor(theme, alert.severity);

          return (
            <div
              key={alert.id}
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                border: `1px solid ${hexToRgba(color, 0.35)}`,
                background: hexToRgba(color, theme.mode === "dark" ? 0.12 : 0.08),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <strong>{alert.title}</strong>
                <TonePill label={alert.status} tone={alert.severity} />
              </div>
              <div style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 1.45 }}>{alert.detail}</div>
              <div style={{ marginTop: 10, color: theme.colors.textMuted, fontSize: 12 }}>{alert.channel}</div>
            </div>
          );
        })}
      </div>
    </InterceptionPanel>
  );
}

function EventLog({ snapshot }: { snapshot: InterceptionSnapshot }) {
  const { theme } = useTheme();

  return (
    <InterceptionPanel title="Event / interception logs" subtitle="Recent correlation, acquisition, and mission workflow changes.">
      <div className="interception-dashboard__panel-grid">
        {snapshot.events.map((event) => {
          const color = severityColor(theme, event.severity);

          return (
            <div
              key={event.id}
              style={{
                display: "grid",
                gridTemplateColumns: "110px minmax(0, 1fr)",
                gap: theme.spacing.md,
                paddingTop: theme.spacing.md,
                borderTop: `1px solid ${theme.colors.border}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{event.timeLabel}</div>
                <div style={{ color: color, fontSize: 12, marginTop: 4 }}>{event.type}</div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{event.actor}</strong>
                  <span style={{ color: theme.colors.textMuted, fontSize: 12 }}>{event.outcome}</span>
                </div>
                <div style={{ color: theme.colors.textSecondary, lineHeight: 1.5 }}>{event.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </InterceptionPanel>
  );
}

export default function InterceptionDashboardView({
  snapshot,
  filterCounts,
  selectedContactId,
  selectedContact,
  activeServiceTypes,
  availableServiceTypes,
  timeWindowPreset,
  onToggleServiceType,
  onSetTimeWindowPreset,
  onSelectContact,
}: InterceptionDashboardViewProps) {
  return (
    <div className="interception-dashboard">
      <MissionOverview snapshot={snapshot} />
      <MetricStrip snapshot={snapshot} />

      <div className="interception-dashboard__content">
        <div className="interception-dashboard__stack">
          <FilterPresetsPanel
            filters={snapshot.filters}
            filterCounts={filterCounts}
            activeServiceTypes={activeServiceTypes}
            availableServiceTypes={availableServiceTypes}
            timeWindowPreset={timeWindowPreset}
            onToggleServiceType={onToggleServiceType}
            onSetTimeWindowPreset={onSetTimeWindowPreset}
          />
          <ContactMatrix
            contacts={snapshot.contacts}
            selectedContactId={selectedContactId}
            onSelectContact={onSelectContact}
          />
          <EventLog snapshot={snapshot} />
        </div>

        <div className="interception-dashboard__stack">
          <ReviewChecksPanel checks={snapshot.reviewChecks} />
          <GeospatialOverview zones={snapshot.zones} contacts={snapshot.contacts} selectedContact={selectedContact} />
          <PlatformStatusRail platforms={snapshot.platforms} />
          <AlertsRail alerts={snapshot.alerts} />
        </div>
      </div>
    </div>
  );
}