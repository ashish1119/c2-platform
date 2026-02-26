import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const user = await login(username, password);

      console.log("Logged in user:", user); // Debug

      if (user.role === "ADMIN") {
        navigate("/admin");
      } else if (user.role === "OPERATOR") {
        navigate("/operator");
      }
    } catch (error) {
      console.error("Login failed", error);
      alert("Invalid credentials");
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme.colors.background,
      }}
    >
      <div
        style={{
          width: "360px",
          padding: theme.spacing.xl,
          background: theme.colors.surface,
          borderRadius: theme.radius.lg,
          boxShadow: theme.shadows.md,
        }}
      >
        <h2 style={{ marginBottom: theme.spacing.lg }}>
          C2 Login
        </h2>

        <input
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: theme.spacing.sm,
            marginBottom: theme.spacing.md,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
          }}
        />

        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: theme.spacing.sm,
            marginBottom: theme.spacing.lg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
          }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: theme.spacing.sm,
            background: theme.colors.primary,
            color: "#fff",
            border: "none",
            borderRadius: theme.radius.md,
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </div>
    </div>
  );
}