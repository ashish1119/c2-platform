console.log("PermissionMatrix mounted");

import { useEffect, useState } from "react";
import { getPermissions, Permission } from "../../api/permissions";
import {
  assignPermissionToRole,
  getEffectivePermissions,
  removePermissionFromRole
} from "../../api/roles";
import type { Role } from "../../api/roles";

type Props = {
  roles: Role[];
};

export default function PermissionMatrix({ roles }: Props) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<
    Record<number, Set<string>>
  >({});

  useEffect(() => {
    loadPermissions();
  }, []);

  useEffect(() => {
    if (roles.length > 0) {
      loadRolePermissions();
    }
  }, [roles]);

  const loadPermissions = async () => {
    try {
      const res = await getPermissions();
      setPermissions(res.data);
    } catch (err) {
      console.error("Failed to load permissions", err);
    }
  };

  const loadRolePermissions = async () => {
    try {
      const map: Record<number, Set<string>> = {};

      for (const role of roles) {
        const res = await getEffectivePermissions(role.id);

        map[role.id] = new Set(
          res.data.map((p) => `${p.resource}:${p.action}`)
        );
      }

      setRolePermissions(map);
    } catch (err) {
      console.error("Failed to load role permissions", err);
    }
  };

  const handleAssign = async (roleId: number, permissionId: number) => {
    try {
      await assignPermissionToRole(roleId, permissionId);
      await loadRolePermissions();
    } catch (err) {
      console.error("Failed to assign permission", err);
    }
  };

  const handleRemove = async (roleId: number, permissionId: number) => {
    try {
      await removePermissionFromRole(roleId, permissionId);
      await loadRolePermissions();
    } catch (err) {
      console.error("Failed to remove permission", err);
    }
  };

  return (
    <div style={{ marginTop: 30 }}>
      <h3>Permission Matrix</h3>

      <div>Permissions loaded: {permissions.length}</div>

      {/* 🔐 Scrollable container */}
      <div
        style={{
          width: "100%",
          maxHeight: "500px",
          overflowX: "auto",
          overflowY: "auto",
          border: "1px solid #ccc",
          borderRadius: 10,
          marginTop: 10
        }}
      >
        <table
          style={{
            minWidth: "900px",
            borderCollapse: "collapse",
            width: "100%"
          }}
        >
          <thead
            style={{
              position: "sticky",
              top: 0,
              background: "#f4f4f4",
              zIndex: 2
            }}
          >
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "10px",
                  borderBottom: "1px solid #ccc",
                  position: "sticky",
                  left: 0,
                  background: "#f4f4f4",
                  zIndex: 3
                }}
              >
                Permission
              </th>

              {roles.map((role) => (
                <th
                  key={role.id}
                  style={{
                    padding: "10px",
                    borderBottom: "1px solid #ccc",
                    textAlign: "center"
                  }}
                >
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {permissions.map((perm) => (
              <tr key={perm.id}>
                <td
                  style={{
                    padding: "8px",
                    borderBottom: "1px solid #eee",
                    position: "sticky",
                    left: 0,
                    background: "#fff",
                    borderRight: "1px solid #ddd"
                  }}
                >
                  {perm.resource}:{perm.action}
                </td>

                {roles.map((role) => {
                  const key = `${perm.resource}:${perm.action}`;
                  const checked =
                    rolePermissions[role.id]?.has(key) || false;

                  return (
                    <td
                      key={role.id}
                      style={{
                        textAlign: "center",
                        borderBottom: "1px solid #eee"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleAssign(role.id, perm.id);
                          } else {
                            handleRemove(role.id, perm.id);
                          }
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}