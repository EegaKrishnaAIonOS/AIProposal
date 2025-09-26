import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function GeneratedSolutions({ onClose }) {
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSolutions();
  }, []);

   const fetchSolutions = async () => {
    try {
      const email = (() => { try { return sessionStorage.getItem('aionos_user_email') || ''; } catch (e) { return ''; } })();
      const response = await fetch('/api/solutions', { headers: { 'X-User-Email': email }});
      if (!response.ok) {
        throw new Error('Failed to fetch solutions');
      }
      const data = await response.json();
      setSolutions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

   const downloadSolution = async (id, title) => {
    try {
      const email = (() => { try { return sessionStorage.getItem('aionos_user_email') || ''; } catch (e) { return ''; } })();
      const response = await fetch(`/api/solutions/${id}`, { headers: { 'X-User-Email': email }});
      if (!response.ok) {
        throw new Error('Failed to download solution');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${title}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl p-6 relative max-h-[80vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="h-6 w-6" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Generated Solutions</h2>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading solutions...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            {error}
          </div>
        ) : solutions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No solutions generated yet
          </div>
        ) : (
          <div className="space-y-4">
            {solutions.map((solution) => (
              <div
                key={solution.id}
                className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{solution.title}</h3>
                  <p className="text-sm text-gray-500">
                    Generated on: {new Date(solution.generated_date).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => downloadSolution(solution.id, solution.title)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
