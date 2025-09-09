import React, { useRef, useState, useCallback } from 'react';
import { Upload, CheckCircle } from 'lucide-react';

const ALLOWED_TYPES = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export default function FileUploader({ onFileSelected, maxSizeMB = 10, initialFile = null, initialStatus = 'idle', error: externalError = null, onError }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(initialFile);
  const [status, setStatus] = useState(initialStatus);

  const validateAndSet = useCallback((f) => {
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      onError?.('Please upload a PDF or DOCX file');
      return;
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      onError?.(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }
    setFile(f);
    setStatus('success');
    onError?.(null);
    onFileSelected?.(f);
  }, [maxSizeMB, onError, onFileSelected]);

  const onInputChange = (e) => {
    validateAndSet(e.target.files?.[0]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    validateAndSet(f);
  };

  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="mb-6">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          status === 'success' ? 'border-green-300 bg-green-50' : dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onClick={openPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={onInputChange}
          className="hidden"
        />
        {status === 'success' && file ? (
          <div className="flex flex-col items-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm font-medium text-green-700">{file.name}</p>
            <p className="text-xs text-green-600 mt-1">{(file.size/1024/1024).toFixed(2)} MB • Ready for processing</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700">Drag & drop or click to upload</p>
            <p className="text-xs text-gray-500 mt-1">PDF or DOCX up to {maxSizeMB}MB</p>
          </div>
        )}
      </div>
      {externalError && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{externalError}</div>
      )}
    </div>
  );
} 