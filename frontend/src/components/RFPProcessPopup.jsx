import React, { useEffect, useState } from 'react';

export default function RFPProcessPopup({ steps = [], onClose, bottomOffset = 24 }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!steps || steps.length === 0) return;
    setVisibleCount(0);
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      setVisibleCount((c) => {
        const next = Math.min(steps.length, c + 1);
        if (next === steps.length) {
          clearInterval(interval);
        }
        return next;
      });
      if (idx >= steps.length) {
        clearInterval(interval);
      }
    }, 700);
    return () => clearInterval(interval);
  }, [steps]);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="fixed right-6 z-50" style={{ bottom: bottomOffset }}>
      <div className="w-80 bg-white shadow-lg border border-gray-200 rounded-lg p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">How your RFP was created</h4>
            <p className="text-xs text-gray-500 mt-1">AIonOS Knowledge Base process</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
        <div className="mt-3 space-y-2">
          {steps.slice(0, visibleCount).map((s, i) => (
            <div key={i} className="flex items-center text-sm">
              <div className="w-5 h-5 mr-2 rounded-full flex items-center justify-center text-[10px] font-medium bg-green-100 text-green-600">{i + 1}</div>
              <span className="text-gray-800">{s}</span>
            </div>
          ))}
          {visibleCount < steps.length && (
            <div className="flex items-center text-xs text-gray-500">
              <div className="w-4 h-4 mr-2 rounded-full border-2 border-dashed border-gray-300 animate-spin" style={{ borderTopColor: 'transparent' }} />
              Adding steps...
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={onClose} className="text-xs bg-gray-800 text-white px-3 py-1 rounded-md">Close</button>
        </div>
      </div>
    </div>
  );
}


