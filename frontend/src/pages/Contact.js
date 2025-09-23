import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Contact() {
  const navigate = useNavigate();

  const handleBack = () => navigate('/');

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: '#f8fafc' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 36px', background: '#fff', borderBottom: '1px solid #eef2f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#2563eb"/></svg>
          </div>
          <div style={{ fontWeight: 700, color: '#2563eb', fontSize: 18 }}>RFP Solution Generator</div>
        </div>
        <div>
          <button onClick={handleBack} style={{ background: '#fff', color: '#111827', border: '1px solid #e6edf3', padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}>Back</button>
        </div>
      </header>

      <main style={{ padding: '48px 20px', maxWidth: 900, margin: '0 auto' }}>
        <section style={{ background: '#fff', padding: 28, borderRadius: 12, boxShadow: '0 6px 18px rgba(15,23,42,0.03)' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Contact Sales</h2>
          <p style={{ color: '#64748b', marginBottom: 18 }}>For demos, pricing, or enterprise enquiries, contact our sales team.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 8, background: '#f8fafc' }}>
              <b>Email:</b> sales@aionos.ai
            </div>
            <div style={{ padding: 14, borderRadius: 8, background: '#f8fafc' }}>
              <b>Phone:</b> +1 (555) 123-4567
            </div>
            <div style={{ padding: 14, borderRadius: 8, background: '#f8fafc' }}>
              <b>Address:</b> 123 AIonOS Plaza, Innovation Park
            </div>
          </div>
        </section>
      </main>

      <footer style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>© 2024 AIONOS. All rights reserved.</footer>
    </div>
  );
}
