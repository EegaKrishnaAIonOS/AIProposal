import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, History, FilePlus, Lock, Users } from 'lucide-react';

function Home() {
  const navigate = useNavigate();

  const isAuthed = () => {
    try { return sessionStorage.getItem('aionos_auth') === '1'; } catch (err) { return false; }
  };

  const handleCTA = (/*target*/) => {
    try { console.log('Home CTA clicked'); } catch(e){}
    if (!isAuthed()) {
      // pass a `next` parameter so after login user returns to the RFP page
      navigate('/login?next=/rfp');
      // If client-side navigation fails (some dev-server/hmr race), fallback to full reload
      setTimeout(() => {
        try {
          const p = window.location.pathname;
          if (p === '/' || p === '/home') {
            window.location.href = '/login?next=/rfp';
          }
        } catch (e) {}
      }, 150);
      return;
    }
    navigate('/rfp');
  };

  // const handleCTA = () => {
  //   // Navigating directly to /rfp will be handled by ProtectedRoute
  //   // The ProtectedRoute will redirect to /login if the user is not authenticated.
  //   navigate('/rfp');
  // };

  const openContact = () => navigate('/contact');

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: '#f8fafc' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 36px', background: '#fff', borderBottom: '1px solid #eef2f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#2563eb"/></svg>
          </div>
          <div style={{ fontWeight: 700, color: '#2563eb', fontSize: 18 }}>RFP Solution Generator</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => handleCTA('generate')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>Generate RFP</button>
          <button onClick={openContact} style={{ background: '#fff', color: '#111827', border: '1px solid #e6edf3', padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}>Contact</button>
        </div>
      </header>

      <main style={{ padding: '48px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <section style={{ textAlign: 'center', padding: '56px 20px', borderRadius: 14, background: 'linear-gradient(90deg, #ffffff 0%, #f1f8ff 100%)' }}>
          <div style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: 999, marginBottom: 18 }}>Professional Proposal Automation</div>
          <h1 style={{ fontSize: 56, margin: '8px 0', color: '#111827', fontWeight: 800 }}>RFP Solution Generator</h1>
          <p style={{ color: '#6b7280', fontSize: 18, maxWidth: 800, margin: '12px auto 24px' }}>Transform your RFP process with AI-powered automation. Generate professional proposals, manage solutions, and streamline your team's workflow.</p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 26 }}>
            <button onClick={() => handleCTA('get-started')} style={{ background: '#2b6df6', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Get Started Now</button>
            <button onClick={() => handleCTA('generate')} style={{ background: '#fff', color: '#111827', border: '1px solid #e6edf3', padding: '12px 24px', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>View Interface</button>
          </div>
        </section>

        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', marginBottom: 10, textAlign: 'center' }}>Comprehensive RFP Solution Platform</h2>
          <p style={{ textAlign: 'center', color: '#475569', maxWidth: 900, margin: '0 auto 24px' }}>Everything you need to streamline your proposal process and win more business</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            <FeatureCard title="RFP Document Upload" desc="Upload PDF or DOCX RFP documents and generate structured, client-ready proposals automatically." icon={<Upload size={20} color="#2563eb" />}/>
            <FeatureCard title="Problem Statement Input" desc="Generate solutions directly from problem statements when no RFP document is available." icon={<FileText size={20} color="#2563eb" />}/>
            <FeatureCard title="Solutions History" desc="Access complete history of all generated solutions with easy retrieval." icon={<History size={20} color="#2563eb" />}/>
            <FeatureCard title="Manual Solution Upload" desc="Store manually created documents alongside AI-generated solutions for centralized management." icon={<FilePlus size={20} color="#2563eb" />}/>
            <FeatureCard title="Secure Authentication" desc="Enterprise-grade login and logout functionality with secure session management." icon={<Lock size={20} color="#2563eb" />}/>
            <FeatureCard title="Role-Based Access" desc="Manager roles and team-specific access controls for organized workflow management." icon={<Users size={20} color="#2563eb" />}/>
          </div>
        </section>

        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <h3 style={{ fontSize: 28, fontWeight: 700 }}>How It Works</h3>
          <p style={{ color: '#64748b', maxWidth: 760, margin: '8px auto 24px' }}>Simple 3-step process to generate professional proposals</p>

          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Step number={1} title="Upload or Input" desc="Upload your RFP document or paste a problem statement" />
            <Step number={2} title="AI Processing" desc="Our AI analyzes and generates a structured proposal" />
            <Step number={3} title="Download & Deliver" desc="Review, edit, and download your professional proposal" />
          </div>
        </section>
      </main>

      <footer style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>© 2024 AIONOS. All rights reserved.</footer>
    </div>
  );
}

function FeatureCard({ title, desc, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 6px 18px rgba(15,23,42,0.03)', minHeight: 120 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        {icon}
      </div>
      <h4 style={{ margin: '6px 0', fontWeight: 700 }}>{title}</h4>
      <p style={{ color: '#64748b', fontSize: 14 }}>{desc}</p>
    </div>
  );
}

function Step({ number, title, desc }) {
  return (
    <div style={{ width: 220, padding: 18, textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 999, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontWeight: 700, color: '#2563eb' }}>{number}</div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: '#64748b', marginTop: 8 }}>{desc}</div>
    </div>
  );
}

export default Home;