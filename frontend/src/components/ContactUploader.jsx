import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Link } from 'lucide-react';
import { importContacts, importContactsFromGSheet } from '../lib/api';

export default function ContactUploader({ onSuccess }) {
  const [activeTab, setActiveTab] = useState('csv'); // 'csv' | 'gsheet'
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = useCallback((selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setResult(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    handleFile(droppedFile);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      let res;
      if (activeTab === 'csv') {
        if (!file) return;
        res = await importContacts(file);
      } else {
        if (!gsheetUrl.trim()) {
          setError('Please enter a Google Sheets URL');
          setUploading(false);
          return;
        }
        res = await importContactsFromGSheet(gsheetUrl);
      }
      setResult(res.data || res);
      setFile(null);
      setGsheetUrl('');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setGsheetUrl('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-4" id="contact-uploader">
      {/* Tabs */}
      <div className="flex border-b border-navy-100">
        <button
          onClick={() => { setActiveTab('csv'); reset(); }}
          className={`flex-1 pb-2 text-sm font-semibold text-center border-b-2 transition-all duration-200
            ${activeTab === 'csv'
              ? 'border-gold-500 text-gold-600'
              : 'border-transparent text-navy-400 hover:text-navy-600'
            }`}
        >
          CSV File Upload
        </button>
        <button
          onClick={() => { setActiveTab('gsheet'); reset(); }}
          className={`flex-1 pb-2 text-sm font-semibold text-center border-b-2 transition-all duration-200
            ${activeTab === 'gsheet'
              ? 'border-gold-500 text-gold-600'
              : 'border-transparent text-navy-400 hover:text-navy-600'
            }`}
        >
          Google Sheets Link
        </button>
      </div>

      {activeTab === 'csv' ? (
        /* Drop zone */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer
            ${isDragging
              ? 'border-gold-500 bg-gold-50/50 scale-[1.01]'
              : 'border-navy-200 hover:border-navy-300 hover:bg-navy-50/50'
            }`}
          onClick={() => !file && document.getElementById('csv-input')?.click()}
        >
          <input
            id="csv-input"
            type="file"
            accept=".csv"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet size={24} className="text-success" />
              <div className="text-left">
                <p className="text-sm font-medium text-navy-900">{file.name}</p>
                <p className="text-xs text-navy-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); reset(); }} className="btn-icon">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={28} className={`mx-auto mb-2 ${isDragging ? 'text-gold-500' : 'text-navy-300'}`} />
              <p className="text-sm font-medium text-navy-600">
                Drop CSV here or <span className="text-gold-600 font-semibold">browse</span>
              </p>
              <p className="text-xs text-navy-400 mt-1">
                Required columns: <code className="bg-navy-50 px-1 py-0.5 rounded text-[10px]">phone</code>
                {' '}Optional: <code className="bg-navy-50 px-1 py-0.5 rounded text-[10px]">name</code>,{' '}
                <code className="bg-navy-50 px-1 py-0.5 rounded text-[10px]">group_name</code>
              </p>
            </>
          )}
        </div>
      ) : (
        /* Google Sheet input */
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-navy-400 pointer-events-none">
              <Link size={16} />
            </span>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
              value={gsheetUrl}
              onChange={(e) => { setGsheetUrl(e.target.value); setError(null); }}
              className="input-primary pl-9 w-full"
            />
          </div>
          <div className="p-3 bg-navy-50 rounded-xl space-y-1">
            <h4 className="text-xs font-semibold text-navy-900">How to import:</h4>
            <p className="text-[11px] text-navy-500 leading-relaxed">
              1. Format your Google Sheet with a <code className="bg-white px-1 rounded">phone</code> header (and optional <code className="bg-white px-1 rounded">name</code> and <code className="bg-white px-1 rounded">group_name</code>).<br />
              2. Click <strong>Share</strong> (top right in Sheets) → change Link Sharing to <strong>&ldquo;Anyone with the link can view&rdquo;</strong> (Public).<br />
              3. Copy the URL from your browser address bar and paste it above.
            </p>
          </div>
        </div>
      )}

      {/* Upload button */}
      {((activeTab === 'csv' && file) || (activeTab === 'gsheet' && gsheetUrl)) && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload size={16} />
              {activeTab === 'csv' ? 'Import Contacts' : 'Sync Google Sheet'}
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger-light rounded-xl animate-fade-in">
          <AlertCircle size={16} className="text-danger flex-shrink-0" />
          <p className="text-sm text-danger-dark">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="p-3 bg-success-light rounded-xl animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-success" />
            <p className="text-sm font-medium text-success-dark">Import Complete</p>
          </div>
          <div className="flex gap-4 text-xs text-navy-600">
            <span><strong>{result.imported}</strong> created</span>
            <span><strong>{result.updated}</strong> updated</span>
            {result.total_errors > 0 && (
              <span className="text-danger"><strong>{result.total_errors}</strong> errors</span>
            )}
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto border-t border-success-light pt-2">
              {result.errors.map((err, i) => (
                <p key={i} className="text-[11px] text-danger">
                  Row {err.row}: {err.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
