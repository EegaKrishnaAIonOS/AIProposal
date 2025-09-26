import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// Import the eye icons from react-icons/fa
import { FaEye, FaEyeSlash } from "react-icons/fa";
 
import LOGO_PATH from "../assets/AIONOS_logo.png";
 
const VALID_CREDENTIALS = [
  { email: "Admin@gmail.com", password: "Admin@123", role: "admin" },
  { email: "Manager@gmail.com", password: "Manager@123", role: "manager" }
];

function Login({ onAuth }) {
  const navigate = useNavigate();
  // Capture optional next target from query string so CTA returns post-login
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '/rfp';

  // If the page was reached by a browser reload/refresh, send user back to landing
  useEffect(() => {
    try {
      const navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
      const navType = (navEntries && navEntries.length > 0) ? navEntries[0].type : (performance && performance.navigation ? performance.navigation.type : null);
      const isReload = navType === 'reload' || navType === 1;
      if (isReload) {
        navigate('/');
      }
    } catch (e) {
      // ignore errors and do not block login
    }
  }, [navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [codeStep, setCodeStep] = useState(0); // 0: email, 1: code, 2: new password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [vibrate, setVibrate] = useState(false);
  const timeoutRef = useRef(null);
 
 const handleSubmit = (e) => {
    e.preventDefault();
    const match = VALID_CREDENTIALS.find(c => c.email === email && c.password === password);
    if (match) {
      setError("");
      // Persist a simple session flag so auth survives refresh in this demo
      try {
        sessionStorage.setItem('aionos_auth', '1');
        sessionStorage.setItem('aionos_user_email', match.email);
        sessionStorage.setItem('aionos_user_role', match.role);
      } catch (err) { /* ignore */ }
      if (typeof onAuth === 'function') onAuth();
      // Redirect to the RFP Solution Generator page after login
      navigate("/rfp");
    } else {
      setError("Invalid Email or Password");
    }
  };
 
  const togglePasswordVisibility = () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
 
    // Toggle password visibility
    setShowPassword(true);
 
    // Set a new timeout to hide the password after 2 seconds
    timeoutRef.current = setTimeout(() => {
      setShowPassword(false);
    }, 2000);
  };
 
  function generateRandomCode() {
    // Generate a random 5-8 digit numeric code as a string
    const length = Math.floor(Math.random() * 4) + 5; // 5 to 8 digits
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10);
    }
    return code;
  }
 
  function isPasswordValid(password, email) {
    // Disallow sequential numbers/letters and full name/email
    const lower = password.toLowerCase();
    if (/^(?:\d{5,}|abcdefghijklmnopqrstuvwxyz|qwertyuiop|asdfghjkl|zxcvbnm)$/.test(lower)) return false;
    if (/0123456789|12345678|23456789|34567890|abcdefg|bcdefgh|cdefghi|defghij|efghijk|fghijkl|ghijklm|hijklmn|ijklmnop|jklmnopq|klmnopqr|lmnopqrs|mnopqrst|nopqrstu|opqrstuv|pqrstuvw|qrstuvwx|rstuvwxy|stuvwxyz/.test(lower)) return false;
    if (email && lower.includes(email.split('@')[0].toLowerCase())) return false;
    return true;
  }
 
  const handleForgot = (e) => {
    e.preventDefault();
    setShowForgot(true);
    setForgotEmail("");
    setSentCode("");
    setEnteredCode("");
    setCodeStep(0);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setVibrate(false);
  };
 
  const handleSendCode = (e) => {
    e.preventDefault();
    if (!forgotEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(forgotEmail)) {
      setPasswordError("Enter a valid email address.");
      return;
    }
    const code = generateRandomCode();
    setSentCode(code);
    setCodeStep(1);
    setPasswordError("");
    // In real app, send code to email here
  };
 
  const handleVerifyCode = (e) => {
    e.preventDefault();
    if (enteredCode === sentCode) {
      setCodeStep(2);
      setPasswordError("");
    } else {
      setPasswordError("Invalid code. Please check your email and try again.");
    }
  };
 
  const handleResetPassword = (e) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (!isPasswordValid(newPassword, forgotEmail)) {
      setPasswordError("Password does not meet guidelines. Avoid sequences, your name, or email.");
      setVibrate(true);
      setTimeout(() => setVibrate(false), 1500);
      return;
    }
    setShowForgot(false);
    setPasswordError("");
    setVibrate(false);
    // In real app, update password in backend here
    setTimeout(() => alert("Password reset successful! Please login with your new password."), 100);
  };
 
  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "Inter, sans-serif" }}>
      {/* Left Panel */}
      <div style={{ flex: 1, background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "1rem" }}>AI Proposals</h1>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "500", marginBottom: "1rem" }}>AI-Powered EDA & Anomaly Detection</h2>
        <p style={{ fontSize: "1rem", maxWidth: "400px", textAlign: "justify" }}>
          Enhance your proposals with enterprise-grade AI. Automate technical analysis and generate actionable insights for compelling, data-driven proposals.
        </p>
      </div>
      {/* Right Panel */}
      <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px" }}>
        <img src={LOGO_PATH} alt="AionOS Logo" style={{ width: "80px", marginBottom: "2rem" }} />
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <h2 style={{ fontWeight: "bold", fontSize: "1.75rem", marginBottom: "0.5rem", textAlign: "left" }}>Welcome Back</h2>
          <p style={{ color: "#555", marginBottom: "2rem", textAlign: "left" }}>Sign in to access your analytics dashboard</p>
          {!showForgot ? (
            <form onSubmit={handleSubmit}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "1rem" }}
                autoComplete="username"
                required
              />
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Password</label>
              <div style={{ position: "relative", marginBottom: "1rem" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "1rem" }}
                  autoComplete="current-password"
                  required
                />
                <span
                  onClick={togglePasswordVisibility}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <FaEye size={20} color="#6b7280" />
                  ) : (
                    <FaEyeSlash size={20} color="#6b7280" />
                  )}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", fontSize: "0.95rem" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  Remember me
                </label>
                <a href="#" onClick={handleForgot} style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.95rem" }}>Forgot password?</a>
              </div>
              {error && <div style={{ color: "#ef4444", marginBottom: "1rem", fontWeight: "500" }}>{error}</div>}
              <button
                type="submit"
                style={{ width: "100%", background: "#2563eb", color: "#fff", padding: "0.75rem", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", border: "none", cursor: "pointer", marginBottom: "1rem" }}
              >
                Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={codeStep === 0 ? handleSendCode : codeStep === 1 ? handleVerifyCode : handleResetPassword}>
              {codeStep === 0 && (
                <>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Enter your email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="Enter your email"
                    style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "1rem" }}
                    autoComplete="username"
                    required
                  />
                  <button
                    type="submit"
                    style={{ width: "100%", background: "#2563eb", color: "#fff", padding: "0.75rem", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", border: "none", cursor: "pointer", marginBottom: "1rem" }}
                  >
                    Send Code
                  </button>
                </>
              )}
              {codeStep === 1 && (
                <>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Enter the code</label>
                  <input
                    type="text"
                    value={enteredCode}
                    onChange={e => setEnteredCode(e.target.value)}
                    placeholder="Enter the code sent to your email"
                    style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "1rem" }}
                    required
                  />
                  <button
                    type="submit"
                    style={{ width: "100%", background: "#2563eb", color: "#fff", padding: "0.75rem", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", border: "none", cursor: "pointer", marginBottom: "1rem" }}
                  >
                    Verify Code
                  </button>
                </>
              )}
              {codeStep === 2 && (
                <>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "1rem" }}
                    autoComplete="new-password"
                    required
                  />
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "1rem" }}
                    autoComplete="new-password"
                    required
                  />
                  {vibrate && (
                    <div style={{ color: "#ef4444", marginBottom: "1rem", fontWeight: "500", animation: "vibrate 0.3s linear infinite" }}>
                      {passwordError}
                    </div>
                  )}
                  <button
                    type="submit"
                    style={{ width: "100%", background: "#2563eb", color: "#fff", padding: "0.75rem", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", border: "none", cursor: "pointer", marginBottom: "1rem" }}
                  >
                    Reset Password
                  </button>
                </>
              )}
              <div style={{ textAlign: "center", color: "#888", fontSize: "0.85rem", marginTop: "2rem" }}>
                Enterprise AI Analytics Platform<br />© 2024 AionOS. All rights reserved.
              </div>
            </form>
          )}
        </div>
      </div>
      {/* Forgot Password Modal */}
      {showForgot && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
            padding: '2rem 2.5rem',
            minWidth: '320px',
            textAlign: 'center',
            zIndex: 1001
          }}>
            {codeStep === 0 && (
              <form onSubmit={handleSendCode}>
                <h2 style={{ fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '1rem' }}>Forgot Password</h2>
                <p style={{ marginBottom: '1rem', color: '#444' }}>Enter your email address to receive a verification code.</p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="Email address"
                  style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '1rem' }}
                  required
                />
                <button type="submit" style={{ width: '100%', background: '#2563eb', color: '#fff', padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', cursor: 'pointer', marginBottom: '1rem' }}>Send Code</button>
                <button type="button" onClick={() => setShowForgot(false)} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: '6px', padding: '0.5rem 1.5rem', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              </form>
            )}
            {codeStep === 1 && (
              <form onSubmit={handleVerifyCode}>
                <h2 style={{ fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '1rem' }}>Enter Verification Code</h2>
                <p style={{ marginBottom: '1rem', color: '#444' }}>A code has been sent to your email.</p>
                <input
                  type="text"
                  value={enteredCode}
                  onChange={e => setEnteredCode(e.target.value)}
                  placeholder="Enter code"
                  style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '1rem', letterSpacing: '0.2em' }}
                  required
                />
                <button type="submit" style={{ width: '100%', background: '#2563eb', color: '#fff', padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', cursor: 'pointer', marginBottom: '1rem' }}>Verify</button>
                <button type="button" onClick={() => setShowForgot(false)} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: '6px', padding: '0.5rem 1.5rem', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              </form>
            )}
            {codeStep === 2 && (
              <form onSubmit={handleResetPassword}>
                <h2 style={{ fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '1rem' }}>Create New Password</h2>
                <p style={{ marginBottom: '1rem', color: '#444' }}>Set a new password for your account.</p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password"
                  style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', border: vibrate ? '2px solid #ef4444' : '1px solid #e5e7eb', fontSize: '1rem', animation: vibrate ? 'vibrate 0.15s linear 0s 10' : 'none' }}
                  required
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', border: vibrate ? '2px solid #ef4444' : '1px solid #e5e7eb', fontSize: '1rem', animation: vibrate ? 'vibrate 0.15s linear 0s 10' : 'none' }}
                  required
                />
                <div style={{ color: '#ef4444', minHeight: '1.5em', marginBottom: '1rem', fontWeight: '500' }}>{passwordError}</div>
                <button type="submit" style={{ width: '100%', background: '#2563eb', color: '#fff', padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', cursor: 'pointer', marginBottom: '1rem' }}>Reset Password</button>
                <button type="button" onClick={() => setShowForgot(false)} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: '6px', padding: '0.5rem 1.5rem', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <div style={{ color: '#888', fontSize: '0.9em', marginTop: '1rem', textAlign: 'left' }}>
                  <b>Password guidelines:</b><br />
                  - No sequential numbers/letters (e.g., 123456, abcdefg)<br />
                  - Cannot contain your name or email<br />
                  - Must be at least 8 characters
                </div>
              </form>
            )}
            {passwordError && <div style={{ color: '#ef4444', marginTop: '1rem', fontWeight: '500' }}>{passwordError}</div>}
          </div>
        </div>
      )}
      <style>{`
        @keyframes vibrate {
          0% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
 
export default Login;