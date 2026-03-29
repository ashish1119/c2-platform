// import { useState } from "react";
// import axios from "axios";
// import { useAuth } from "../context/AuthContext";
// import { useNavigate } from "react-router-dom";
// import { useTheme } from "../context/ThemeContext";

// export default function LoginPage() {
//   const { login } = useAuth();
//   const navigate = useNavigate();
//   const { theme } = useTheme();

//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();

//     try {
//       const user = await login(username, password);

//       console.log("Logged in user:", user); // Debug

//       if (user.role === "ADMIN") {
//         navigate("/admin");
//       } else if (user.role === "OPERATOR") {
//         navigate("/operator");
//       }
//     } catch (error) {
//       console.error("Login failed", error);
//       if (axios.isAxiosError(error)) {
//         if (error.response?.status === 401) {
//           alert("Invalid credentials");
//           return;
//         }

//         if (!error.response) {
//           alert("Unable to reach server. Please open this app with your server IP (for example http://<server-ip>:3000) and ensure backend port 8000 is reachable.");
//           return;
//         }
//       }

//       alert("Login failed. Please try again.");
//     }
//   };

//   return (
//     <div
//       style={{
//         height: "100vh",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         background: theme.colors.background,
//       }}
//     >
//       <div
//         style={{
//           width: "360px",
//           padding: theme.spacing.xl,
//           background: theme.colors.surface,
//           borderRadius: theme.radius.lg,
//           boxShadow: theme.shadows.md,
//         }}
//       >
//         <h2 style={{ marginBottom: theme.spacing.lg }}>
//           C2 Login
//         </h2>

//         <input
//           placeholder="Username"
//           onChange={(e) => setUsername(e.target.value)}
//           style={{
//             width: "100%",
//             padding: theme.spacing.sm,
//             marginBottom: theme.spacing.md,
//             border: `1px solid ${theme.colors.border}`,
//             borderRadius: theme.radius.sm,
//           }}
//         />

//         <input
//           type="password"
//           placeholder="Password"
//           onChange={(e) => setPassword(e.target.value)}
//           style={{
//             width: "100%",
//             padding: theme.spacing.sm,
//             marginBottom: theme.spacing.lg,
//             border: `1px solid ${theme.colors.border}`,
//             borderRadius: theme.radius.sm,
//           }}
//         />

//         <button
//           onClick={handleLogin}
//           style={{
//             width: "100%",
//             padding: theme.spacing.sm,
//             background: theme.colors.primary,
//             color: "#fff",
//             border: "none",
//             borderRadius: theme.radius.md,
//             cursor: "pointer",
//           }}
//         >
//           Login
//         </button>
//       </div>
//     </div>
//   );
// }

import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { confirmPasswordReset, requestPasswordReset } from "../api/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "confirm">("request");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);

    try {
      const user = await login(username, password);
      if (user.role === "ADMIN") navigate("/admin");
      else if (user.role === "OPERATOR") navigate("/operator");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) { setLoginError("Invalid credentials"); return; }
        if (!error.response) { setLoginError("Server not reachable."); return; }
      }
      setLoginError("Login failed. Please try again.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetError(null);
    setResetInfo(null);

    try {
      if (resetStep === "request") {
        await requestPasswordReset({ identifier: resetIdentifier.trim() });
        setResetStep("confirm");
        setResetInfo("If the account exists, a reset token has been issued.");
        return;
      }

      if (resetNewPassword !== resetConfirmPassword) {
        setResetError("Passwords do not match.");
        return;
      }

      await confirmPasswordReset({
        token: resetToken.trim(),
        new_password: resetNewPassword,
      });
      setResetInfo("Password reset successful. Please login with your new password.");
      setShowResetForm(false);
      setResetStep("request");
      setResetIdentifier("");
      setResetToken("");
      setResetNewPassword("");
      setResetConfirmPassword("");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setResetError(error.response?.data?.detail || "Password reset failed");
        return;
      }
      setResetError("Password reset failed");
    }
  };

  const isDark = theme.mode === 'dark';
  const cardBackground = isDark ? '#1E1E2F' : '#FFF';
  const inputBackground = isDark ? '#2C2C3E' : '#F7F9FF';
  const primaryColor = isDark ? '#4E8CFF' : '#007BFF';
  const accentColor = isDark ? '#FF6B6B' : '#FF4D4D';
  const passwordIconColor = isDark ? '#CBD5E1' : '#475569';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0F0F1A' : '#E0F7FF', fontFamily: 'Poppins, sans-serif', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '450px', padding: '40px', borderRadius: '20px', background: cardBackground, boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.7)' : '0 20px 50px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '20px', borderTop: `6px solid ${primaryColor}`, transition: 'all 0.3s' }}>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, color: primaryColor }}>C2 Platform</h1>
          <p style={{ margin: '8px 0', color: theme.colors.textSecondary }}>Sign in to start your session</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            placeholder='Username'
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            style={{ padding: '14px', border: '2px solid transparent', borderRadius: '12px', background: inputBackground, color: isDark ? '#fff' : '#000', fontSize: '15px', outline: 'none', transition: 'border 0.3s' }}
            onFocus={(e) => e.currentTarget.style.border = `2px solid ${primaryColor}`}
            onBlur={(e) => e.currentTarget.style.border = '2px solid transparent'}
          />

          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder='Password'
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '14px 44px 14px 14px', border: '2px solid transparent', borderRadius: '12px', background: inputBackground, color: isDark ? '#fff' : '#000', fontSize: '15px', outline: 'none', transition: 'border 0.3s' }}
              onFocus={(e) => e.currentTarget.style.border = `2px solid ${primaryColor}`}
              onBlur={(e) => e.currentTarget.style.border = '2px solid transparent'}
            />
            <span onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: passwordIconColor }}>
              {showPassword ? <FaEye /> : < FaEyeSlash />}
            </span>
          </div>

          <button type='submit' style={{ padding: '14px', background: primaryColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, fontSize: '16px', cursor: 'pointer', transition: '0.3s' }} onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')} onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}>Login</button>
          {loginError && (
            <div style={{ color: accentColor, fontSize: '13px' }}>
              {loginError}
            </div>
          )}
        </form>

        {showResetForm && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {resetStep === 'request' ? (
              <>
                <input
                  placeholder='Username or email'
                  value={resetIdentifier}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetIdentifier(e.target.value)}
                  style={{ padding: '14px', border: '2px solid transparent', borderRadius: '12px', background: inputBackground, color: isDark ? '#fff' : '#000', fontSize: '15px', outline: 'none' }}
                />
                <button type='submit' style={{ padding: '12px', background: primaryColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Request Reset Token
                </button>
              </>
            ) : (
              <>
                <input
                  placeholder='Reset token'
                  value={resetToken}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetToken(e.target.value)}
                  style={{ padding: '14px', border: '2px solid transparent', borderRadius: '12px', background: inputBackground, color: isDark ? '#fff' : '#000', fontSize: '15px', outline: 'none' }}
                />
                <input
                  type='password'
                  placeholder='New password'
                  value={resetNewPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetNewPassword(e.target.value)}
                  style={{ padding: '14px', border: '2px solid transparent', borderRadius: '12px', background: inputBackground, color: isDark ? '#fff' : '#000', fontSize: '15px', outline: 'none' }}
                />
                <input
                  type='password'
                  placeholder='Confirm new password'
                  value={resetConfirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetConfirmPassword(e.target.value)}
                  style={{ padding: '14px', border: '2px solid transparent', borderRadius: '12px', background: inputBackground, color: isDark ? '#fff' : '#000', fontSize: '15px', outline: 'none' }}
                />
                <button type='submit' style={{ padding: '12px', background: primaryColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Confirm Password Reset
                </button>
              </>
            )}
            {resetInfo && (
              <div style={{ color: theme.colors.textSecondary, fontSize: '13px' }}>
                {resetInfo}
              </div>
            )}
            {resetError && (
              <div style={{ color: accentColor, fontSize: '13px' }}>
                {resetError}
              </div>
            )}
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '10px', color: theme.colors.textSecondary }}>
          <span>
            Forgot your password?{' '}
            <a href='#' onClick={(e) => { e.preventDefault(); setShowResetForm((current) => !current); }} style={{ color: accentColor, fontWeight: 600 }}>
              {showResetForm ? 'Hide Reset' : 'Reset'}
            </a>
          </span>
        </div>

      </div>
    </div>
  );
}