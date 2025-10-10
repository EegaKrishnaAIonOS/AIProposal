import React, {useState, useEffect,useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import { AlertCircle, Settings, History, Upload } from 'lucide-react';
import FileUploader from './components/FileUploader.jsx';
import ActionButtons from './components/ActionButtons.jsx';
import PreviewCard from './components/PreviewCard.jsx';
import GeneratedSolutions from './components/GeneratedSolutions.jsx';
import UploadSolutionModal from './components/UploadSolutionModal.jsx';
import {BrowserRouter as Router, Route, Routes, Navigate, Outlet} from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Contact from './pages/Contact';
import ChatBox from './components/ChatBox.jsx';

// This new component handles the authentication check
const ProtectedRoute = ({ authed, redirectPath = '/login' }) => {
  if (!authed) {
    return <Navigate to={redirectPath} replace />;
  }
  return <Outlet />;
};

const RFPSolutionGenerator = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [solution, setSolution] = useState(null);
  const [error, setError] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showSolutions, setShowSolutions] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showLogoutModal,setShowLogoutModal]=useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [generationMethod, setGenerationMethod] = useState('knowledgeBase'); // 'knowledgeBase' or 'llmOnly'
  const navigate = useNavigate();
  const previewRef = useRef(null);

  const onFileSelected = (f) => {
    setFile(f);
    setError(null);
    setDownloaded(false);
  };

  const generateSolution = async () => {
    if (!file && !inputText.trim()){
      setError('Please upload a document or enter a problem statement');
      return;
    }
    setIsProcessing(true);
    setError(null);
    setDownloaded(false);
    try {
      let data;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('method', generationMethod); // Pass the selected generation method to the backend
        const response = await fetch('/api/generate-solution', { method: 'POST', body: formData });
        if (!response.ok) {
          let msg = 'Failed to generate solution';
          try { const j = await response.json(); if (j?.detail) msg = j.detail; } catch {}
          throw new Error(msg);
        }
        data = await response.json();
      } else {
        const response = await fetch('/api/generate-solution-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText.trim(),method: generationMethod})
        });
        if (!response.ok) {
          let msg = 'Failed to generate solution';
          try { const j = await response.json(); if (j?.detail) msg = j.detail; } catch {}
          throw new Error(msg);
        }
        data = await response.json();
      }
      // Adjust for new shape: { solution, recommendations }
      const generated = data?.solution ? data.solution : data;
      const recs = Array.isArray(data?.recommendations) ? data.recommendations : [];
      setSolution(generated);
      // Trigger product recommendations using problem statement
      try {
        // If backend already sent recommendations, use them; otherwise fall back to calling endpoint
        if (recs.length > 0) {
          setRecommendations(recs);
        } else {
          const textToCheck = (generated?.problem_statement) || inputText;
          if (textToCheck && textToCheck.trim()) {
            const recRes = await fetch('/api/recommendations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: textToCheck.trim() })
            });
            if (recRes.ok) {
              const recs2 = await recRes.json();
              setRecommendations(Array.isArray(recs2) ? recs2 : []);
            } else {
              setRecommendations([]);
            }
          } else {
            setRecommendations([]);
          }
        }
      } catch (e) {
        setRecommendations([]);
      }
      setIsEditing(false);

      // Save generated solution to database
     try {
        const email = (() => { try { return sessionStorage.getItem('aionos_user_email') || ''; } catch (e) { return ''; } })();
        await fetch('/api/solutions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': email
          },
          body: JSON.stringify(generated),
        });
      } catch (saveError) {
        console.error('Failed to save solution:', saveError);
      }
 
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const downloadSolution = async () => {
    if (!solution) return;

    try {
      const email = (() => { try { return sessionStorage.getItem('aionos_user_email') || ''; } catch (e) { return ''; } })();
      const response = await fetch('/api/download-solution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': email
        },
        body: JSON.stringify(solution),
      });
      
      if (!response.ok) {
        let msg = 'Failed to download solution';
        try { const j = await response.json(); if (j?.detail) msg = j.detail; } catch {}
        throw new Error(msg);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'technical_proposal.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFile(null);
    setSolution(null);
    setError(null);
    setDownloaded(false);
    setIsEditing(false);
    setInputText('');
  };

  const scrollToUpload = () => {
    const el = document.getElementById('upload-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- NEW REFS & SCROLL LOGIC ---
  // Create a ref object for each potential section ID
  const sectionRefs = useRef({}); 
  
  // Dynamic list of section names to create refs for
  const sectionNames = [
    'title', 'problem-statement', 'objectives', 'acceptance-criteria', 
    'project-plan', 'resources', 'cost-analysis', 'architecture-diagram', 
    'key-performance-indicators', 'disclaimer'
  ];

  // Initialize refs dynamically
  useEffect(() => {
    sectionNames.forEach(name => {
      sectionRefs.current[name] = sectionRefs.current[name] || React.createRef();
    });
  }, [solution]); // Re-run if solution changes to ensure all refs are fresh

  const handleScrollToSection = (sectionId) => {
    const ref = sectionRefs.current[sectionId];
    if (ref && ref.current) {
      // Scroll smoothly to the element referenced by the key
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Highlight effect
      ref.current.classList.add('bg-yellow-100');
      setTimeout(() => {
        ref.current.classList.remove('bg-yellow-100');
      }, 2000);
    } else {
      console.warn(`Section ref not found for ID: ${sectionId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">RFP Solution Generator</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowSolutions(true)}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md text-sm font-medium text-gray-700"
                >
                  <History className="h-4 w-4" />
                  Generated Solutions
                </button>
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md text-sm font-medium text-gray-700"
                >
                  <Upload className="h-4 w-4" />
                  Upload Solution
                </button>
                <button
                  onClick={() => {}} // Static, no functionality
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md text-sm font-medium text-gray-700"
                >
                  Aionos Salary Information
                </button>
              </div>
              <button onClick={() => setShowLogoutModal(true)} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-md text-sm font-medium text-white">Logout </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero / Home section */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Generate Professional Proposals from RFPs</h2>
              <p className="text-gray-600 mb-6">Upload your PDF or DOCX RFP and instantly get a structured, client-ready technical proposal powered by AI.</p>
              <button onClick={scrollToUpload} className="bg-blue-600 text-white py-2 px-5 rounded-md hover:bg-blue-700">
                Upload RFP and Generate Proposal
              </button>
            </div>
            <div className="hidden md:block">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                {solution ? (
                  <div>
                    <div className="flex flex-col items-center text-center mb-4">
                      <img src="/api/logo" alt="Company Logo" className="h-10 w-auto mb-2" />
                      <h3 className="text-lg font-semibold text-gray-900">{solution.title}</h3>
                      <p className="text-xs text-gray-600">{solution.date}</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-gray-700 line-clamp-3">{solution.problem_statement}</p>
                      </div>
                      {solution.key_challenges?.length > 0 && (
                        <ul className="list-disc pl-5 text-gray-700">
                          {solution.key_challenges.slice(0,3).map((c,i) => <li key={i}>{c}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-40 bg-gray-50 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400">Proposal Preview</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Upload & Controls */}
          <div className="lg:col-span-1" id="upload-section">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Provide Input</h2>
              {/* Generation Method Selection */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Select Generation Method</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="llmOnly"
                      checked={generationMethod === "llmOnly"}
                      onChange={() => setGenerationMethod("llmOnly")}
                      className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                    />
                    <label htmlFor="llmOnly" className="ml-2 text-sm text-gray-700">
                      Generate directly from LLM
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="knowledgeBase"
                      checked={generationMethod === "knowledgeBase"}
                      onChange={() => setGenerationMethod("knowledgeBase")}
                      className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                    />
                    <label htmlFor="knowledgeBase" className="ml-2 text-sm text-gray-700">
                      Generate using Knowledge Base (RAG)
                    </label>
                  </div>
                </div>
              </div>
              {/* Textarea alternative */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Problem Statement / Use Case</label>
                <textarea
                  className="w-full border rounded-md p-3 text-sm focus:outline-none focus:ring"
                  rows={5}
                  placeholder="Describe the problem, goals, constraints, and any context..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">Either upload a document below or enter text here.</p>
              </div>

              {/* OR divider */}
              <div className="my-4 flex items-center">
                <div className="flex-1 h-px bg-gray-200"/>
                <span className="px-3 text-xs text-gray-500">OR</span>
                <div className="flex-1 h-px bg-gray-200"/>
              </div>

              <FileUploader onFileSelected={onFileSelected} error={error} onError={setError} />

              {isProcessing && (
                <div className="mb-4">
                  <div className="h-2 w-full bg-blue-100 rounded overflow-hidden">
                    <div className="h-2 w-full bg-blue-600 animate-pulse"></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Processing... this may take a few seconds.</p>
                </div>
              )}

              <ActionButtons
                canGenerate={Boolean(file) || Boolean(inputText.trim())}
                isProcessing={isProcessing}
                hasSolution={Boolean(solution)}
                onGenerate={generateSolution}
                onDownload={downloadSolution}
                onReset={resetForm}
              />
              <p className="mt-1 text-xs text-gray-500">Once you download the generated document file,open the file and click on references and click on update table button to update page numbers</p>

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            {/* Process Steps
            <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Process Steps</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                    file ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>1</div>
                  <span className={file ? 'text-green-600' : 'text-gray-500'}>Upload RFP Document</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                    solution ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>2</div>
                  <span className={solution ? 'text-green-600' : 'text-gray-500'}>AI Analysis & Solution Generation</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                    downloaded ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>3</div>
                  <span className={downloaded ? 'text-green-600' : 'text-gray-500'}>Download & Customize</span>
                </div>
              </div>
            </div> */}
          </div>

          {/* Right Panel - Solution Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Generated Solution Preview</h2>
                {solution && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-sm bg-gray-800 text-white px-3 py-1 rounded-md hover:bg-gray-900"
                  >
                    {isEditing ? 'Save' : 'Edit'}
                  </button>
                )}
              </div>
              <div className="p-6">
                <PreviewCard ref={previewRef} solution={solution} editable={isEditing} onChange={setSolution} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Generated Solutions Modal */}
      {showSolutions && (
        <GeneratedSolutions onClose={() => setShowSolutions(false)} />
      )}
      {/* Recommendation Pop-up */}
      {Array.isArray(recommendations) && recommendations.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white shadow-lg border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Recommended AionOS Solution{recommendations.length>1?'s':''}</h4>
              <p className="text-xs text-gray-500 mt-1">Based on the problem statement</p>
            </div>
            <button onClick={() => setRecommendations([])} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
          <div className="mt-3 space-y-3 max-h-64 overflow-y-auto pr-1">
            {recommendations.map((r, idx) => (
              <div key={idx} className="border border-gray-100 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{r.name}</span>
                  {typeof r.score === 'number' && <span className="text-[10px] text-gray-500">Match {Math.round(r.score*100)}%</span>}
                </div>
                <p className="text-xs text-gray-600 mt-1">{r.description}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-blue-600 hover:underline">Learn more</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {showUpload && (
        <UploadSolutionModal onClose={() => setShowUpload(false)} />
      )}
      {/* Logout Modal */}
      {showLogoutModal && (
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
            <h2 style={{ fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '1rem' }}>Confirm Logout</h2>
            <p style={{ marginBottom: '1.5rem', color: '#444' }}>Are you sure you want to logout?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={() => {
                  // Clear session and notify App to clear auth
                  try { sessionStorage.removeItem('aionos_auth'); } catch (err) {}
                  try { window.dispatchEvent(new Event('aionos:logout')); } catch (err) {}
                  setShowLogoutModal(false);
                  navigate('/');
                }}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.5rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Yes, Logout
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ background: '#eee', color: '#333', border: 'none', borderRadius: '6px', padding: '0.5rem 1.5rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <ChatBox 
          solution={solution} 
          onScrollToSection={(sectionId) => previewRef.current?.scrollToSection(sectionId)} 
      />
    </div>
  );  
}

function App() {
  const [authed, setAuthed] = React.useState(false);

  useEffect(() => {
    // Check for a specific reload event to handle /rfp refresh logic
    const isReload = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]?.type === 'reload') || (performance && performance.navigation?.type === 1);
    const isRFP = window.location.pathname === '/rfp';
    
    // If the page is reloaded and it's the RFP page, treat it as a logout
    if (isReload && isRFP) {
      try { sessionStorage.removeItem('aionos_auth'); } catch (err) {}
      setAuthed(false);
    } else {
      // Otherwise, attempt to restore auth from session storage
      try {
        if (sessionStorage.getItem('aionos_auth') === '1') {
          setAuthed(true);
        }
      } catch (err) {}
    }

    const handler = () => setAuthed(false);
    window.addEventListener('aionos:logout', handler);
    return () => window.removeEventListener('aionos:logout', handler);
  }, []);
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onAuth={() => setAuthed(true)} />} />
        <Route path="/home" element={<Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/logout" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Home />} />
        <Route element={<ProtectedRoute authed={authed} />}>
          <Route path="/rfp" element={<RFPSolutionGenerator />} />
        </Route>
      </Routes>
    </Router>
  );
}
 
export default App;
 