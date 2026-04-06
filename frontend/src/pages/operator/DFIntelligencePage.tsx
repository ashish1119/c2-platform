import React from "react";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import DFIntelligenceDashboard from "../../features/df-intelligence/DFIntelligencePage";

// ── Tactical theme override — scoped ONLY to this page ────────────────────────
// We use a negative-margin bleed wrapper to cancel AppLayout's padding,
// then re-apply our own background. Global theme is untouched.
const DF_BG = "#04080f";

export default function DFIntelligencePage() {
  return (
    <AppLayout>
      <PageContainer title="DF Intelligence">
        {/*
          Bleed wrapper:
          - Negative margin cancels AppLayout's padding (theme.spacing.lg = 24px)
          - Explicit background overrides the global theme.colors.background
          - height: calc(100% + 48px) restores the lost vertical space
          - overflow: hidden keeps it clean
        */}
        <div style={{
          margin: "-24px",
          padding: 0,
          background: DF_BG,
          height: "calc(100% + 48px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          <DFIntelligenceDashboard />
        </div>
      </PageContainer>
    </AppLayout>
  );
}
