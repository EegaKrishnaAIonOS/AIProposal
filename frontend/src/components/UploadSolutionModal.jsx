import React, { useEffect, useState } from 'react';
import FileUploader from './FileUploader.jsx';
import { X, Download } from 'lucide-react';

export default function UploadSolutionModal({ onClose }) {
	const [uploadedFiles, setUploadedFiles] = useState([]);
	const [selectedFile, setSelectedFile] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);

	const USER_ID = (() => { try { return sessionStorage.getItem('aionos_user_email') || 'anonymous'; } catch (e) { return 'anonymous'; } })()

	useEffect(() => {
		fetchList();
	}, []);

	const fetchList = async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/uploaded-solutions', { headers: { 'X-User-Id': USER_ID } });
			if (!res.ok) throw new Error('Failed to fetch uploaded solutions');
			const data = await res.json();
			setUploadedFiles(data);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const onFileSelected = (f) => {
		setSelectedFile(f);
		setError(null);
	};

	const upload = async () => {
		if (!selectedFile) {
			setError('Please select a file to upload');
			return;
		}
		const fd = new FormData();
		fd.append('file', selectedFile);
		try {
			const res = await fetch('/api/upload-solution', { method: 'POST', body: fd, headers: { 'X-User-Id': USER_ID } });
			if (!res.ok) {
				const j = await res.json().catch(()=>null);
				throw new Error(j?.detail || 'Upload failed');
			}
			// refresh list
			await fetchList();
			setSelectedFile(null);
		} catch (err) {
			setError(err.message);
		}
	};

	const download = async (id, filename) => {
		try {
			const res = await fetch(`/api/uploaded-solutions/${id}/download`, { headers: { 'X-User-Id': USER_ID } });
			if (!res.ok) throw new Error('Download failed');
			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
		} catch (err) {
			setError(err.message);
		}
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg w-full max-w-2xl p-6 relative max-h-[80vh] overflow-y-auto">
				<button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"><X className="h-6 w-6"/></button>
				<h2 className="text-2xl font-bold mb-4">Upload Solution</h2>

				<p className="text-sm text-gray-600 mb-4">Drag & drop files here to upload. Previously uploaded solutions (suggestions) appear below.</p>

				<FileUploader onFileSelected={onFileSelected} onError={setError} />

				<div className="flex gap-2">
					<button onClick={upload} className="bg-blue-600 text-white px-4 py-2 rounded-md">Upload</button>
					<button onClick={onClose} className="bg-gray-100 px-4 py-2 rounded-md">Close</button>
				</div>

				{error && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>}

				<hr className="my-4" />

				<h3 className="text-lg font-semibold mb-3">Previously uploaded solutions</h3>
				{loading ? (
					<div className="text-sm text-gray-500">Loading...</div>
				) : uploadedFiles.length === 0 ? (
					<div className="text-sm text-gray-500">No previous uploads</div>
				) : (
					<div className="space-y-2">
						{uploadedFiles.map(f => (
							<div key={f.id} className="flex items-center justify-between border border-gray-200 rounded p-2">
								<div>
									<div className="font-medium text-gray-800">{f.filename}</div>
									<div className="text-xs text-gray-500">{new Date(f.upload_date).toLocaleString()}</div>
								</div>
								<button onClick={() => download(f.id, f.filename)} className="bg-gray-100 px-3 py-1 rounded-md flex items-center">
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
