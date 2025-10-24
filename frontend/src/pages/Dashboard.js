import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, LogOut } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const userEmail = (() => { try { return sessionStorage.getItem('aionos_user_email') || 'User'; } catch (e) { return 'User'; } })();

  const logout = () => {
    try { sessionStorage.removeItem('aionos_auth'); } catch (e) {}
    try { sessionStorage.removeItem('aionos_user_email'); } catch (e) {}
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <header className="flex items-center justify-between max-w-5xl mx-auto px-6 py-6">
        <div>
          <p className="text-sm text-gray-500">Welcome</p>
          <h1 className="text-2xl font-bold text-gray-900">{userEmail}</h1>
        </div>
        <button onClick={logout} className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
          <LogOut size={18} /> Logout
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={() => navigate('/rfp')} className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-blue-100 text-blue-600"><FileText size={24} /></div>
              <h2 className="text-xl font-semibold text-gray-900">AI Proposal Generator</h2>
            </div>
            <p className="text-gray-600">Create structured proposals from RFPs or problem statements.</p>
          </button>

          <button onClick={() => navigate('/tenders')} className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-purple-100 text-purple-600"><Search size={24} /></div>
              <h2 className="text-xl font-semibold text-gray-900">Check Active Tenders & Challenges</h2>
            </div>
            <p className="text-gray-600">Browse TTLH-focused tenders from GEM, IDEX, and Tata Innoverse.</p>
          </button>
        </div>
      </main>
    </div>
  );
}


