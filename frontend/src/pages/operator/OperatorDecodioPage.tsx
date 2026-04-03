import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import { useState } from "react";            // ← useRef and useLayoutEffect removed
import DecodioWorkspacePage from "./DecodioWorkspacePage";

type OperationMode = "local" | "server" | "remote";
type LicenseMode   = "local" | "lan";

export default function OperatorDecodioPage() {
  // ── View-switch state ────────────────────────────────────────────────────
  const [showWorkspace, setShowWorkspace] = useState<boolean>(false);

  // ── Form state (unchanged) ───────────────────────────────────────────────
  const [operationMode, setOperationMode] = useState<OperationMode>("server");
  const [port, setPort] = useState<string>("12345");
  const [licenseRetrieval, setLicenseRetrieval] = useState<LicenseMode>("local");
  const [dongle1, setDongle1] = useState<number>(0);
  const [dongle2, setDongle2] = useState<number>(0);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [loadLastProject, setLoadLastProject] = useState<boolean>(false);

  // opBoxRef and opBoxHeight removed — replaced by CSS alignItems:stretch

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
       
        <div
          style={{
            width:         "100%",
            minHeight:     "calc(100vh - 100px)",
            display:       "flex",
            flexDirection: "column",
            background:    theme.bg,
            color:         theme.text,
            borderRadius:  6,
            padding:       32,
            paddingBottom: 0,
            boxSizing:     "border-box",
            border:        `1px solid ${theme.border}`,
            // position:relative is the anchor for the absolute workspace overlay
            position:      "relative",
            overflow:      "hidden",
          }}
        >
          
          <div
            style={{
              position:      "absolute",
              inset:         0,
              zIndex:        10,
              visibility:    showWorkspace ? "visible" : "hidden",
              pointerEvents: showWorkspace ? "auto" : "none",
              // borderRadius matches parent so the overlay doesn't show square
              // corners inside the rounded shell
              borderRadius:  6,
              overflow:      "hidden",
            }}
          >
            <DecodioWorkspacePage onBack={() => setShowWorkspace(false)} />
          </div>

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
          <div
            style={{
              display:    "flex",
              gap:        24,
              flex:       1,
              minHeight:  0,
              alignItems: "stretch",   // ← replaces JS height measurement
            }}
          >
            {/* LEFT PANEL */}
            <div
              style={{
                flex:          2,
                border:        `1px solid ${theme.border}`,
                borderRadius:  4,
                padding:       24,
                background:    theme.panel,
                display:       "flex",
                flexDirection: "column",
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
                    width:          "100%",
                    borderCollapse: "collapse",
                    height:         250,
                    position:       "relative",
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

            {/* RIGHT PANEL*/}
            <div
              style={{
                flex:          1,
                border:        `1px solid ${theme.border}`,
                borderRadius:  4,
                padding:       24,
                background:    theme.panel,
                display:       "flex",
                flexDirection: "column",
                // height: opBoxHeight  ← REMOVED
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

          {/* Bottom navbar — unchanged */}
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
              <button
                onClick={() => setShowWorkspace(true)}
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
              {/* <button
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
              </button> */}
            </div>
          </div>

        </div>
      </PageContainer>
    </AppLayout>
  );
}
