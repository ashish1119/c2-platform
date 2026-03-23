import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import { useTheme } from "../../context/ThemeContext";

type AdminSection = "overview" | "identity" | "assets" | "geospatial";

const SECTION_LABELS: Record<AdminSection, string> = {
  overview: "Mission Admin",
  identity: "Identity and Access",
  assets: "Assets and Systems",
  geospatial: "Geospatial",
};

function parseSection(value: string | null): AdminSection {
  if (value === "identity" || value === "assets" || value === "geospatial") {
    return value;
  }
  return "overview";
}

function SectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const { theme } = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
        borderRadius: theme.radius.md,
        background: active ? theme.colors.primary : theme.colors.surfaceAlt,
        color: active ? "#ffffff" : theme.colors.textPrimary,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function OverviewSection() {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: theme.spacing.md,
      }}
    >
      <Card>
        <div style={{ display: "grid", gap: theme.spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Identity and Access</div>
          <div style={{ color: theme.colors.textSecondary }}>
            Manage users and roles for least-privilege operations and mission-specific access scopes.
          </div>
          <Link to="/admin/users" style={{ color: theme.colors.primary, fontWeight: 600 }}>
            Open Identity Workspace
          </Link>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: theme.spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Assets and Systems</div>
          <div style={{ color: theme.colors.textSecondary }}>
            Register and maintain direction finders, jammers, and C2 nodes in a common asset registry.
          </div>
          <Link to="/admin/assets" style={{ color: theme.colors.primary, fontWeight: 600 }}>
            Open Asset Workspace
          </Link>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: theme.spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Geospatial Source Governance</div>
          <div style={{ color: theme.colors.textSecondary }}>
            Register and activate ingestion sources with ISO 19115 metadata and source health controls.
          </div>
          <Link to="/admin/geospatial" style={{ color: theme.colors.primary, fontWeight: 600 }}>
            Open Geospatial Workspace
          </Link>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: theme.spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Reporting and Planning</div>
          <div style={{ color: theme.colors.textSecondary }}>
            Run statistical EOB reporting and RF coverage planning from one consolidated planning center.
          </div>
          <Link to="/planning" style={{ color: theme.colors.primary, fontWeight: 600 }}>
            Open Reporting Center
          </Link>
        </div>
      </Card>
    </div>
  );
}

function FocusSection({
  title,
  detail,
  to,
  cta,
}: {
  title: string;
  detail: string;
  to: string;
  cta: string;
}) {
  const { theme } = useTheme();

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ color: theme.colors.textSecondary }}>{detail}</div>
        <div>
          <Link to={to} style={{ color: theme.colors.primary, fontWeight: 700 }}>
            {cta}
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function AdminCommandCenterPage() {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = useMemo(
    () => parseSection(new URLSearchParams(location.search).get("section")),
    [location.search]
  );

  const setSection = (section: AdminSection) => {
    navigate(`/admin/command-center?section=${section}`, { replace: true });
  };

  return (
    <AppLayout>
      <PageContainer title="Admin Command Center">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.md,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Admin Command Center</h2>
              <div style={{ color: theme.colors.textSecondary }}>
                Unified governance surface for access control, force assets, geospatial ingestion, and planning readiness.
              </div>
            </div>
            <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              {(Object.keys(SECTION_LABELS) as AdminSection[]).map((section) => (
                <SectionButton
                  key={section}
                  active={activeSection === section}
                  label={SECTION_LABELS[section]}
                  onClick={() => setSection(section)}
                />
              ))}
            </div>
          </div>

          {activeSection === "overview" && <OverviewSection />}
          {activeSection === "identity" && (
            <FocusSection
              title="Identity and Access"
              detail="Administer users, roles, and permission assignment policies for each operator mission profile."
              to="/admin/users"
              cta="Go to User and Role Management"
            />
          )}
          {activeSection === "assets" && (
            <FocusSection
              title="Assets and Systems"
              detail="Maintain asset registry, direction-finder profiles, jammer metadata, and system readiness state."
              to="/admin/assets"
              cta="Go to Asset Management"
            />
          )}
          {activeSection === "geospatial" && (
            <FocusSection
              title="Geospatial Sources"
              detail="Control source activation lifecycle and enforce metadata completeness for operational ingestion feeds."
              to="/admin/geospatial"
              cta="Go to Geospatial Sources"
            />
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}