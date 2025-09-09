import React from 'react';
import { FileText, Loader2, Download, RotateCcw } from 'lucide-react';

export default function ActionButtons({
  canGenerate,
  isProcessing,
  hasSolution,
  onGenerate,
  onDownload,
  onReset,
}) {
  return (
    <div className="space-y-3">
      <button
        onClick={onGenerate}
        disabled={!canGenerate || isProcessing}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isProcessing ? (
          <>
            <Loader2 className="animate-spin h-4 w-4 mr-2" />
            Generating Solution...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            Generate Solution
          </>
        )}
      </button>

      <button
        onClick={onDownload}
        disabled={!hasSolution}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
      >
        <Download className="h-4 w-4 mr-2" />
        Download Proposal
      </button>

      <button
        onClick={onReset}
        className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 flex items-center justify-center"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Start New Analysis
      </button>
    </div>
  );
} 