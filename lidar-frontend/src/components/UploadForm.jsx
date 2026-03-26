import { useState, useRef } from 'react';
import { processFile } from '../api/lidarApi';

export default function UploadForm({ onResult, setLoading, setError, isLoading }) {
  const [file, setFile] = useState(null);
  const [resolution, setResolution] = useState(1.0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        if (fileInputRef.current) fileInputRef.current.files = e.dataTransfer.files;
      } else {
        alert("Only .csv files are supported.");
      }
    }
  };

  const handleSelectClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      alert("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError(null);
    onResult(null); // Clear previous results while loading

    try {
      const data = await processFile(file, resolution);
      onResult(data);
    } catch (err) {
      const msg = err.response?.data || err.message || "An unknown error occurred";
      setError(`Failed to process file: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* File Drop / Selection Area */}
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${file ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleSelectClick}
      >
        <input 
          type="file" 
          accept=".csv" 
          ref={fileInputRef}
          onChange={handleFileChange} 
          className="hidden" 
        />
        
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={`p-3 rounded-full ${file ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          
          {file ? (
            <div>
              <p className="text-sm font-medium text-slate-800">Selected file:</p>
              <p className="text-base font-semibold text-indigo-600 truncate max-w-xs mx-auto">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">Click or drag a different file to replace</p>
            </div>
          ) : (
            <div>
              <p className="text-base font-medium text-slate-700">Click to select or drag and drop</p>
              <p className="text-sm text-slate-500 mt-1">.csv point cloud data only</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls Area */}
      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <label htmlFor="resolution" className="text-sm font-medium text-slate-700 whitespace-nowrap">
            Grid Resolution (m)
          </label>
          <select 
            id="resolution"
            value={resolution}
            onChange={(e) => setResolution(parseFloat(e.target.value))}
            className="block w-full sm:w-32 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
            disabled={isLoading}
          >
            <option value={0.5}>0.5</option>
            <option value={1.0}>1.0</option>
            <option value={2.0}>2.0</option>
            <option value={5.0}>5.0</option>
          </select>
        </div>

        <button 
          type="button" onClick={handleSubmit} 
          disabled={!file || isLoading}
          className={`w-full sm:w-auto flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md text-white shadow-sm transition-colors
            ${(!file || isLoading) 
              ? 'bg-slate-400 cursor-not-allowed hidden-hover' 
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : 'Process File'}
        </button>
        
      </div>
    </form>
  );
}

