import { useState } from "react";
import { createRoleInheritance, getEffectivePermissions } from "../../api/roles";
import RolesTable from "../../components/roles/RolesTable";
import { useTheme } from "../../context/ThemeContext";

export default function RolesPage() {
  const { theme } = useTheme();
  const [parentRoleId, setParentRoleId] = useState(1);
  const [childRoleId, setChildRoleId] = useState(2);
  const [queryRoleId, setQueryRoleId] = useState(1);
  const [effective, setEffective] = useState<{ resource: string; action: string; scope: string }[]>([]);
  const [loadingEffective, setLoadingEffective] = useState(false);
  const [savingInheritance, setSavingInheritance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInheritance = async () => {
    try {
      setSavingInheritance(true);
      setError(null);
      await createRoleInheritance(parentRoleId, childRoleId);
    } catch {
      setError("Failed to create inheritance.");
    } finally {
      setSavingInheritance(false);
    }
  };

  const loadEffective = async () => {
    try {
      setLoadingEffective(true);
      setError(null);
      const res = await getEffectivePermissions(queryRoleId);
      setEffective(res.data);
    } catch {
      setError("Failed to load effective permissions.");
    } finally {
      setLoadingEffective(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <RolesTable />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <input style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} type="number" value={parentRoleId} onChange={(e) => setParentRoleId(Number(e.target.value))} />
        <input style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} type="number" value={childRoleId} onChange={(e) => setChildRoleId(Number(e.target.value))} />
        <button style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer" }} disabled={savingInheritance} onClick={createInheritance}>
          {savingInheritance ? "Saving..." : "Create Inheritance"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <input style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} type="number" value={queryRoleId} onChange={(e) => setQueryRoleId(Number(e.target.value))} />
        <button style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }} disabled={loadingEffective} onClick={loadEffective}>
          {loadingEffective ? "Loading..." : "Load Effective Permissions"}
        </button>
      </div>

      {error && <div style={{ color: theme.colors.danger }}>{error}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Resource</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Action</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Scope</th>
          </tr>
        </thead>
        <tbody>
          {effective.map((row, idx) => (
            <tr key={`${row.resource}-${row.action}-${idx}`}>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.resource}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.action}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.scope}</td>
            </tr>
          ))}
          {effective.length === 0 && (
            <tr>
              <td style={{ padding: theme.spacing.sm }} colSpan={3}>No effective permissions loaded.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
