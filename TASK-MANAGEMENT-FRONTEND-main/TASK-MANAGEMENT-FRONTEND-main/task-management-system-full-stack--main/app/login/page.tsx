"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LoginUser = {
  email: string;
  password?: string;
  role?: string;
  name?: string;
};

export default function Login() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
  };

  const closeNotification = () => setNotification(null);

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => setNotification(null), 3200);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        showNotification("error", "Unable to connect to database. Please check MySQL server.");
        return;
      }
      const users: LoginUser[] = await res.json();

      let user = users.find((u) => {
        const dbEmail = u.email?.trim().toLowerCase();
        const inputEmail = form.email.trim().toLowerCase();

        const dbPassword = u.password?.trim();
        const inputPassword = form.password.trim();

        return dbEmail === inputEmail && dbPassword === inputPassword;
      });

      // Direct guarantee for default master admin
      if (!user && form.email.trim().toLowerCase() === "admin@gmail.com" && form.password.trim() === "admin@123") {
        user = {
          email: "admin@gmail.com",
          role: "admin",
          name: "Admin",
        };
      }

      if (user) {
        showNotification("success", "Login successful");

        const role = user.role?.trim().toLowerCase() || "user";
        localStorage.setItem("loggedUser", user.email);
        localStorage.setItem("userRole", role);

        if (role === "admin") router.push("/admin");
        else if (role === "manager") router.push("/manager");
        else if (role === "team") router.push("/team");
        else router.push("/user");
      } else {
        showNotification("error", "Invalid Credentials ❌");
      }
    } catch (error) {
      console.error(error);
      showNotification("error", "Login failed ❌ Check console");
    }
  };

  return (
    <div style={styles.container}>
      {notification && (
        <div style={{
          ...styles.toast,
          ...(notification.type === "success" ? styles.toastSuccess : styles.toastError),
        }}>
          <div style={styles.toastGlow} />
          <div style={styles.toastIcon}>{notification.type === "success" ? "OK" : "!"}</div>
          <div style={styles.toastBody}>
            <div style={styles.toastTitle}>{notification.type === "success" ? "Success" : "Error"}</div>
            <div style={styles.toastMessage}>{notification.message}</div>
          </div>
          <button type="button" onClick={closeNotification} style={styles.toastClose} aria-label="Close notification">
            ×
          </button>
          <div style={styles.toastProgress} />
        </div>
      )}

      <div
        style={styles.card}
        className="transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/50 hover:shadow-[0_40px_90px_rgba(0,0,0,0.48)]"
      >
        <div style={styles.brand}>
          <div style={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 24, height: 24 }}>
              <rect x="5" y="4" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 4.5h6M9 10h6M9 14h6M9 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M7.5 10h.01M7.5 14h.01M7.5 18h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={styles.brandName}>Task Management</span>
        </div>

        <div style={styles.headerWrap}>
          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.subtitle}>Sign in to continue to your workspace.</p>
        </div>

        <label htmlFor="login-email" style={styles.fieldLabel}>Email address</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={styles.input}
        />

        <label htmlFor="login-password" style={styles.fieldLabel}>Password</label>
        <input
          id="login-password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your password"
          className="w-full focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          style={styles.input}
        />

        <label style={styles.passwordOption}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          Show password
        </label>

        <button
          type="button"
          onClick={handleLogin}
          style={styles.btn}
          className="transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
        >
          Sign in
        </button>

        <button
          type="button"
          onClick={() => router.push("/signup")}
          style={styles.link}
          className="transition hover:text-blue-800"
        >
          <span>New to Task Management?</span>
          <span style={styles.linkAction}>Create an account</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px 16px",
    boxSizing: "border-box" as const,
    backgroundImage:
      "linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('/5137774.webp')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    fontFamily: "Arial, Helvetica, sans-serif",
  },

  toast: {
    position: "fixed" as const,
    top: "24px",
    right: "24px",
    zIndex: 9999,
    minWidth: "320px",
    maxWidth: "420px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "16px 18px 14px 16px",
    borderRadius: "18px",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 25px 60px rgba(15, 23, 42, 0.42), inset 0 1px 0 rgba(255,255,255,0.2)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    color: "#fff",
    overflow: "hidden",
    animation: "toastSlideIn 0.35s ease",
  },

  toastSuccess: {
    background: "linear-gradient(135deg, rgba(16,185,129,0.9), rgba(6,95,70,0.9))",
  },

  toastError: {
    background: "linear-gradient(135deg, rgba(248,113,113,0.95), rgba(127,29,29,0.9))",
  },

  toastGlow: {
    position: "absolute" as const,
    inset: "-30% auto auto -18%",
    width: "120px",
    height: "120px",
    background: "rgba(255,255,255,0.14)",
    filter: "blur(18px)",
    borderRadius: "999px",
  },

  toastIcon: {
    position: "relative" as const,
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    fontSize: "18px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
    flexShrink: 0,
  },

  toastBody: {
    position: "relative" as const,
    flex: 1,
    minWidth: 0,
  },

  toastTitle: {
    position: "relative" as const,
    fontWeight: "800",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    marginBottom: "3px",
    color: "rgba(255,255,255,0.9)",
  },

  toastMessage: {
    position: "relative" as const,
    fontSize: "14px",
    lineHeight: 1.4,
    color: "rgba(255,255,255,0.96)",
    wordBreak: "break-word" as const,
  },

  toastClose: {
    position: "relative" as const,
    width: "26px",
    height: "26px",
    border: "none",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    marginLeft: "6px",
  },

  toastProgress: {
    position: "absolute" as const,
    left: 0,
    bottom: 0,
    height: "4px",
    width: "100%",
    background: "rgba(255,255,255,0.24)",
    animation: "toastProgress 3.2s linear forwards",
  },

  headerWrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    marginBottom: "10px",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "18px",
  },

  brandMark: {
    width: "42px",
    height: "42px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "12px",
    background: "#2563eb",
    color: "#ffffff",
    boxShadow: "0 6px 14px rgba(37, 99, 235, 0.24)",
    flexShrink: 0,
  },

  brandName: {
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 750,
    letterSpacing: "-0.02em",
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "30px",
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    margin: 0,
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "15px",
    lineHeight: 1.5,
  },

  fieldLabel: {
    marginBottom: "-10px",
    color: "#f1f5f9",
    fontSize: "14px",
    fontWeight: 650,
  },

  card: {
    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04))",
    backdropFilter: "blur(16px) saturate(190%)",
    WebkitBackdropFilter: "blur(16px) saturate(190%)",
    borderRadius: "36px",
    padding: "42px 36px",
    width: "600px",
    maxWidth: "100%",
    boxSizing: "border-box" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    border: "1px solid rgba(255, 255, 255, 0.32)",
    boxShadow: "0 35px 80px rgba(0, 0, 0, 0.38), inset 0 1px 2px rgba(255, 255, 255, 0.45)",
  },

  input: {
    padding: "13px 14px",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    borderRadius: "12px",
    background: "rgba(0, 0, 0, 0.20)",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 400,
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    outline: "none",
    boxSizing: "border-box" as const,
    marginBottom: "2px",
  },

  passwordOption: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#f8fafc",
    fontSize: "14px",
    fontWeight: 500,
    marginTop: "-2px",
    cursor: "pointer",
  },

  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#60a5fa",
    cursor: "pointer",
  },

  btn: {
    padding: "14px 18px",
    background: "#2563eb",
    border: "none",
    borderRadius: "10px",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 650,
    transition: "filter 0.2s ease",
    boxShadow: "0 4px 10px rgba(37, 99, 235, 0.18)",
    marginTop: "4px",
  },

  link: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap" as const,
    gap: "5px",
    marginTop: "4px",
    padding: "8px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 500,
  },

  linkAction: {
    color: "#2563eb",
    fontWeight: 650,
  },
};