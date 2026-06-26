import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, X, FileType, FileWarning, CheckCircle2, Loader2, File } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFile = (file: File) => {
    setError(null);
    const validExtensions = ['.pdf', '.dxf', '.dwg', '.step', '.stp', '.iges', '.igs', '.sldprt'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      setError(`Invalid file format: ${ext}. Please upload standard engineering drawing formats (PDF, DXF, DWG, STEP, IGES, SLDPRT).`);
      return false;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB
      setError(`File size exceeds 50MB limit.`);
      return false;
    }
    
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('http://localhost:8000/api/process-drawing', {
        method: 'POST',
        body: formData,
        // Add Authorization header if needed by uncommenting below
        // headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Upload failed with status ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Process Result:', result);
      
      setIsUploading(false);
      onUpload(selectedFile); // Or pass 'result' if Drawings.tsx needs it
      setSelectedFile(null);
      onClose();
    } catch (err: any) {
      console.error('Upload Error:', err);
      setError(err.message || 'An error occurred during processing.');
      setIsUploading(false);
    }
  };

  const getFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal Container to handle centering without conflicting with Framer Motion transforms */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              className="w-full max-w-lg bg-brand-elevated border border-white/10 rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white tracking-tight">Upload Engineering Drawing</h3>
                <button 
                  onClick={onClose}
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {!selectedFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      relative group flex flex-col items-center justify-center py-12 px-6 rounded-lg border-2 border-dashed
                      cursor-pointer transition-all duration-200 ease-out text-center
                      ${isDragging 
                        ? 'border-brand-indigo bg-brand-indigo/5' 
                        : 'border-white/10 bg-brand-surface hover:border-brand-indigo/50 hover:bg-white/[0.02]'
                      }
                    `}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      className="hidden"
                      accept=".pdf,.dxf,.dwg,.step,.stp,.iges,.igs,.sldprt"
                      onChange={handleFileSelect}
                    />
                    
                    <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-brand-indigo/20 text-brand-indigo' : 'bg-white/5 text-gray-400 group-hover:text-brand-indigo group-hover:bg-brand-indigo/10'}`}>
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    
                    <h4 className="text-base font-medium text-white mb-1">
                      {isDragging ? 'Drop file to upload' : 'Click or drag file to this area to upload'}
                    </h4>
                    <p className="text-sm text-gray-400 mb-4 max-w-[280px]">
                      Supported formats: PDF, DXF, DWG, STEP, IGES, SLDPRT. Maximum size: 50MB.
                    </p>
                    
                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-md text-sm font-medium text-white transition-colors">
                      Select File
                    </button>
                  </div>
                ) : (
                  <div className="bg-brand-surface border border-white/10 rounded-lg p-5">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-brand-indigo/10 rounded-lg shrink-0">
                        <FileType className="w-6 h-6 text-brand-indigo" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white truncate">{selectedFile.name}</h4>
                        <p className="text-xs text-gray-400 mt-1">{getFileSize(selectedFile.size)}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedFile(null)}
                        className="p-1.5 text-gray-400 hover:text-brand-danger rounded transition-colors"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Progress bar mock */}
                    {isUploading && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-gray-400 font-medium">
                          <span>Uploading & Processing...</span>
                          <span>{isUploading ? '100%' : '0%'}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                            className="h-full bg-brand-indigo rounded-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex items-start gap-3 p-3 bg-brand-danger/10 border border-brand-danger/20 rounded-md text-brand-danger">
                    <FileWarning className="w-5 h-5 shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-brand-bg/50">
                <button
                  onClick={onClose}
                  disabled={isUploading}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-brand-indigo to-brand-violet hover:from-brand-indigo/90 hover:to-brand-violet/90 disabled:from-brand-indigo/50 disabled:to-brand-violet/50 rounded-md font-medium text-sm text-white transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)] disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>Upload File</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};
