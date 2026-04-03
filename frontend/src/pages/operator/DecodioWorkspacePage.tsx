import { useState } from "react";
import DeviceSelectorPage from "./DeviceSelectorPage";
import SpectrumAnalyzer from "./SpectrumAnalyzer";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface DecodioWorkspacePageProps {
  onBack?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const MENU_ITEMS = [
  "Project",
  "Device",
  "Protocols",
  "Tools",
  "Windows",
  "Settings",
  "Info",
] as const;

interface ToolbarItem  { symbol: string; title: string }
interface ToolbarGroup { items: ToolbarItem[] }

const TOOLBAR_GROUPS: ToolbarGroup[] = [
  {
    items: [
      { symbol: "☐",  title: "New" },
      { symbol: "📁", title: "Open" },
      { symbol: "💾", title: "Save" },
      { symbol: "⬒",  title: "Save As" },
    ],
  },
  {
    items: [
      { symbol: "⤴",  title: "Device" },
    ],
  },
  {
    items: [
      { symbol: "▶",  title: "Start" },
      { symbol: "■",  title: "Stop" },
    ],
  },
  {
    items: [
      { symbol: "⊞",  title: "Grid" },
      { symbol: "∿",  title: "Spectrum" },
      { symbol: "↰",  title: "Tools" },
      { symbol: "⛓",  title: "Link" },
    ],
  },
  {
    items: [
      { symbol: "ℹ",  title: "Info" },
      { symbol: "☰",  title: "List" },
      { symbol: "⮐",  title: "Export" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  chromeBg:     "#f0f0f0",
  workspaceBg:  "#e8e8e8",
  border:       "#d4d4d4",
  text:         "#1a1a1a",
  hoverBg:      "#d0dce8",
  hoverBorder:  "#a8c0d8",

  titleBarH:    32,
  titleFontSz:  14,
  badgeSize:    18,
  badgeFontSz:  10,

  menuBarH:     32,
  menuFontSz:   15,

  toolbarH:     42,
  iconBtnSize:  36,
  iconFontSz:   18,

  sepH:         24,
  gripH:        28,
};

// ─────────────────────────────────────────────────────────────────────────────
// Device dropdown menu (inline, appears below the "Device" menu item)
// ─────────────────────────────────────────────────────────────────────────────

const DEVICE_MENU_ITEMS = [
  { label: "New Device",      shortcut: ""             },
  { label: "Start Selected",  shortcut: "Ctrl+R"       },
  { label: "Stop Selected",   shortcut: "Ctrl+T"       },
  { label: "Start All",       shortcut: "Ctrl+Shift+R" },
  { label: "Stop All",        shortcut: "Ctrl+Shift+T" },
];

function DeviceDropdown({
  onClose,
  onNewDevice,
}: {
  onClose: () => void;
  onNewDevice: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      style={{
        position:   "absolute",
        top:        "100%",
        left:       0,
        background: "#fff",
        border:     `1px solid ${T.border}`,
        borderRadius: 4,
        boxShadow:  "0 4px 12px rgba(0,0,0,0.12)",
        minWidth:   220,
        zIndex:     1000,
        padding:    "4px 0",
      }}
      onMouseLeave={onClose}
    >
      {DEVICE_MENU_ITEMS.map((item, idx) => (
        <button
          key={item.label}
          style={{
            display:     "flex",
            alignItems:  "center",
            width:       "100%",
            padding:     "8px 16px",
            background:  hovered === idx ? "#c6def6" : "transparent",
            border:      "none",
            fontSize:    14,
            color:       "#222",
            cursor:      "pointer",
            textAlign:   "left",
          }}
          onClick={() => {
            if (item.label === "New Device") {
              onNewDevice();
            }
            onClose();
          }}
          onMouseEnter={() => setHovered(idx)}
          onMouseLeave={() => setHovered(null)}
        >
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.shortcut && (
            <span style={{ color: "#888", fontSize: 12, marginLeft: 16 }}>
              {item.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ToolbarBtn({ symbol, title }: ToolbarItem) {
  return (
    <button
      title={title}
      style={{
        width:          T.iconBtnSize,
        height:         T.iconBtnSize,
        border:         "1px solid transparent",
        borderRadius:   3,
        background:     "transparent",
        cursor:         "pointer",
        fontSize:       T.iconFontSz,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        0,
        flexShrink:     0,
        fontFamily:     "inherit",
        lineHeight:     1,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background  = T.hoverBg;
        el.style.borderColor = T.hoverBorder;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background  = "transparent";
        el.style.borderColor = "transparent";
      }}
    >
      {symbol}
    </button>
  );
}

function ToolbarSep() {
  return (
    <div
      style={{
        width:      1,
        height:     T.sepH,
        background: T.border,
        margin:     "0 4px",
        flexShrink: 0,
      }}
    />
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      title="Back to Decodio launch options"
      style={{
        marginLeft:     "auto",
        marginRight:    4,
        height:         T.iconBtnSize,
        padding:        "0 14px",
        border:         `1px solid ${T.border}`,
        borderRadius:   3,
        background:     "transparent",
        color:          T.text,
        fontSize:       T.menuFontSz,
        fontFamily:     "inherit",
        cursor:         "pointer",
        display:        "flex",
        alignItems:     "center",
        gap:            6,
        flexShrink:     0,
        whiteSpace:     "nowrap",
        lineHeight:     1,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background  = T.hoverBg;
        el.style.borderColor = T.hoverBorder;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background  = "transparent";
        el.style.borderColor = T.border;
      }}
    >
      <span style={{ fontSize: T.iconFontSz, lineHeight: 1 }}>‹</span>
      Back
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function DecodioWorkspacePage({ onBack }: DecodioWorkspacePageProps = {}) {
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [hoveredMenu, setHoveredMenu]               = useState<string | null>(null);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [showFrequencyImage, setShowFrequencyImage] = useState(false);

  return (
    <div
      style={{
        width:         "100%",
        height:        "100%",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        background:    T.chromeBg,
        fontFamily:    "Segoe UI, system-ui, Arial, sans-serif",
        boxSizing:     "border-box",
      }}
    >
      {/* ── Title bar ──────────────────────────────────────────────────── */}
      <div
        style={{
          height:       T.titleBarH,
          display:      "flex",
          alignItems:   "center",
          paddingLeft:  8,
          borderBottom: `1px solid ${T.border}`,
          background:   T.chromeBg,
          flexShrink:   0,
          fontSize:     T.titleFontSz,
          color:        T.text,
          userSelect:   "none",
          gap:          7,
        }}
      >
        <span
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            width:          T.badgeSize,
            height:         T.badgeSize,
            borderRadius:   "50%",
            background:     "#c0392b",
            color:          "#fff",
            fontSize:       T.badgeFontSz,
            fontWeight:     700,
            flexShrink:     0,
          }}
        >
          D
        </span>
        Local mode - Unsaved project - Decodio
      </div>

      {/* ── Menu bar ───────────────────────────────────────────────────── */}
      <div
        style={{
          height:       T.menuBarH,
          display:      "flex",
          alignItems:   "center",
          padding:      "0 2px",
          borderBottom: `1px solid ${T.border}`,
          background:   T.chromeBg,
          flexShrink:   0,
        }}
      >
        {MENU_ITEMS.map((item) => (
          <button
            key={item}
            style={{
              background:   hoveredMenu === item ? T.hoverBg : "transparent",
              border:       "none",
              fontSize:     T.menuFontSz,
              fontWeight:   500,
              color:        T.text,
              padding:      "4px 11px",
              cursor:       "pointer",
              position:     "relative",
              borderRadius: 2,
              flexShrink:   0,
              fontFamily:   "inherit",
            }}
            onClick={
              item === "Device"
                ? () => setShowDeviceDropdown((v) => !v)
                : undefined
            }
            onMouseEnter={() => setHoveredMenu(item)}
            onMouseLeave={() => setHoveredMenu(null)}
          >
            {item}
            {/* Device dropdown — only renders under the "Device" button */}
            {item === "Device" && showDeviceDropdown && (
              <DeviceDropdown
                onClose={() => setShowDeviceDropdown(false)}
                onNewDevice={() => {
                  setShowDeviceSelector(true);
                  setShowDeviceDropdown(false);
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div
        style={{
          height:       T.toolbarH,
          display:      "flex",
          alignItems:   "center",
          padding:      "0 4px",
          borderBottom: `1px solid ${T.border}`,
          background:   T.chromeBg,
          flexShrink:   0,
          gap:          1,
        }}
      >
        {/* Grip handle */}
        <div
          style={{
            width:       4,
            height:      T.gripH,
            borderLeft:  `2px dotted ${T.border}`,
            marginRight: 4,
            flexShrink:  0,
          }}
        />

        {TOOLBAR_GROUPS.map((group, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 1 }}>
            {idx > 0 && <ToolbarSep />}
            {group.items.map((item) => (
              <ToolbarBtn key={item.title} {...item} />
            ))}
          </div>
        ))}

        {onBack && <BackButton onBack={onBack} />}
      </div>

      {/* ── Workspace canvas ───────────────────────────────────────────── */}
      <div
        style={{
          flex:       1,
          background: T.workspaceBg,
          overflow:   "hidden",
          minHeight:  0,
          position:   "relative",
        }}
      >
        {showFrequencyImage && <SpectrumAnalyzer onClose={() => setShowFrequencyImage(false)} />}
      </div>

      {/* ── Device Selector modal overlay ──────────────────────────────── */}
      {showDeviceSelector && (
        <div
          style={{
            position:       "fixed",
            inset:          0,
            background:     "rgba(0,0,0,0.20)",
            zIndex:         2000,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
          }}
          // Clicking the backdrop closes the modal
          onClick={() => setShowDeviceSelector(false)}
        >
          {/* Stop click from bubbling through the modal box itself */}
          <div onClick={(e) => e.stopPropagation()}>
            <DeviceSelectorPage
              onClose={() => setShowDeviceSelector(false)}
              onOpen={() => {
                setShowDeviceSelector(false);
                setShowFrequencyImage(true);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}