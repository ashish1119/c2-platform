// import { useEffect, useState } from "react";
// import { createUser } from "../../api/users";
// import { getRoles, type Role } from "../../api/roles";
// import UsersTable from "../../components/users/UsersTable";
// import { useTheme } from "../../context/ThemeContext";

// export default function UsersPage() {
// 	const { theme } = useTheme();
// 	const [username, setUsername] = useState("");
// 	const [email, setEmail] = useState("");
// 	const [password, setPassword] = useState("");
// 	const [roleId, setRoleId] = useState(1);
// 	const [roles, setRoles] = useState<Role[]>([]);
// 	const [submitting, setSubmitting] = useState(false);
// 	const [error, setError] = useState<string | null>(null);
// 	const [success, setSuccess] = useState<string | null>(null);
// 	const [refreshToken, setRefreshToken] = useState(0);

// 	useEffect(() => {
// 		const loadRoles = async () => {
// 			try {
// 				const response = await getRoles();
// 				setRoles(response.data);
// 				if (response.data.length > 0) {
// 					setRoleId(response.data[0].id);
// 				}
// 			} catch {
// 				setError("Failed to load roles.");
// 			}
// 		};

// 		loadRoles();
// 	}, []);

// 	const handleCreate = async () => {
// 		try {
// 			if (!username.trim() || !email.trim() || !password.trim()) {
// 				setError("Username, email, and password are required.");
// 				return;
// 			}

// 			setSubmitting(true);
// 			setError(null);
// 			setSuccess(null);
// 			await createUser({ username, email, password, role_id: roleId });
// 			setUsername("");
// 			setEmail("");
// 			setPassword("");
// 			setSuccess("User created successfully.");
// 			setRefreshToken((value) => value + 1);
// 		} catch (err: any) {
// 			const detail = err?.response?.data?.detail;
// 			setError(typeof detail === "string" ? detail : "Failed to create user.");
// 		} finally {
// 			setSubmitting(false);
// 		}
// 	};

// 	return (
// 		<div style={{ display: "grid", gap: 16 }}>
// 			<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
// 				<input
// 					placeholder="Username"
// 					value={username}
// 					onChange={(e) => setUsername(e.target.value)}
// 					style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
// 				/>
// 				<input
// 					placeholder="Email"
// 					value={email}
// 					onChange={(e) => setEmail(e.target.value)}
// 					style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
// 				/>
// 				<input
// 					placeholder="Password"
// 					type="password"
// 					value={password}
// 					onChange={(e) => setPassword(e.target.value)}
// 					style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
// 				/>
// 				<select
// 					value={roleId}
// 					onChange={(e) => setRoleId(Number(e.target.value))}
// 					style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
// 				>
// 					{roles.map((role) => (
// 						<option key={role.id} value={role.id}>
// 							{role.name}
// 						</option>
// 					))}
// 				</select>
// 			</div>
// 			<button
// 				disabled={submitting}
// 				onClick={handleCreate}
// 				style={{ width: "fit-content", padding: `${theme.spacing.sm} ${theme.spacing.md}`, border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer" }}
// 			>
// 				{submitting ? "Creating..." : "Create User"}
// 			</button>
// 			{error && <div style={{ color: theme.colors.danger }}>{error}</div>}
// 			{success && <div style={{ color: theme.colors.success }}>{success}</div>}
// 			<UsersTable refreshToken={refreshToken} />
// 		</div>
// 	);
// }


//BY Pallavi
// 
import { useEffect, useState } from "react";
import { createUser } from "../../api/users";
import { getRoles, type Role } from "../../api/roles";
import UsersTable from "../../components/users/UsersTable";
import { useTheme } from "../../context/ThemeContext";
import { FaPlus } from "react-icons/fa";

export default function UsersPage() {
  const { theme } = useTheme();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(1);
  const [roles, setRoles] = useState<Role[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const res = await getRoles();
      setRoles(res.data);
      if (res.data.length > 0) setRoleId(res.data[0].id);
    } catch {
      setError("Failed to load roles");
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

  const iconBtn: React.CSSProperties = {
    height: 34,
    width: 34,
    borderRadius: 6,
    border: "none",
    background: theme.colors.primary,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  // 🚀 Create User
  const handleCreate = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("All fields required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      await createUser({
        username,
        email,
        password,
        role_id: roleId,
      });

      setUsername("");
      setEmail("");
      setPassword("");

      setSuccess("User created successfully");
      setRefreshToken((v) => v + 1);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* 🔥 CREATE USER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {/* INPUTS */}
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ ...input, flex: 1 }}
          />

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...input, flex: 1 }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...input, flex: 1 }}
          />

          <select
            value={roleId}
            onChange={(e) => setRoleId(Number(e.target.value))}
            style={{ ...input, width: 160 }}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* ADD BUTTON */}
        <button
          style={iconBtn}
          onClick={handleCreate}
          disabled={submitting}
          title="Add User"
        >
          <FaPlus />
        </button>
      </div>

      {/* 🔥 STATUS */}
      {(error || success) && (
        <div style={{ fontSize: 13 }}>
          {error && (
            <div style={{ color: theme.colors.danger }}>{error}</div>
          )}
          {success && (
            <div style={{ color: theme.colors.success }}>{success}</div>
          )}
        </div>
      )}

      {/* 🔥 USERS TABLE */}
      <div
        style={{
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <UsersTable refreshToken={refreshToken} />
      </div>
    </div>
  );
}