import React from "react";
import { useNavigate } from "react-router-dom";
 
function Home() {
  const navigate = useNavigate();
 
  // Changed the function back to redirect to the login route ("/")
  const handleLogout = () => {
    navigate("/login");
  };
 
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1.5rem" }}>AI Proposal Generator</h1>
      <button
        onClick={handleLogout}
        style={{ background: "#2563eb", color: "#fff", padding: "0.5rem 1.5rem", borderRadius: "8px", fontWeight: "bold", fontSize: "1rem", border: "none", cursor: "pointer" }}
      >
        Logout
      </button>
    </div>
  );
}
 
export default Home;