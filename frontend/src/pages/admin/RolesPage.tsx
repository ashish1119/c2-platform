// import { useEffect, useState } from "react";
// import { createRole, deleteRole, getRoles, updateRole, type Role } from "../../api/roles";
// import { useTheme } from "../../context/ThemeContext";

// export default function RolesPage() {
//   const { theme } = useTheme();
//   const [roles, setRoles] = useState<Role[]>([]);
//   const [name, setName] = useState("");
//   const [level, setLevel] = useState(1);
//   const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
//   const [editingName, setEditingName] = useState("");
//   const [editingLevel, setEditingLevel] = useState(1);
//   const [loading, setLoading] = useState(true);
//   const [creating, setCreating] = useState(false);
//   const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
//   const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [success, setSuccess] = useState<string | null>(null);

//   const loadRoles = async () => {
//     try {
//       setLoading(true);
//       setError(null);
//       const res = await getRoles();
//       setRoles(res.data);
//     } catch {
//       setError("Failed to load roles.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadRoles();
//   }, []);

//   const handleCreateRole = async () => {
//     try {
//       if (!name.trim()) {
//         setError("Role name is required.");
//         return;
//       }

//       setCreating(true);
//       setError(null);
//       setSuccess(null);
//       await createRole({ name: name.trim(), level: Math.max(1, level) });
//       setName("");
//       setLevel(1);
//       setSuccess("Role created successfully.");
//       await loadRoles();
//     } catch (err: any) {
//       const detail = err?.response?.data?.detail;
//       setError(typeof detail === "string" ? detail : "Failed to create role.");
//     } finally {
//       setCreating(false);
//     }
//   };

//   const beginEdit = (role: Role) => {
//     setEditingRoleId(role.id);
//     setEditingName(role.name);
//     setEditingLevel(role.level);
//     setError(null);
//     setSuccess(null);
//   };

//   const cancelEdit = () => {
//     setEditingRoleId(null);
//     setEditingName("");
//     setEditingLevel(1);
//   };

//   const handleSaveRole = async (roleId: number) => {
//     try {
//       if (!editingName.trim()) {
//         setError("Role name is required.");
//         return;
//       }

//       setSavingRoleId(roleId);
//       setError(null);
//       setSuccess(null);
//       await updateRole(roleId, { name: editingName.trim(), level: Math.max(1, editingLevel) });
//       setSuccess("Role updated successfully.");
//       cancelEdit();
//       await loadRoles();
//     } catch (err: any) {
//       const detail = err?.response?.data?.detail;
//       setError(typeof detail === "string" ? detail : "Failed to update role.");
//     } finally {
//       setSavingRoleId(null);
//     }
//   };

//   const handleDeleteRole = async (roleId: number, roleName: string) => {
//     const confirmed = window.confirm(`Delete role ${roleName}?`);
//     if (!confirmed) {
//       return;
//     }

//     try {
//       setDeletingRoleId(roleId);
//       setError(null);
//       setSuccess(null);
//       await deleteRole(roleId);
//       setSuccess("Role deleted successfully.");
//       if (editingRoleId === roleId) {
//         cancelEdit();
//       }
//       await loadRoles();
//     } catch (err: any) {
//       const detail = err?.response?.data?.detail;
//       setError(typeof detail === "string" ? detail : "Failed to delete role.");
//     } finally {
//       setDeletingRoleId(null);
//     }
//   };

//   return (
//     <div style={{ display: "grid", gap: 16 }}>
//       <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8 }}>
//         <input
//           placeholder="Role name (e.g. OPERATOR)"
//           value={name}
//           onChange={(e) => setName(e.target.value)}
//           style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
//         />
//         <input
//           type="number"
//           min={1}
//           value={level}
//           onChange={(e) => setLevel(Number(e.target.value))}
//           style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
//         />
//         <button
//           style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
//           disabled={creating}
//           onClick={handleCreateRole}
//         >
//           {creating ? "Creating..." : "Add Role"}
//         </button>
//       </div>

//       {loading && <div>Loading roles...</div>}

//       {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
//       {success && <div style={{ color: theme.colors.success }}>{success}</div>}

//       <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
//         <thead>
//           <tr>
//             <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>ID</th>
//             <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Name</th>
//             <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Level</th>
//             <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Actions</th>
//           </tr>
//         </thead>
//         <tbody>
//           {roles.map((role) => (
//             <tr key={role.id}>
//               <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{role.id}</td>
//               <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
//                 {editingRoleId === role.id ? (
//                   <input
//                     value={editingName}
//                     onChange={(e) => setEditingName(e.target.value)}
//                     style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
//                   />
//                 ) : (
//                   role.name
//                 )}
//               </td>
//               <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
//                 {editingRoleId === role.id ? (
//                   <input
//                     type="number"
//                     min={1}
//                     value={editingLevel}
//                     onChange={(e) => setEditingLevel(Number(e.target.value))}
//                     style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
//                   />
//                 ) : (
//                   role.level
//                 )}
//               </td>
//               <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
//                 <div style={{ display: "flex", gap: theme.spacing.sm }}>
//                   {editingRoleId === role.id ? (
//                     <>
//                       <button
//                         style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
//                         disabled={savingRoleId === role.id}
//                         onClick={() => handleSaveRole(role.id)}
//                       >
//                         {savingRoleId === role.id ? "Saving..." : "Save"}
//                       </button>
//                       <button
//                         style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, background: theme.colors.surface, color: theme.colors.textPrimary, cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
//                         onClick={cancelEdit}
//                         disabled={savingRoleId === role.id}
//                       >
//                         Cancel
//                       </button>
//                     </>
//                   ) : (
//                     <>
//                       <button
//                         style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
//                         onClick={() => beginEdit(role)}
//                         disabled={deletingRoleId === role.id}
//                       >
//                         Edit
//                       </button>
//                       <button
//                         style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.danger, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
//                         onClick={() => handleDeleteRole(role.id, role.name)}
//                         disabled={deletingRoleId === role.id}
//                       >
//                         {deletingRoleId === role.id ? "Deleting..." : "Delete"}
//                       </button>
//                     </>
//                   )}
//                 </div>
//               </td>
//             </tr>
//           ))}
//           {roles.length === 0 && !loading && (
//             <tr>
//               <td style={{ padding: theme.spacing.sm }} colSpan={4}>No roles found.</td>
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// }


//by Pallavi
import { useEffect, useState } from "react";
import {
  createRole,
  deleteRole,
  getRoles,
  updateRole,
  type Role,
} from "../../api/roles";
import { useTheme } from "../../context/ThemeContext";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa";
import PermissionMatrix from "../../components/roles/PermissionMatrix";

export default function RolesPage() {
  const { theme } = useTheme();

  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLevel, setEditingLevel] = useState(1);
  const [loading, setLoading] = useState(true);

  // ✅ success message
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await getRoles();
      setRoles(res.data);
    } finally {
      setLoading(false);
    }
  };

  // 🎨 Styles
  const input: React.CSSProperties = {
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surfaceAlt,
    color: theme.colors.textPrimary,
    fontSize: 13,
  };

  const iconBtn = (bg: string): React.CSSProperties => ({
    height: 30,
    width: 30,
    borderRadius: 6,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: bg,
    color: "#ffffff",
  });

  // 🚀 Actions

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createRole({ name: name.trim(), level });

    setMessage(`Role "${name.trim()}" saved successfully ✅`);
    setTimeout(() => setMessage(""), 3000);

    setName("");
    setLevel(1);
    loadRoles();
  };

  const handleUpdate = async (id: number) => {
    await updateRole(id, {
      name: editingName,
      level: editingLevel,
    });

    setMessage(`Role "${editingName}" updated successfully ✅`);
    setTimeout(() => setMessage(""), 3000);

    setEditingRoleId(null);
    loadRoles();
  };

  const handleDelete = async (id: number) => {
    const roleName = roles.find(r => r.id === id)?.name;

    await deleteRole(id);

    setMessage(`Role "${roleName}" deleted successfully 🗑️`);
    setTimeout(() => setMessage(""), 3000);

    loadRoles();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ✅ SUCCESS MESSAGE */}
      {message && (
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: theme.colors.surfaceAlt,
            border: `1px solid ${theme.colors.primary}`,
            color: theme.colors.textPrimary,
            fontSize: 13
          }}
        >
          {message}
        </div>
      )}

      {/* 🔥 CREATE ROLE */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          <input
            placeholder="Role name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...input, flex: 2 }}
          />

          <input
            type="number"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            style={{ ...input, width: 90 }}
          />
        </div>

        <button style={iconBtn(theme.colors.primary)} onClick={handleCreate}>
          <FaPlus />
        </button>
      </div>

      {/* 🔥 TABLE */}
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          {/* HEADER */}
          <thead
            style={{
              background: theme.colors.surfaceAlt,
              textTransform: "uppercase",
              fontSize: 12,
              letterSpacing: 0.5,
            }}
          >
            <tr>
              <th style={{ padding: 12, textAlign: "left" }}>ID</th>
              <th style={{ padding: 12, textAlign: "left" }}>Name</th>
              <th style={{ padding: 12, textAlign: "left" }}>Level</th>
              <th style={{ padding: 12, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {roles.map((role, index) => (
              <tr
                key={role.id}
                style={{
                  borderTop: `1px solid ${theme.colors.border}`,
                  background:
                    index % 2 === 0
                      ? "transparent"
                      : theme.colors.surfaceAlt,
                }}
              >
                <td style={{ padding: 12 }}>{role.id}</td>

                <td style={{ padding: 12 }}>
                  {editingRoleId === role.id ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      style={input}
                    />
                  ) : (
                    role.name
                  )}
                </td>

                <td style={{ padding: 12 }}>
                  {editingRoleId === role.id ? (
                    <input
                      type="number"
                      value={editingLevel}
                      onChange={(e) =>
                        setEditingLevel(Number(e.target.value))
                      }
                      style={{ ...input, width: 70 }}
                    />
                  ) : (
                    role.level
                  )}
                </td>

                <td style={{ padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    {editingRoleId === role.id ? (
                      <>
                        <button
                          style={iconBtn(theme.colors.primary)}
                          onClick={() => handleUpdate(role.id)}
                        >
                          <FaSave />
                        </button>

                        <button
                          style={iconBtn(theme.colors.surfaceAlt)}
                          onClick={() => setEditingRoleId(null)}
                        >
                          <FaTimes />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={iconBtn(theme.colors.surfaceAlt)}
                          onClick={() => {
                            setEditingRoleId(role.id);
                            setEditingName(role.name);
                            setEditingLevel(role.level);
                          }}
                        >
                          <FaEdit />
                        </button>

                        <button
                          style={iconBtn(theme.colors.danger)}
                          onClick={() => handleDelete(role.id)}
                        >
                          <FaTrash />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {!loading && roles.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: "center" }}>
                  No roles found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🔐 PERMISSION MATRIX */}
      <PermissionMatrix roles={roles} />
    </div>
  );
}