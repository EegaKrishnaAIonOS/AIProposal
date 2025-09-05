import React, {useState, useRef} from 'react';
import {Upload, FileText, Download, Loader2, CheckCircle, AlertCircle, Settings} from 'lucide-react';

const RFPSolutionGenerator = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [solution, setSolution] = useState(null);
  const [error, setError] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile) {
      const allowedTypes = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'];
      if (!allowedTypes.includes(uploadedFile.type)) {
        setError('Please upload a PDF, DOCX, or DOC file');
        return;
      }

      if(uploadedFile.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit");
        return;
      }

      setFile(uploadedFile);
      setError(null);
      setUploadStatus('success');
    }
  };

  const generateSolution = async () => {
    if (!file){
      setError('Please upload the RFP document first');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/generate-solution', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate solution');
      }

      const data = await response.json();
      setSolution(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const downloadSolution = async () => {
    if (!solution) return;

    try {
      const response = await fetch('/api/download-solution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(solution),
      });

      if (!response.ok) {
        throw new Error('Failed to download solution');
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
    } catch (err) {
      setError('Failed to download solution document');
    }
  };

  const resetForm = () => {
    setFile(null);
    setSolution(null);
    setError(null);
    setUploadStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
            <div className="text-sm text-gray-500">
              Professional Proposal Automation
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Upload & Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Upload</h2>
              
              {/* File Upload Area */}
              <div className="mb-6">
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    uploadStatus === 'success' 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  {uploadStatus === 'success' ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                      <p className="text-sm font-medium text-green-700">{file?.name}</p>
                      <p className="text-xs text-green-600 mt-1">Ready for processing</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center cursor-pointer">
                      <Upload className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-700">Upload RFP Document</p>
                      <p className="text-xs text-gray-500 mt-1">PDF or Word documents up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={generateSolution}
                  disabled={!file || isProcessing}
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

                {solution && (
                  <button
                    onClick={downloadSolution}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Proposal
                  </button>
                )}

                {(file || solution) && (
                  <button
                    onClick={resetForm}
                    className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
                  >
                    Start New Analysis
                  </button>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            {/* Process Steps */}
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
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-medium mr-3">3</div>
                  <span className="text-gray-500">Download & Customize</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Solution Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Generated Solution Preview</h2>
              </div>
              
              <div className="p-6">
                {!solution ? (
                  <div className="text-center py-12">
                    <FileText className="h-24 w-24 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Solution Generated Yet</h3>
                    <p className="text-gray-500">Upload an RFP document and click "Generate Solution" to see the preview here.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Cover Page */}
                    <div className="border border-dashed border-gray-300 rounded-lg p-6">
                      <div className="flex flex-col items-center text-center">
                        <img src="/api/logo" alt="Company Logo" className="h-20 w-auto mb-4" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">{solution.title}</h1>
                        <p className="text-gray-600">{solution.date}</p>
                      </div>
                    </div>

                    {/* Visual Page Break */}
                    <div className="border-t border-gray-200 my-4"></div>

                    {/* Problem Statement */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-3">Problem Statement</h2>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-gray-700">{solution.problem_statement}</p>
                      </div>
                    </div>

                    {/* Key Challenges */}
                    {solution.key_challenges && (
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">Key Challenges</h2>
                        <div className="space-y-2">
                          {solution.key_challenges.map((challenge, index) => (
                            <div key={index} className="flex items-start">
                              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                              <p className="text-gray-700">{challenge}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Solution Approach */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-3">Our Solution Approach</h2>
                      <div className="space-y-4">
                        {solution.solution_approach && solution.solution_approach.map((step, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                            <p className="text-gray-700">{step.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Milestones */}
                    {solution.milestones && (
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">Key Milestones</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {solution.milestones.map((milestone, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-gray-900">{milestone.phase}</h4>
                              <p className="text-sm text-gray-600">{milestone.duration}</p>
                              <p className="text-sm text-gray-700 mt-1">{milestone.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Technical Stack */}
                    {solution.technical_stack && (
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">Technical Stack</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {solution.technical_stack.map((tech, index) => (
                            <div key={index} className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-center text-sm font-medium">
                              {tech}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default RFPSolutionGenerator;