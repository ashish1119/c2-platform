import { useEffect, useState } from "react";
import { createRole, deleteRole, getRoles, updateRole, type Role } from "../../api/roles";
import { useTheme } from "../../context/ThemeContext";

export default function RolesPage() {
  const { theme } = useTheme();
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLevel, setEditingLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getRoles();
      setRoles(res.data);
    } catch {
      setError("Failed to load roles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleCreateRole = async () => {
    try {
      if (!name.trim()) {
        setError("Role name is required.");
        return;
      }

      setCreating(true);
      setError(null);
      setSuccess(null);
      await createRole({ name: name.trim(), level: Math.max(1, level) });
      setName("");
      setLevel(1);
      setSuccess("Role created successfully.");
      await loadRoles();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to create role.");
    } finally {
      setCreating(false);
    }
  };

  const beginEdit = (role: Role) => {
    setEditingRoleId(role.id);
    setEditingName(role.name);
    setEditingLevel(role.level);
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingRoleId(null);
    setEditingName("");
    setEditingLevel(1);
  };

  const handleSaveRole = async (roleId: number) => {
    try {
      if (!editingName.trim()) {
        setError("Role name is required.");
        return;
      }

      setSavingRoleId(roleId);
      setError(null);
      setSuccess(null);
      await updateRole(roleId, { name: editingName.trim(), level: Math.max(1, editingLevel) });
      setSuccess("Role updated successfully.");
      cancelEdit();
      await loadRoles();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to update role.");
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleDeleteRole = async (roleId: number, roleName: string) => {
    const confirmed = window.confirm(`Delete role ${roleName}?`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingRoleId(roleId);
      setError(null);
      setSuccess(null);
      await deleteRole(roleId);
      setSuccess("Role deleted successfully.");
      if (editingRoleId === roleId) {
        cancelEdit();
      }
      await loadRoles();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to delete role.");
    } finally {
      setDeletingRoleId(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8 }}>
        <input
          placeholder="Role name (e.g. OPERATOR)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
        />
        <input
          type="number"
          min={1}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
        />
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={creating}
          onClick={handleCreateRole}
        >
          {creating ? "Creating..." : "Add Role"}
        </button>
      </div>

      {loading && <div>Loading roles...</div>}

      {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
      {success && <div style={{ color: theme.colors.success }}>{success}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>ID</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Name</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Level</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{role.id}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                {editingRoleId === role.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                ) : (
                  role.name
                )}
              </td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                {editingRoleId === role.id ? (
                  <input
                    type="number"
                    min={1}
                    value={editingLevel}
                    onChange={(e) => setEditingLevel(Number(e.target.value))}
                    style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                ) : (
                  role.level
                )}
              </td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: "flex", gap: theme.spacing.sm }}>
                  {editingRoleId === role.id ? (
                    <>
                      <button
                        style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                        disabled={savingRoleId === role.id}
                        onClick={() => handleSaveRole(role.id)}
                      >
                        {savingRoleId === role.id ? "Saving..." : "Save"}
                      </button>
                      <button
                        style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, background: theme.colors.surface, color: theme.colors.textPrimary, cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                        onClick={cancelEdit}
                        disabled={savingRoleId === role.id}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                        onClick={() => beginEdit(role)}
                        disabled={deletingRoleId === role.id}
                      >
                        Edit
                      </button>
                      <button
                        style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.danger, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        disabled={deletingRoleId === role.id}
                      >
                        {deletingRoleId === role.id ? "Deleting..." : "Delete"}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {roles.length === 0 && !loading && (
            <tr>
              <td style={{ padding: theme.spacing.sm }} colSpan={4}>No roles found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
