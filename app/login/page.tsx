"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
      const users = await res.json();

      let user = users.find((u: any) => {
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
        showNotification("success", "Login Successful ✅");

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
          <div style={styles.toastIcon}>{notification.type === "success" ? "✓" : "!"}</div>
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

      <div style={styles.card}>
        <div style={styles.headerWrap}>
          <h2 style={styles.title}>Login</h2>
        </div>

        <input
          placeholder="Email"
          className="placeholder:text-slate-300 placeholder:font-bold"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
          style={styles.input}
          onFocus={(e) => {
            e.currentTarget.style.transform = "translateY(-1px) scale(1.01)";
            e.currentTarget.style.boxShadow =
              "0 0 0 2px rgba(96,165,250,0.7), 0 12px 28px rgba(37,99,235,0.3)";
            e.currentTarget.style.border = "1px solid rgba(147,197,253,0.95)";
            e.currentTarget.style.background = "rgba(0,0,0,0.35)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.20)";
            e.currentTarget.style.border = "1px solid rgba(255,255,255,0.25)";
            e.currentTarget.style.background = "rgba(0,0,0,0.20)";
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
        />

        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          className="placeholder:text-slate-300 placeholder:font-bold"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
          style={styles.input}
          onFocus={(e) => {
            e.currentTarget.style.transform = "translateY(-1px) scale(1.01)";
            e.currentTarget.style.boxShadow =
              "0 0 0 2px rgba(96,165,250,0.7), 0 12px 28px rgba(37,99,235,0.3)";
            e.currentTarget.style.border = "1px solid rgba(147,197,253,0.95)";
            e.currentTarget.style.background = "rgba(0,0,0,0.35)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.20)";
            e.currentTarget.style.border = "1px solid rgba(255,255,255,0.25)";
            e.currentTarget.style.background = "rgba(0,0,0,0.20)";
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
        />

        <label style={styles.passwordOption}>
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          Show password
        </label>

        
        <button
          onClick={handleLogin}
          style={styles.btn}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
            e.currentTarget.style.boxShadow =
              "0 18px 35px rgba(37, 99, 235, 0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "0 12px 24px rgba(37, 99, 235, 0.25)";
          }}
        >
          Login
        </button>

        <p
          onClick={() => router.push("/signup")}
          style={styles.link}
        >
          New user? Signup
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundImage:
      "linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('5137774.webp')",
    backgroundSize: "cover",
    backgroundPosition: "center",
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
    marginBottom: "8px",
  },

  badge: {
    alignSelf: "flex-start",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "rgba(96,165,250,0.12)",
    border: "1px solid rgba(147,197,253,0.26)",
    color: "#dbeafe",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "2.75rem",
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },

  card: {
    position: "relative" as const,
    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04))",
    backdropFilter: "blur(16px) saturate(190%)",
    WebkitBackdropFilter: "blur(16px) saturate(190%)",
    borderRadius: "36px",
    padding: "58px 52px",
    width: "720px",
    maxWidth: "95vw",
    display: "flex",
    flexDirection: "column" as const,
    gap: "26px",
    border: "1px solid rgba(255, 255, 255, 0.32)",
    boxShadow: "0 35px 80px rgba(0, 0, 0, 0.38), inset 0 1px 2px rgba(255, 255, 255, 0.45)",
    transition: "all 0.35s ease",
    transform: "translateY(0)",
  },

  input: {
    padding: "18px 22px",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    borderRadius: "18px",
    background: "rgba(0, 0, 0, 0.20)",
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "0.01em",
    transition: "all 0.25s ease",
    outline: "none",
    boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.20)",
  },

  passwordOption: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#f8fafc",
    fontSize: "16px",
    fontWeight: 700,
    marginTop: "-4px",
    cursor: "pointer",
  },

  btn: {
    padding: "18px 22px",
    background: "linear-gradient(135deg, #93c5fd 0%, #60a5fa 30%, #2563eb 100%)",
    border: "none",
    borderRadius: "18px",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: 900,
    letterSpacing: "0.06em",
    transition: "all 0.3s ease",
    boxShadow: "0 14px 28px rgba(37, 99, 235, 0.35)",
  },

  link: {
    textAlign: "center" as const,
    cursor: "pointer",
    color: "#93c5fd",
    fontSize: "16px",
    fontWeight: 800,
    letterSpacing: "0.01em",
    transition: "all 0.2s ease",
    marginTop: "-4px",
  },
};