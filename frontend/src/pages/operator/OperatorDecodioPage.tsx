// OperatorDecodioPage.tsx
//
// CHANGE LOG vs previous version (minimal diff):
//   1. Added `showWorkspace` boolean state — controls which view is shown.
//   2. OK button sets showWorkspace = true  (replaces navigate call).
//   3. When showWorkspace is true, the entire content area is replaced by
//      <DecodioWorkspacePage /> which fills the same container div exactly.
//   4. Removed `useNavigate` import (no longer needed).
//
// Everything else — AppLayout, PageContainer, all form state, all theme
// tokens, all JSX of the launch form — is byte-for-byte identical.

import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import { useState, useRef, useLayoutEffect } from "react";
import DecodioWorkspacePage from "./DecodioWorkspacePage"; // ← ADDED import

type OperationMode = "local" | "server" | "remote";
type LicenseMode   = "local" | "lan";

export default function OperatorDecodioPage() {
  // ── View-switch state ────────────────────────────────────────────────────
  // When true, DecodioWorkspacePage replaces the launch form content.
  // The AppLayout + PageContainer shell stays mounted and unchanged.
  const [showWorkspace, setShowWorkspace] = useState<boolean>(false); // ← ADDED

  // ── Form state (unchanged) ───────────────────────────────────────────────
  const [operationMode, setOperationMode] = useState<OperationMode>("server");
  const [port, setPort] = useState<string>("12345");
  const [licenseRetrieval, setLicenseRetrieval] = useState<LicenseMode>("local");
  const [dongle1, setDongle1] = useState<number>(0);
  const [dongle2, setDongle2] = useState<number>(0);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [loadLastProject, setLoadLastProject] = useState<boolean>(false);

  const opBoxRef = useRef<HTMLDivElement>(null);
  const [opBoxHeight, setOpBoxHeight] = useState<number>();

  useLayoutEffect(() => {
    if (opBoxRef.current) {
      setOpBoxHeight(opBoxRef.current.offsetHeight);
    }
  }, []);

  // ── Theme tokens (unchanged) ─────────────────────────────────────────────
  const theme = {
    bg:      isDark ? "#1e1e1e" : "#ffffff",
    panel:   isDark ? "#252526" : "#ffffff",
    text:    isDark ? "#ffffff" : "#000000",
    subText: isDark ? "#888888" : "#bbbbbb",
    border:  "#cccccc",
    header:  isDark ? "#2d2d2d" : "#f3f3f3",
  };

  const faded = (active: boolean) => ({
    color:   active ? theme.text : theme.subText,
    opacity: active ? 1 : 0.7,
  });

  return (
    <AppLayout>
      <PageContainer title="Decodio launch options">
        {/*
          Outer content shell — dimensions are identical to the previous version.

          When showWorkspace is true, we render <DecodioWorkspacePage /> as the
          sole child of this div. It receives width:100% + height:100% from
          itself and fills this container completely, respecting every constraint
          (borderRadius, border, padding=0 when workspace is shown).

          When showWorkspace is false, the original launch form renders normally.
        */}
        <div
          style={{
            width:         "100%",
            // Height adapts: full-height when showing workspace, natural when form
            minHeight:     showWorkspace ? 0 : "calc(100vh - 100px)",
            height:        showWorkspace ? "calc(100vh - 100px)" : undefined,
            display:       "flex",
            flexDirection: "column",
            background:    showWorkspace ? "transparent" : theme.bg,
            color:         theme.text,
            borderRadius:  6,
            // Remove padding when workspace is shown so it fills edge-to-edge
            padding:       showWorkspace ? 0 : 32,
            paddingBottom: showWorkspace ? 0 : 0,
            boxSizing:     "border-box",
            border:        `1px solid ${theme.border}`,
            overflow:      "hidden",   // ← prevents workspace from bleeding out
          }}
        >
          {/* ── CONDITIONAL RENDER ────────────────────────────────────────
            showWorkspace = true  → DecodioWorkspacePage fills this container
            showWorkspace = false → original launch options form renders
          */}
          {showWorkspace ? (
            // DecodioWorkspacePage is a pure content component (no routing).
            // It uses width:100% / height:100% / overflow:hidden internally
            // and fills this container exactly.
            <DecodioWorkspacePage />
          ) : (
            <>
              {/* Page title */}
              <h2
                style={{
                  margin:        "0 0 20px 0",
                  fontSize:      16,
                  fontWeight:    600,
                  color:         theme.text,
                  letterSpacing: 0.2,
                }}
              >
                Decodio launch options
              </h2>

              {/* Two-column panel row */}
              <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 0 }}>

                {/* LEFT PANEL */}
                <div
                  ref={opBoxRef}
                  style={{
                    flex:           2,
                    border:         `1px solid ${theme.border}`,
                    borderRadius:   4,
                    padding:        24,
                    background:     theme.panel,
                    display:        "flex",
                    flexDirection:  "column",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 16 }}>
                    Operation mode
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        checked={operationMode === "local"}
                        onChange={() => setOperationMode("local")}
                      />
                      <span style={faded(true)}>Local mode</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        checked={operationMode === "server"}
                        onChange={() => setOperationMode("server")}
                      />
                      <span style={faded(true)}>Server mode</span>
                    </label>

                    {operationMode === "server" && (
                      <div
                        style={{
                          marginLeft: 28,
                          display:    "flex",
                          alignItems: "center",
                          gap:        8,
                        }}
                      >
                        <span style={faded(true)}>Port</span>
                        <input
                          type="number"
                          value={port}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPort(e.target.value)
                          }
                          style={{
                            width:        70,
                            padding:      "4px 6px",
                            border:       `1px solid ${theme.border}`,
                            borderRadius: 4,
                            background:   isDark ? "#2a2a2a" : "#fff",
                            color:        theme.text,
                          }}
                        />
                      </div>
                    )}

                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        checked={operationMode === "remote"}
                        onChange={() => setOperationMode("remote")}
                      />
                      <span style={faded(true)}>Remote mode</span>
                    </label>

                    <label
                      style={{
                        display:    "flex",
                        alignItems: "center",
                        gap:        8,
                        marginLeft: 28,
                        ...faded(operationMode === "remote"),
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={operationMode !== "remote"}
                      />
                      Remote observer
                    </label>
                  </div>

                  {/* Table */}
                  <div
                    style={{
                      border:       `1px solid ${theme.border}`,
                      borderRadius: 4,
                      marginTop:    24,
                      background:   theme.panel,
                    }}
                  >
                    <table
                      style={{
                        width:           "100%",
                        borderCollapse:  "collapse",
                        height:          250,
                        position:        "relative",
                      }}
                    >
                      <thead>
                        <tr style={{ background: theme.header }}>
                          <th style={{ padding: 8 }}>Identifier</th>
                          <th style={{ padding: 8 }}>Host</th>
                          <th style={{ padding: 8 }}>Port</th>
                        </tr>
                      </thead>
                      <tbody />
                    </table>
                    <div
                      style={{
                        display:       "flex",
                        flexDirection: "column",
                        gap:           4,
                        padding:       8,
                      }}
                    />
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div
                  style={{
                    flex:          1,
                    border:        `1px solid ${theme.border}`,
                    borderRadius:  4,
                    padding:       24,
                    background:    theme.panel,
                    height:        opBoxHeight,
                    display:       "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 16 }}>
                    License options
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span>License retrieval</span>
                    <label>
                      <input
                        type="radio"
                        checked={licenseRetrieval === "local"}
                        onChange={() => setLicenseRetrieval("local")}
                      />
                      Local
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={licenseRetrieval === "lan"}
                        onChange={() => setLicenseRetrieval("lan")}
                      />
                      LAN
                    </label>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <input
                      type="text"
                      placeholder="License server"
                      disabled={licenseRetrieval !== "lan"}
                      style={{
                        width:        "100%",
                        padding:      "6px 8px",
                        border:       `1px solid ${theme.border}`,
                        borderRadius: 4,
                        background:   isDark ? "#2a2a2a" : "#fff",
                        color:        theme.text,
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <span>Dongle # </span>
                    <input
                      type="number"
                      value={dongle1}
                      onChange={(e) => setDongle1(Number(e.target.value))}
                      style={{
                        width:      50,
                        marginLeft: 4,
                        background: isDark ? "#2a2a2a" : "#fff",
                        color:      theme.text,
                      }}
                    />
                    {" - "}
                    <input
                      type="number"
                      value={dongle2}
                      onChange={(e) => setDongle2(Number(e.target.value))}
                      style={{
                        width:      50,
                        marginLeft: 4,
                        background: isDark ? "#2a2a2a" : "#fff",
                        color:      theme.text,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom navbar */}
              <div
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  marginTop:      20,
                  paddingBottom:  24,
                  gap:            16,
                }}
              >
                {/* Left: checkboxes */}
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <label
                    style={{
                      display:    "flex",
                      alignItems: "center",
                      gap:        6,
                      color:      theme.text,
                      cursor:     "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={loadLastProject}
                      onChange={(e) => setLoadLastProject(e.target.checked)}
                    />
                    Load last project
                  </label>

                  <label
                    style={{
                      display:    "flex",
                      alignItems: "center",
                      gap:        6,
                      color:      theme.text,
                      cursor:     "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isDark}
                      onChange={(e) => setIsDark(e.target.checked)}
                    />
                    Dark theme
                  </label>
                </div>

                {/* Right: action buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/*
                    OK button — sets showWorkspace = true.
                    DecodioWorkspacePage replaces the form content in-place.
                    AppLayout + PageContainer remain mounted and unaffected.
                    All styles identical to previous version.
                  */}
                  <button
                    onClick={() => setShowWorkspace(true)} // ← only change to this button
                    style={{
                      minWidth:     100,
                      border:       "1px solid #0078d4",
                      color:        "#0078d4",
                      padding:      "8px 0",
                      borderRadius: 4,
                      background:   isDark ? "#2a2a2a" : "#e6f0fa",
                      cursor:       "pointer",
                    }}
                  >
                    OK
                  </button>
                  <button
                    style={{
                      minWidth:     100,
                      border:       `1px solid ${theme.border}`,
                      padding:      "8px 0",
                      borderRadius: 4,
                      background:   theme.panel,
                      color:        theme.text,
                      cursor:       "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
