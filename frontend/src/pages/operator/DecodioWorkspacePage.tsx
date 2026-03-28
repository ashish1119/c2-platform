// DecodioWorkspacePage.tsx
//
// Pure content component — no routing imports, no useNavigate.
// Can be used in two ways:
//   1. Inline inside OperatorDecodioPage (conditional rendering via local state)
//   2. As a standalone route element in App.tsx (existing /operator/decodio/workspace)
//
// Layout strategy:
//   • width: 100%  / height: 100%  → fills whatever container it is placed in
//   • overflow: hidden             → never bleeds outside parent bounds
//   • NO position:fixed / 100dvh   → respects the parent's box model
//
// The parent (OperatorDecodioPage's content div, or the route's full-viewport
// container) provides the actual dimensions. This component just fills them.

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

// Toolbar groups — each group is separated by a thin vertical divider.
// Symbols approximate the icons visible in the screenshot.
// Replace with <img>/<svg> assets in production.
interface ToolbarItem { symbol: string; title: string }
interface ToolbarGroup { items: ToolbarItem[] }

const TOOLBAR_GROUPS: ToolbarGroup[] = [
  {
    items: [
      { symbol: "🗋",  title: "New" },
      { symbol: "📂", title: "Open" },
      { symbol: "💾", title: "Save" },
      { symbol: "🖫",  title: "Save As" },
    ],
  },
  {
    items: [
      { symbol: "📡", title: "Device" },
    ],
  },
  {
    items: [
      { symbol: "▶",  title: "Start" },
      { symbol: "⏹", title: "Stop" },
    ],
  },
  {
    items: [
      { symbol: "⊞", title: "Grid" },
      { symbol: "〰", title: "Spectrum" },
      { symbol: "🔧", title: "Tools" },
      { symbol: "🔗", title: "Link" },
    ],
  },
  {
    items: [
      { symbol: "⬆", title: "Up" },
      { symbol: "≡", title: "List" },
      { symbol: "↩", title: "Export" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — light theme matching the screenshot
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  chromeBg:    "#f0f0f0",   // title bar, menu bar, toolbar background
  workspaceBg: "#e8e8e8",   // large empty content area (matches screenshot exactly)
  border:      "#d4d4d4",   // separator lines between chrome sections
  text:        "#1a1a1a",   // menu item and title text
  iconSize:    28,           // toolbar button px size
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal sub-components (file-private)
// ─────────────────────────────────────────────────────────────────────────────

function MenuItem({ label }: { label: string }) {
  return (
    <button
      style={{
        background:    "transparent",
        border:        "none",
        padding:       "3px 10px",
        fontSize:      13,
        color:         T.text,
        cursor:        "pointer",
        borderRadius:  2,
        lineHeight:    "1.5",
        fontFamily:    "inherit",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "#d0dce8";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}

function ToolbarBtn({ symbol, title }: ToolbarItem) {
  return (
    <button
      title={title}
      style={{
        width:          T.iconSize,
        height:         T.iconSize,
        border:         "1px solid transparent",
        borderRadius:   3,
        background:     "transparent",
        cursor:         "pointer",
        fontSize:       14,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        0,
        flexShrink:     0,
        fontFamily:     "inherit",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background   = "#d0dce8";
        el.style.borderColor  = "#a8c0d8";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background   = "transparent";
        el.style.borderColor  = "transparent";
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
        height:     20,
        background: T.border,
        margin:     "0 3px",
        flexShrink: 0,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — pure presentational, no routing
// ─────────────────────────────────────────────────────────────────────────────

export default function DecodioWorkspacePage() {
  return (
    /*
      Root container:
        width: 100%    → fills the parent's horizontal space exactly
        height: 100%   → fills the parent's vertical space exactly
        overflow:hidden → clips children; nothing escapes the parent box
        flex column    → chrome rows stack top-to-bottom; workspace takes the rest

      When used inside OperatorDecodioPage the parent is the content <div>
      which already has a defined height via minHeight + flex. When used as a
      standalone route it is given height:100dvh by the route wrapper.
    */
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
      {/* ── Title bar ─────────────────────────────────────────────────────
          Red "D" badge + "Local mode - Unsaved project - Decodio"
          Matches the browser tab title and the first content row in the screenshot.
      */}
      <div
        style={{
          height:        26,
          display:       "flex",
          alignItems:    "center",
          paddingLeft:   6,
          borderBottom:  `1px solid ${T.border}`,
          background:    T.chromeBg,
          flexShrink:    0,
          fontSize:      12,
          color:         T.text,
          userSelect:    "none",
          gap:           6,
        }}
      >
        {/* Decodio favicon approximation */}
        <span
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            width:          14,
            height:         14,
            borderRadius:   "50%",
            background:     "#c0392b",
            color:          "#fff",
            fontSize:       9,
            fontWeight:     700,
            flexShrink:     0,
          }}
        >
          D
        </span>
        Local mode - Unsaved project - Decodio
      </div>

      {/* ── Menu bar ──────────────────────────────────────────────────────
          Horizontal row of text menu items: Project Device Protocols …
      */}
      <div
        style={{
          height:       26,
          display:      "flex",
          alignItems:   "center",
          padding:      "0 2px",
          borderBottom: `1px solid ${T.border}`,
          background:   T.chromeBg,
          flexShrink:   0,
        }}
      >
        {MENU_ITEMS.map((label) => (
          <MenuItem key={label} label={label} />
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────
          Icon button groups with thin vertical separators between groups.
          The leading dotted grip strip matches the screenshot's left edge detail.
      */}
      <div
        style={{
          height:       34,
          display:      "flex",
          alignItems:   "center",
          padding:      "0 4px",
          borderBottom: `1px solid ${T.border}`,
          background:   T.chromeBg,
          flexShrink:   0,
          gap:          1,
        }}
      >
        {/* Toolbar grip handle */}
        <div
          style={{
            width:       4,
            height:      24,
            borderLeft:  `2px dotted ${T.border}`,
            marginRight: 3,
            flexShrink:  0,
          }}
        />

        {TOOLBAR_GROUPS.map((group, idx) => (
          <div
            key={idx}
            style={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            {idx > 0 && <ToolbarSep />}
            {group.items.map((item) => (
              <ToolbarBtn key={item.title} {...item} />
            ))}
          </div>
        ))}
      </div>

      {/* ── Workspace canvas ──────────────────────────────────────────────
          Empty content area. flex:1 consumes all remaining vertical space.
          overflow:hidden ensures it never pushes past the parent container.
      */}
      <div
        style={{
          flex:      1,
          background: T.workspaceBg,
          overflow:  "hidden",
          minHeight: 0,   // ← critical: allows flex child to shrink below content size
        }}
      />
    </div>
  );
}
