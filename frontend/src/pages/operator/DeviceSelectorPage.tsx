import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const DEVICE_LIST = [
  "Stream recording",
  "Network Stream",
  "SoundCard",
  "SignalHound",
  "Tektronix",
  "NARDA SignalShark",
  "KEYSIGHT FieldFox",
  "PLATH SIR",
  "Rohde & Schwarz",
  "DDF",
  "OxE",
  "NI RFSA",
  "IZT R3000",
  "IZT R5000",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Basic IPv4 validation: 4 octets, each 0-255. */
function isValidIPv4(value: string): boolean {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (p === "" || p.length > 3) return false;
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — unchanged from previous version
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:             "#ffffff",
  sidebarBg:      "#f4f4f4",
  titleBarBg:     "#f0f0f0",
  fileBtnBg:      "#ebebeb",
  activeDeviceBg: "#dce8f5",
  hoverDeviceBg:  "#eef4fb",

  border:         "#c8c8c8",
  borderActive:   "#0078d4",
  borderFocus:    "#0078d4",
  borderError:    "#c0392b",

  text:           "#1a1a1a",
  textMuted:      "#666666",
  textError:      "#c0392b",
  activeText:     "#003a70",

  inputBg:        "#ffffff",

  titleFontSz:    13,
  menuFontSz:     14,
  labelFontSz:    13,
  fieldFontSz:    13,
  btnFontSz:      13,

  labelColW:      140,
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared styled primitives — unchanged
// ─────────────────────────────────────────────────────────────────────────────

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        width:      C.labelColW,
        flexShrink: 0,
        fontSize:   C.labelFontSz,
        fontWeight: 500,
        color:      C.text,
        display:    "flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
}

function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize:     C.labelFontSz,
        fontWeight:   500,
        color:        C.text,
        marginBottom: 5,
      }}
    >
      {children}
    </div>
  );
}

function Sel({ options, style }: { options: string[]; style?: React.CSSProperties }) {
  return (
    <select
      defaultValue={options[0]}
      style={{
        flex:         1,
        minWidth:     0,
        padding:      "5px 6px",
        border:       `1px solid ${C.border}`,
        borderRadius: 3,
        fontSize:     C.fieldFontSz,
        background:   C.inputBg,
        color:        C.text,
        cursor:       "pointer",
        ...style,
      }}
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function Inp({
  value,
  placeholder,
  style,
}: {
  value?: string | number;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      defaultValue={value}
      placeholder={placeholder}
      style={{
        flex:         1,
        minWidth:     0,
        padding:      "5px 7px",
        border:       `1px solid ${C.border}`,
        borderRadius: 3,
        fontSize:     C.fieldFontSz,
        background:   C.inputBg,
        color:        C.text,
        boxSizing:    "border-box",
        ...style,
      }}
    />
  );
}

function Gap({ h = 10 }: { h?: number }) {
  return <div style={{ height: h }} />;
}


interface NumericInputProps {
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
}

function NumericInput({ value, onChange, placeholder }: NumericInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow digits and at most one decimal point — strip everything else.
    // Strategy: keep only [0-9.], then remove any second dot.
    const digitsAndDot = raw.replace(/[^0-9.]/g, "");
    const parts        = digitsAndDot.split(".");
    // Reconstruct: integer part + optional single fractional part
    const cleaned =
      parts.length > 1
        ? parts[0] + "." + parts.slice(1).join("")  // collapses extra dots
        : parts[0];

    onChange(cleaned);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={handleChange}
      spellCheck={false}
      style={{
        // ── Identical to Inp and IPAddressInput ──
        width:        "100%",
        padding:      "5px 7px",
        border:       `1px solid ${C.border}`,
        borderRadius: 3,
        fontSize:     C.fieldFontSz,
        background:   C.inputBg,
        color:        C.text,
        boxSizing:    "border-box",
        outline:      "none",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = C.borderFocus;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = C.border;
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IPAddressInput
// ─────────────────────────────────────────────────────────────────────────────

interface IPAddressInputProps {
  value:    string;
  onChange: (v: string) => void;
  error:    string | null;
  onBlur:   () => void;
}

function IPAddressInput({ value, onChange, error, onBlur }: IPAddressInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only digits and dots
    const cleaned = e.target.value.replace(/[^0-9.]/g, "");
    onChange(cleaned);
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <input
        type="text"
        value={value}
        placeholder="e.g. 192.168.0.1"
        onChange={handleChange}
        onBlur={onBlur}
        maxLength={15}   // max IPv4 length: "255.255.255.255"
        spellCheck={false}
        style={{
          width:        "100%",
          padding:      "5px 7px",
          border:       `1px solid ${error ? C.borderError : C.border}`,
          borderRadius: 3,
          fontSize:     C.fieldFontSz,
          background:   C.inputBg,
          color:        C.text,
          boxSizing:    "border-box",
          outline:      "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? C.borderError : C.borderFocus;
        }}
      />
      {/* Inline validation error — only visible when format is wrong */}
      {error && (
        <div
          style={{
            fontSize:   11,
            color:      C.textError,
            marginTop:  3,
            lineHeight: 1.3,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviceSelectorPageProps {
  onClose?: () => void;
  onOpen?: () => void;
}

export default function DeviceSelectorPage({ onClose, onOpen }: DeviceSelectorPageProps = {}) {
  // ── Unchanged state ────────────────────────────────────────────────────────
  const [selectedDevice, setSelectedDevice] = useState<string>("IZT R3xxx");
  const [attenValue, setAttenValue]         = useState<number>(0);

  // ── Editable numeric field state ──────────────────────────────────────────
  // Plain decimal strings — no raw/dot-position encoding needed.
  const [freqValue, setFreqValue] = useState<string>("0030.000000");
  const [bwValue,   setBwValue]   = useState<string>("020.000000");

  // IP Address
  const [ipValue, setIpValue] = useState<string>("");
  const [ipError, setIpError] = useState<string | null>(null);

  // Validate IP on blur — only flag an error if something was actually typed
  const handleIpBlur = () => {
    if (ipValue.trim() === "") {
      setIpError(null);   // empty is fine (not yet configured)
      return;
    }
    if (!isValidIPv4(ipValue)) {
      setIpError("Invalid IPv4 address (e.g. 192.168.0.1)");
    } else {
      setIpError(null);
    }
  };

  return (
    <div
      style={{
        width:         760,
        maxWidth:      "98vw",
        maxHeight:     "90vh",
        display:       "flex",
        flexDirection: "column",
        background:    C.bg,
        borderRadius:  4,
        boxShadow:     "0 6px 24px rgba(0,0,0,0.25)",
        overflow:      "hidden",
        fontFamily:    "Segoe UI, system-ui, Arial, sans-serif",
        fontSize:      C.menuFontSz,
        color:         C.text,
      }}
    >
      {/* ── Title bar ────────────────────────────────────────────────────── */}
      <div
        style={{
          height:       34,
          display:      "flex",
          alignItems:   "center",
          padding:      "0 10px",
          background:   C.titleBarBg,
          borderBottom: `1px solid ${C.border}`,
          flexShrink:   0,
          userSelect:   "none",
          gap:          8,
        }}
      >
        <span
          style={{
            width:          16,
            height:         16,
            borderRadius:   "50%",
            background:     "#c0392b",
            color:          "#fff",
            fontSize:       9,
            fontWeight:     700,
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}
        >
          D
        </span>
        <span style={{ flex: 1, fontSize: C.titleFontSz, fontWeight: 600 }}>
          Device Selector
        </span>
        <button
          style={{
            width: 22, height: 22,
            border: `1px solid ${C.border}`, borderRadius: 3,
            background: "transparent", fontSize: 12, fontWeight: 700,
            color: C.textMuted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >?</button>
        <button
          onClick={onClose}
          style={{
            width: 22, height: 22,
            border: `1px solid ${C.border}`, borderRadius: 3,
            background: "transparent", fontSize: 15,
            color: C.text, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR ───────────────────────────────────────────────── */}
        <div
          style={{
            width: 180, flexShrink: 0,
            borderRight: `1px solid ${C.border}`,
            background: C.sidebarBg,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <button
            style={{
              width: "100%", padding: "11px 12px",
              textAlign: "center", background: C.fileBtnBg,
              border: "none", borderBottom: `1px solid ${C.border}`,
              fontSize: C.menuFontSz, fontWeight: 600,
              color: C.text, cursor: "pointer", flexShrink: 0,
            }}
          >
            File
          </button>

          <div
            style={{
              flex: 1, overflowY: "auto",
              display: "flex", flexDirection: "column",
              padding: "3px 6px", gap: 2,
              scrollbarWidth: "thin",
            }}
          >
            {DEVICE_LIST.map((dev) => {
              const active = selectedDevice === dev;
              return (
                <button
                  key={dev}
                  onClick={() => setSelectedDevice(dev)}
                  style={{
                    width: "100%", padding: "8px 10px",
                    textAlign: "center",
                    background: active ? C.activeDeviceBg : C.bg,
                    border: `1px solid ${active ? C.borderActive : C.border}`,
                    borderRadius: 3,
                    fontSize: C.labelFontSz,
                    fontWeight: active ? 600 : 400,
                    color: active ? C.activeText : C.text,
                    cursor: "pointer", transition: "background 0.1s", flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.background = C.hoverDeviceBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.background = C.bg;
                  }}
                >
                  {dev}
                </button>
              );
            })}
          </div>

          <div
            style={{
              height: 28, display: "flex", alignItems: "center",
              justifyContent: "center",
              borderTop: `1px solid ${C.border}`, background: C.sidebarBg,
              flexShrink: 0, color: C.textMuted, fontSize: 12, userSelect: "none",
            }}
          >
            ▼
          </div>
        </div>

        {/* ── RIGHT CONTENT PANEL ────────────────────────────────────────── */}
        <div
          style={{
            flex: 1, overflowY: "auto",
            padding: "16px 20px",
            display: "flex", flexDirection: "column",
            minWidth: 0,
          }}
        >
          {/* Device alias */}
          <BlockLabel>Device alias</BlockLabel>
          <Inp placeholder="" style={{ flex: "none", width: "100%" }} />

          <Gap h={14} />

          {/* Frequency — NumericInput */}
          <BlockLabel>Frequency</BlockLabel>
          <NumericInput
            value={freqValue}
            onChange={setFreqValue}
            placeholder="e.g. 0030.000000"
          />

          <Gap h={14} />

          {/*
            BANDWIDTH — NumericInput (same as Frequency)
          */}
          <BlockLabel>Bandwidth</BlockLabel>
          <NumericInput
            value={bwValue}
            onChange={setBwValue}
            placeholder="e.g. 020.000000"
          />

          <Gap h={16} />

          {/* Attenuation — unchanged */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <RowLabel>Attenuation</RowLabel>
            <Sel options={["MGC", "AGC"]} />
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
            <div style={{ width: C.labelColW, flexShrink: 0 }} />
            <input
              type="range" min={0} max={100} value={attenValue}
              onChange={(e) => setAttenValue(Number(e.target.value))}
              style={{ flex: 1, cursor: "pointer", minWidth: 0 }}
            />
            <input
              type="number" value={attenValue}
              onChange={(e) => setAttenValue(Number(e.target.value))}
              style={{
                width: 48, marginLeft: 6, padding: "3px 5px",
                border: `1px solid ${C.border}`, borderRadius: 3,
                fontSize: C.fieldFontSz, textAlign: "right", flexShrink: 0,
              }}
            />
            <span style={{ marginLeft: 5, fontSize: C.fieldFontSz, color: C.textMuted, flexShrink: 0 }}>
              dB
            </span>
          </div>

          <Gap h={10} />

          {/* Attenuation mode — unchanged */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <RowLabel>Attenuation mode</RowLabel>
            <Sel options={["Normal"]} />
          </div>

          <Gap h={10} />

          {/* VUHF / HF Input — unchanged */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <RowLabel>VUHF Input</RowLabel>
            <Sel options={["ant1", "ant2"]} style={{ flex: "0 0 90px" }} />
            <span style={{ marginLeft: 16, marginRight: 8, fontSize: C.labelFontSz, fontWeight: 500, flexShrink: 0, color: C.text }}>
              HF Input
            </span>
            <Sel options={["ant1", "ant2"]} style={{ flex: "0 0 90px" }} />
          </div>

          <Gap h={10} />

          {/* RefClock — unchanged */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <RowLabel>RefClock</RowLabel>
            <Sel options={["int", "ext"]} />
          </div>

          <Gap h={10} />

          {/* SyncSource — unchanged */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <RowLabel>SyncSource</RowLabel>
            <Sel options={["int", "ext"]} />
          </div>

          <Gap h={10} />

          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <RowLabel>IP Address</RowLabel>
            <IPAddressInput
              value={ipValue}
              onChange={(v) => {
                setIpValue(v);
                // Clear error while user is still typing
                if (ipError) setIpError(null);
              }}
              error={ipError}
              onBlur={handleIpBlur}
            />
          </div>

          <Gap h={10} />

          {/* Streaming port — unchanged */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <RowLabel>Streaming port</RowLabel>
            <Inp value={8510} style={{ flex: "none", width: 80, minWidth: 0 }} />
          </div>

          <div style={{ flex: 1 }} />

          {/* Open / Cancel — unchanged */}
          <div
            style={{
              display: "flex", justifyContent: "flex-end",
              gap: 10, paddingTop: 16,
              borderTop: `1px solid ${C.border}`,
              marginTop: 12, flexShrink: 0,
            }}
          >
            <button
              onClick={() => {
                if (onOpen) onOpen();
              }}
              style={{
                minWidth: 80, padding: "7px 16px",
                background: "#e8f0fb",
                border: `1px solid ${C.borderActive}`,
                borderRadius: 3, color: C.borderActive,
                fontWeight: 600, fontSize: C.btnFontSz, cursor: "pointer",
              }}
            >
              Open
            </button>
            <button
              onClick={onClose}
              style={{
                minWidth: 80, padding: "7px 16px",
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 3, color: C.text,
                fontWeight: 500, fontSize: C.btnFontSz, cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}