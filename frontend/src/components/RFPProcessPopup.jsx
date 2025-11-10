import React, { useEffect, useState } from 'react';

export default function RFPProcessPopup({
  steps = [],
  onClose,
  bottomOffset = 24,
  offsetLeft = 24,
  topOffset = null,
}) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Start fade-in sequence without relayout jumping
    const t = setTimeout(() => setStarted(true), 60);
    return () => clearTimeout(t);
  }, [steps]);

  if (!steps || steps.length === 0) return null;

  const positioningStyle =
    topOffset != null
      ? { top: topOffset, left: offsetLeft, transform: 'translateZ(0)' }
      : { bottom: bottomOffset, left: offsetLeft, transform: 'translateZ(0)' };

  return (
    <div className="fixed z-50" style={positioningStyle}>
      <div className="w-80 bg-white shadow-lg border border-gray-200 rounded-lg p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">How your RFP was created</h4>
            <p className="text-xs text-gray-500 mt-1">AIonOS Knowledge Base process</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
        <div className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex items-center text-sm transition-opacity duration-500"
              style={{ opacity: started ? 1 : 0, transitionDelay: `${i * 120}ms` }}
            >
              <div className="w-5 h-5 mr-2 rounded-full flex items-center justify-center text-[10px] font-medium bg-green-100 text-green-600">{i + 1}</div>
              <span className="text-gray-800">{s}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={onClose} className="text-xs bg-gray-800 text-white px-3 py-1 rounded-md">Close</button>
        </div>
      </div>
    </div>
  );
}
