// import { useMemo } from "react";
// import { Link, useLocation, useNavigate } from "react-router-dom";
// import AppLayout from "../../components/layout/AppLayout";
// import PageContainer from "../../components/layout/PageContainer";
// import Card from "../../components/ui/Card";
// import AlertTable from "../../components/AlertTable";
// import InterceptionDashboardView from "../../features/interception-dashboard/components/InterceptionDashboardView";
// import { useInterceptionDashboardState } from "../../features/interception-dashboard/state/useInterceptionDashboardState";
// import SimulationTestingDashboardView from "../../features/simulation-testing/components/SimulationTestingDashboardView";
// import { useSimulationTestingDashboard } from "../../features/simulation-testing/state/useSimulationTestingDashboard";
// import { useTheme } from "../../context/ThemeContext";

// type CommandSection = "overview" | "interception" | "alerts" | "validation";

// const SECTION_LABELS: Record<CommandSection, string> = {
//   overview: "Mission Overview",
//   interception: "Interception",
//   alerts: "Alert Triage",
//   validation: "Simulation Validation",
// };

// function parseSection(value: string | null): CommandSection {
//   if (value === "interception" || value === "alerts" || value === "validation") {
//     return value;
//   }
//   return "overview";
// }

// function SectionButton({
//   active,
//   label,
//   onClick,
// }: {
//   active: boolean;
//   label: string;
//   onClick: () => void;
// }) {
//   const { theme } = useTheme();

//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       style={{
//         border: active ? "none" : `1px solid ${theme.colors.border}`,
//         borderRadius: "999px", // pill shape (TREND)
//         background: active
//           ? "linear-gradient(135deg, #6366f1, #8b5cf6)" // modern gradient
//           : "rgba(255,255,255,0.05)",
//         color: active ? "#fff" : theme.colors.textPrimary,
//         padding: "10px 18px",
//         cursor: "pointer",
//         fontWeight: 600,
//         fontSize: "14px",
//         letterSpacing: "0.3px",
//         transition: "all 0.25s ease",
//         boxShadow: active
//           ? "0 4px 14px rgba(99,102,241,0.4)"
//           : "0 2px 6px rgba(0,0,0,0.15)",
//         backdropFilter: "blur(8px)",
//       }}
//       onMouseEnter={(e) => {
//         if (!active) {
//           e.currentTarget.style.background =
//             "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))";
//         }
//       }}
//       onMouseLeave={(e) => {
//         if (!active) {
//           e.currentTarget.style.background = "rgba(255,255,255,0.05)";
//         }
//       }}
//     >
//       {label}
//     </button>
//   );
// }

// function MissionOverview() {
//   const { theme } = useTheme();

//   return (
//     <div style={{ display: "grid", gap: theme.spacing.lg }}>
      
//       {/* TOP INTRO CARD */}
//       <Card>
//         <div
//           style={{
//             display: "grid",
//             gap: theme.spacing.sm,
//             textAlign: "center",
//             padding: "10px 0",
//           }}
//         >
//           <h2
//             style={{
//               margin: 0,
//               fontSize: "24px",
//               fontWeight: 700,
//               letterSpacing: "-0.3px",
//             }}
//           >
//             Command and Control Workflow
//           </h2>

//           <p
//             style={{
//               margin: 0,
//               color: theme.colors.textSecondary,
//               fontSize: "14px",
//               maxWidth: "600px",
//               justifySelf: "center",
//               lineHeight: 1.6,
//             }}
//           >
//             This workspace merges interception intelligence, alert triage, and
//             simulation validation into one operator surface. Use linked tools
//             for deeper tactical control.
//           </p>
//         </div>
//       </Card>

//       {/* GRID CARDS */}
//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
//           gap: theme.spacing.md,
//         }}
//       >
//         {/* CARD 1 */}
//         <Card>
//           <div
//             style={{
//               display: "grid",
//               gap: theme.spacing.sm,
//               padding: "10px",
//               borderRadius: "14px",
//               background: "rgba(255,255,255,0.03)",
//               backdropFilter: "blur(8px)",
//               transition: "all 0.25s ease",
//             }}
//           >
//             <div style={{ fontWeight: 700, fontSize: "16px" }}>
//               Live RF Operations
//             </div>

//             <div
//               style={{
//                 color: theme.colors.textSecondary,
//                 fontSize: "13px",
//                 lineHeight: 1.5,
//               }}
//             >
//               Spectrum ingest, detection telemetry, DF triangulation, and stream sessions.
//             </div>

//             <Link
//               to="/operator/dashboard"
//               style={{
//                 color: "#6366f1",
//                 fontWeight: 600,
//                 fontSize: "13px",
//                 textDecoration: "none",
//               }}
//             >
//               → Open RF Operations
//             </Link>
//           </div>
//         </Card>

//         {/* CARD 2 */}
//         <Card>
//           <div
//             style={{
//               display: "grid",
//               gap: theme.spacing.sm,
//               padding: "10px",
//               borderRadius: "14px",
//               background: "rgba(255,255,255,0.03)",
//               backdropFilter: "blur(8px)",
//             }}
//           >
//             <div style={{ fontWeight: 700, fontSize: "16px" }}>
//               Map and Field Picture
//             </div>

//             <div style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
//               Correlate assets, alerts, signals, and heat-map overlays.
//             </div>

//             <Link
//               to="/operator/map"
//               style={{
//                 color: "#6366f1",
//                 fontWeight: 600,
//                 fontSize: "13px",
//                 textDecoration: "none",
//               }}
//             >
//               → Open Tactical Map
//             </Link>
//           </div>
//         </Card>

//         {/* CARD 3 */}
//         <Card>
//           <div
//             style={{
//               display: "grid",
//               gap: theme.spacing.sm,
//               padding: "10px",
//               borderRadius: "14px",
//               background: "rgba(255,255,255,0.03)",
//               backdropFilter: "blur(8px)",
//             }}
//           >
//             <div style={{ fontWeight: 700, fontSize: "16px" }}>
//               RF Scenario Lab
//             </div>

//             <div style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
//               Generate synthetic RF/DF conditions and test scenarios.
//             </div>

//             <Link
//               to="/operator/simulation"
//               style={{
//                 color: "#6366f1",
//                 fontWeight: 600,
//                 fontSize: "13px",
//                 textDecoration: "none",
//               }}
//             >
//               → Open Signal Lab
//             </Link>
//           </div>
//         </Card>

//         {/* CARD 4 */}
//         <Card>
//           <div
//             style={{
//               display: "grid",
//               gap: theme.spacing.sm,
//               padding: "10px",
//               borderRadius: "14px",
//               background: "rgba(255,255,255,0.03)",
//               backdropFilter: "blur(8px)",
//             }}
//           >
//             <div style={{ fontWeight: 700, fontSize: "16px" }}>
//               Network Sensor Link
//             </div>

//             <div style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
//               Validate listener health and connectivity reliability.
//             </div>

//             <Link
//               to="/operator/tcp-client"
//               style={{
//                 color: "#6366f1",
//                 fontWeight: 600,
//                 fontSize: "13px",
//                 textDecoration: "none",
//               }}
//             >
//               → Open TCP Control
//             </Link>
//           </div>
//         </Card>
//       </div>
//     </div>
//   );
// }

// function InterceptionSection() {
//   const state = useInterceptionDashboardState();

//   return (
//     <InterceptionDashboardView
//       snapshot={state.snapshot}
//       filterCounts={state.filterCounts}
//       selectedContact={state.selectedContact}
//       selectedContactId={state.selectedContactId}
//       activeServiceTypes={state.activeServiceTypes}
//       availableServiceTypes={state.availableServiceTypes}
//       timeWindowPreset={state.timeWindowPreset}
//       onToggleServiceType={state.toggleServiceType}
//       onSetTimeWindowPreset={state.setTimeWindowPreset}
//       onSelectContact={state.setSelectedContactId}
//     />
//   );
// }

// function SimulationValidationSection() {
//   const state = useSimulationTestingDashboard();

//   return (
//     <SimulationTestingDashboardView
//       templates={state.templates}
//       selectedTemplateId={state.selectedTemplateId}
//       config={state.config}
//       activeRun={state.activeRun}
//       runHistory={state.runHistory}
//       guardrails={state.guardrails}
//       canExecute={state.canExecute}
//       publishedRunId={state.publishedRunId}
//       onTemplateChange={state.applyTemplate}
//       onConfigChange={state.updateConfig}
//       onVolumeChange={state.updateVolumes}
//       onErrorToggle={state.updateErrors}
//       onGenerateRun={state.generateRun}
//       onRerunFailedChecks={state.rerunFailedChecks}
//       onPublishActiveRun={state.publishActiveRun}
//       onOpenHistoricalRun={state.openHistoricalRun}
//       onPublishHistoricalRun={state.publishHistoricalRun}
//       onClearPublishedRun={state.clearPublishedRun}
//     />
//   );
// }

// export default function OperatorCommandCenterPage() {
//   const { theme } = useTheme();
//   const location = useLocation();
//   const navigate = useNavigate();

//   const activeSection = useMemo(
//     () => parseSection(new URLSearchParams(location.search).get("section")),
//     [location.search]
//   );

//   const setSection = (section: CommandSection) => {
//     navigate(`/operator/command-center?section=${section}`, { replace: true });
//   };

//   return (
//     <AppLayout>
//       <PageContainer title="Operator Command Center">
//         <div style={{ display: "grid", gap: theme.spacing.lg }}>
// <div
//   style={{
//     display: "flex",
//     flexDirection: "column", // STACKED (modern dashboards)
//     alignItems: "center",
//     textAlign: "center",
//     gap: theme.spacing.md,
//   }}
// >            <div>
//               <h2
//   style={{
//     margin: 0,
//     fontSize: "28px",
//     fontWeight: 700,
//     letterSpacing: "-0.5px",
//   }}
// >
//   Operator Command Center
// </h2>

// <div
//   style={{
//     color: theme.colors.textSecondary,
//     fontSize: "14px",
//     maxWidth: "600px",
//   }}
// >
//   Unified operations surface for mission context, intelligence, alert triage, and simulation assurance.
// </div>
//             </div>
//           <div
//   style={{
//     display: "flex",
//     justifyContent: "center", // CENTER ALIGN
//     alignItems: "center",
//     gap: theme.spacing.md,
//     flexWrap: "wrap",
//     padding: "10px",
//     borderRadius: "14px",
//     background: "rgba(255,255,255,0.04)", // subtle glass bg
//     backdropFilter: "blur(10px)",
//   }}
// >
//               {(Object.keys(SECTION_LABELS) as CommandSection[]).map((section) => (
//                 <SectionButton
//                   key={section}
//                   active={activeSection === section}
//                   label={SECTION_LABELS[section]}
//                   onClick={() => setSection(section)}
//                 />
//               ))}
//             </div>
//           </div>

//           {activeSection === "overview" && <MissionOverview />}
//           {activeSection === "interception" && <InterceptionSection />}
//           {activeSection === "alerts" && (
//             <Card>
//               <AlertTable />
//             </Card>
//           )}
//           {activeSection === "validation" && <SimulationValidationSection />}
//         </div>
//       </PageContainer>
//     </AppLayout>
//   );
// }


import React from "react";
import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import AlertTable from "../../components/AlertTable";
import InterceptionDashboardView from "../../features/interception-dashboard/components/InterceptionDashboardView";
import { useInterceptionDashboardState } from "../../features/interception-dashboard/state/useInterceptionDashboardState";
import SimulationTestingDashboardView from "../../features/simulation-testing/components/SimulationTestingDashboardView";
import { useSimulationTestingDashboard } from "../../features/simulation-testing/state/useSimulationTestingDashboard";
import { useTheme } from "../../context/ThemeContext";

type CommandSection = "overview" | "interception" | "alerts" | "validation";

const SECTION_LABELS: Record<CommandSection, string> = {
  overview: "Mission Overview",
  interception: "Interception",
  alerts: "Alert Triage",
  validation: "Simulation Validation",
};

function parseSection(value: string | null): CommandSection {
  if (value === "interception" || value === "alerts" || value === "validation") {
    return value;
  }
  return "overview";
}

/* 🔥 GLASS BUTTON */
function SectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const { theme, mode } = useTheme();
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: "999px",
        padding: "10px 22px",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        letterSpacing: "0.4px",

        // 🔹 TEXT
        color: active
          ? "#ffffff"
          : isDark
          ? "#cbd5f5"
          : "#334155",

        // 🔹 BACKGROUND
        background: active
          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
          : isDark
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.04)",

        // 🔹 GLASS EFFECT
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",

        // 🔹 SHADOW
        boxShadow: active
          ? "0 8px 25px rgba(99,102,241,0.4)"
          : isDark
          ? "0 2px 10px rgba(0,0,0,0.25)"
          : "0 2px 10px rgba(0,0,0,0.08)",

        // 🔹 SMOOTH ANIMATION
        transition: "all 0.3s ease",

        // 🔹 BETTER LAYOUT (prevents stretching)
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.background = isDark
            ? "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))"
            : "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))";

          e.currentTarget.style.boxShadow =
            "0 10px 30px rgba(99,102,241,0.25)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.background = isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.04)";
          e.currentTarget.style.boxShadow = isDark
            ? "0 2px 10px rgba(0,0,0,0.25)"
            : "0 2px 10px rgba(0,0,0,0.08)";
        }
      }}
    >
      {label}
    </button>
  );
}

/* 🔥 UI WRAPPER INSIDE CARD (to avoid Card override issue) */

function GlassInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, mode } = useTheme();
  const isDark = mode === "dark";

  return (
    <div
      style={{
        padding: "18px",
        borderRadius: "16px",

        // ✅ BACKGROUND (adaptive glass)
        background: isDark
          ? "rgba(255,255,255,0.05)"
          : "rgba(0,0,0,0.03)",

        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",

        // ✅ BORDER
        border: `1px solid ${
          isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
        }`,

        // ✅ SHADOW (lighter in light mode)
        boxShadow: isDark
          ? "0 8px 24px rgba(0,0,0,0.35)"
          : "0 8px 24px rgba(0,0,0,0.08)",

        transition: "all 0.25s ease",
      }}
    >
      {children}
    </div>
  );
}

function MissionOverview() {
  const { theme } = useTheme();

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      
      {/* TOP CARD */}
      <Card>
        <GlassInner>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "26px", fontWeight: 700 }}>
              Command & Control Workflow
            </h2>
            <p style={{ color: theme.colors.textSecondary, fontSize: "14px" }}>
              Unified intelligence, alerts, and simulation in one interface.
            </p>
          </div>
        </GlassInner>
      </Card>

      {/* GRID CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "20px",
        }}
      >
        {[
          {
            title: "Live RF Operations",
            desc: "Spectrum ingest, detection telemetry and streams.",
            link: "/operator/dashboard",
          },
          {
            title: "Map and Field Picture",
            desc: "Visualize signals, assets and overlays.",
            link: "/operator/map",
          },
          {
            title: "RF Scenario Lab",
            desc: "Generate synthetic RF conditions.",
            link: "/operator/simulation",
          },
          {
            title: "Network Sensor Link",
            desc: "Monitor connectivity and reliability.",
            link: "/operator/tcp-client",
          },
        ].map((item, i) => (
          <Card key={i}>
            <GlassInner>
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ fontWeight: 700, fontSize: "16px" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "13px", color: "#94a3b8" }}>
                  {item.desc}
                </div>
                <Link
                  to={item.link}
                  style={{
                    color: "#6366f1",
                    fontWeight: 600,
                    fontSize: "13px",
                    textDecoration: "none",
                  }}
                >
                  → Open
                </Link>
              </div>
            </GlassInner>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InterceptionSection() {
  const state = useInterceptionDashboardState();

  return (
    <InterceptionDashboardView
      snapshot={state.snapshot}
      filterCounts={state.filterCounts}
      selectedContact={state.selectedContact}
      selectedContactId={state.selectedContactId}
      activeServiceTypes={state.activeServiceTypes}
      availableServiceTypes={state.availableServiceTypes}
      timeWindowPreset={state.timeWindowPreset}
      onToggleServiceType={state.toggleServiceType}
      onSetTimeWindowPreset={state.setTimeWindowPreset}
      onSelectContact={state.setSelectedContactId}
    />
  );
}

function SimulationValidationSection() {
  const state = useSimulationTestingDashboard();

  return (
    <SimulationTestingDashboardView
      templates={state.templates}
      selectedTemplateId={state.selectedTemplateId}
      config={state.config}
      activeRun={state.activeRun}
      runHistory={state.runHistory}
      guardrails={state.guardrails}
      canExecute={state.canExecute}
      publishedRunId={state.publishedRunId}
      onTemplateChange={state.applyTemplate}
      onConfigChange={state.updateConfig}
      onVolumeChange={state.updateVolumes}
      onErrorToggle={state.updateErrors}
      onGenerateRun={state.generateRun}
      onRerunFailedChecks={state.rerunFailedChecks}
      onPublishActiveRun={state.publishActiveRun}
      onOpenHistoricalRun={state.openHistoricalRun}
      onPublishHistoricalRun={state.publishHistoricalRun}
      onClearPublishedRun={state.clearPublishedRun}
    />
  );
}

export default function OperatorCommandCenterPage() {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = useMemo(
    () => parseSection(new URLSearchParams(location.search).get("section")),
    [location.search]
  );

  const setSection = (section: CommandSection) => {
    navigate(`/operator/command-center?section=${section}`, { replace: true });
  };

return (
  <AppLayout>
    <PageContainer title="Operator Command Center">

      {/* 🔥 FULL WIDTH FLEX LAYOUT */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
          gap: "24px",
        }}
      >

        {/* HEADER */}
        <div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            Operator Command Center
          </h1>

          <p style={{ color: theme.colors.textSecondary, fontSize: "14px" }}>
            Unified operations, alerts and simulation dashboard
          </p>
        </div>

        {/* 🔥 BUTTON GROUP */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            padding: "12px",
            borderRadius: "16px",
            background:
              theme.mode === "dark"
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.04)",
            backdropFilter: "blur(12px)",
          }}
        >
          {(Object.keys(SECTION_LABELS) as CommandSection[]).map((section) => (
            <SectionButton
              key={section}
              active={activeSection === section}
              label={SECTION_LABELS[section]}
              onClick={() => setSection(section)}
            />
          ))}
        </div>

        {/* 🔥 MAIN CONTENT AREA (TAKES REMAINING SPACE) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >

          {/* OVERVIEW */}
          {activeSection === "overview" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "20px",
              }}
            >
              {[
                {
                  title: "Live RF Operations",
                  desc: "Spectrum ingest, detection telemetry and streams.",
                  link: "/operator/dashboard",
                },
                {
                  title: "Map and Field Picture",
                  desc: "Visualize signals, assets and overlays.",
                  link: "/operator/map",
                },
                {
                  title: "RF Scenario Lab",
                  desc: "Generate synthetic RF conditions.",
                  link: "/operator/simulation",
                },
                {
                  title: "Network Sensor Link",
                  desc: "Monitor connectivity and reliability.",
                  link: "/operator/tcp-client",
                },
              ].map((item, i) => (
                <Card
                  key={i}
                  style={{
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e: any) => {
                    e.currentTarget.style.transform = "translateY(-6px)";
                    e.currentTarget.style.boxShadow =
                      theme.mode === "dark"
                        ? "0 12px 30px rgba(99,102,241,0.35)"
                        : "0 12px 30px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e: any) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <GlassInner>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div style={{ fontWeight: 700, fontSize: "16px" }}>
                        {item.title}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {item.desc}
                      </div>

                      <Link
                        to={item.link}
                        style={{
                          color: theme.colors.primary,
                          fontWeight: 600,
                          fontSize: "13px",
                          textDecoration: "none",
                        }}
                      >
                        → Open
                      </Link>
                    </div>
                  </GlassInner>
                </Card>
              ))}
            </div>
          )}

          {/* INTERCEPTION */}
          {activeSection === "interception" && <InterceptionSection />}

          {/* ALERTS */}
          {activeSection === "alerts" && (
            <Card
              style={{ transition: "all 0.3s ease" }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.boxShadow =
                  "0 10px 25px rgba(239,68,68,0.25)";
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <GlassInner>
                <AlertTable />
              </GlassInner>
            </Card>
          )}

          {/* VALIDATION */}
          {activeSection === "validation" && (
            <SimulationValidationSection />
          )}

        </div>
      </div>

    </PageContainer>
  </AppLayout>
);
}