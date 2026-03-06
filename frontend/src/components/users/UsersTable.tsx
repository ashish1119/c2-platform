import { useCallback, useEffect, useState } from "react";
import { deleteUser, getUsers, updateUser } from "../../api/users";
import { getRoles, type Role } from "../../api/roles";
import { useTheme } from "../../context/ThemeContext";

type UserRow = {
  id: string;
  username: string;
  email: string;
  role_id?: number | null;
};

type UsersTableProps = {
  refreshToken?: number;
};

export default function UsersTable({ refreshToken = 0 }: UsersTableProps) {
  const { theme } = useTheme();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesById, setRolesById] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<number | "">("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersRes, rolesRes] = await Promise.all([getUsers(), getRoles()]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      const roleMap = rolesRes.data.reduce((acc, role) => {
        acc[role.id] = role.name;
        return acc;
      }, {} as Record<number, string>);
      setRolesById(roleMap);
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const startEdit = (user: UserRow) => {
    setEditingUserId(user.id);
    setEditingUsername(user.username);
    setEditingEmail(user.email);
    setEditingRoleId(user.role_id ?? "");
    setActionError(null);
    setActionSuccess(null);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditingUsername("");
    setEditingEmail("");
    setEditingRoleId("");
  };

  const saveUser = async (userId: string) => {
    try {
      if (!editingUsername.trim() || !editingEmail.trim()) {
        setActionError("Username and email are required.");
        return;
      }

      setSavingUserId(userId);
      setActionError(null);
      setActionSuccess(null);
      await updateUser(userId, {
        username: editingUsername.trim(),
        email: editingEmail.trim(),
        role_id: editingRoleId === "" ? null : Number(editingRoleId),
      });
      setActionSuccess("User updated successfully.");
      cancelEdit();
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(typeof detail === "string" ? detail : "Failed to update user.");
    } finally {
      setSavingUserId(null);
    }
  };

  const removeUser = async (userId: string, username: string) => {
    const confirmed = window.confirm(`Delete user ${username}?`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingUserId(userId);
      setActionError(null);
      setActionSuccess(null);
      await deleteUser(userId);
      if (editingUserId === userId) {
        cancelEdit();
      }
      setActionSuccess("User deleted successfully.");
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(typeof detail === "string" ? detail : "Failed to delete user.");
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return <div>Loading users...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {actionError && <div style={{ color: theme.colors.danger }}>{actionError}</div>}
      {actionSuccess && <div style={{ color: theme.colors.success }}>{actionSuccess}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Username</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Email</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Role</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                {editingUserId === u.id ? (
                  <input
                    value={editingUsername}
                    onChange={(e) => setEditingUsername(e.target.value)}
                    style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                ) : (
                  u.username
                )}
              </td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                {editingUserId === u.id ? (
                  <input
                    value={editingEmail}
                    onChange={(e) => setEditingEmail(e.target.value)}
                    style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                ) : (
                  u.email
                )}
              </td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                {editingUserId === u.id ? (
                  <select
                    value={editingRoleId}
                    onChange={(e) => setEditingRoleId(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  >
                    <option value="">No role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  u.role_id ? rolesById[u.role_id] ?? `Role ${u.role_id}` : "-"
                )}
              </td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: "flex", gap: theme.spacing.sm }}>
                  {editingUserId === u.id ? (
                    <>
                      <button
                        style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                        disabled={savingUserId === u.id}
                        onClick={() => saveUser(u.id)}
                      >
                        {savingUserId === u.id ? "Saving..." : "Save"}
                      </button>
                      <button
                        style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, background: theme.colors.surface, color: theme.colors.textPrimary, cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                        disabled={savingUserId === u.id}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                        disabled={deletingUserId === u.id}
                        onClick={() => startEdit(u)}
                      >
                        Edit
                      </button>
                      <button
                        style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.danger, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                        disabled={deletingUserId === u.id}
                        onClick={() => removeUser(u.id, u.username)}
                      >
                        {deletingUserId === u.id ? "Deleting..." : "Delete"}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td style={{ padding: theme.spacing.sm }} colSpan={4}>No users found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}