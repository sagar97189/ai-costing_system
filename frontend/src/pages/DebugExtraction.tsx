import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, AlertTriangle, ChevronDown, ChevronRight, HardDrive } from 'lucide-react';

export default function DebugExtraction() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/process-drawing', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during extraction.');
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full border border-green-500/30">{Math.round(confidence * 100)}%</span>;
    } else if (confidence >= 0.7) {
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">{Math.round(confidence * 100)}%</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full border border-red-500/30">{Math.round(confidence * 100)}%</span>;
    }
  };

  const renderReviewBadge = (requiresReview: boolean) => {
    if (!requiresReview) return null;
    return <span className="px-2 py-1 text-xs font-medium bg-orange-500/20 text-orange-400 rounded-full border border-orange-500/30 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Review</span>;
  };

  // Group dimensions by manufacturing_type
  const dimensions = result?.features?.dimensions || [];
  const groupedDimensions = dimensions.reduce((acc: any, dim: any) => {
    const type = dim.manufacturing_type || 'unknown_dimension';
    if (!acc[type]) acc[type] = [];
    acc[type].push(dim);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#050d16] text-ice-200 p-4 md:p-8 font-sans pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="border-b border-white/10 pb-6 sticky top-0 bg-[#050d16]/95 backdrop-blur z-10 pt-4">
          <div className="flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-signal" />
            <h1 className="text-2xl font-bold text-powder uppercase tracking-wider font-mono">ED Extraction Debug</h1>
          </div>
          <p className="text-sm text-ice-500 mt-2">Temporary UI for inspecting AI Engineering Drawing extractions.</p>
        </header>

        {/* Upload Section */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-xl backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-powder mb-4 flex items-center gap-2"><Upload className="w-5 h-5"/> Upload Drawing</h2>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input 
              type="file" 
              accept=".pdf,image/*" 
              onChange={handleFileChange}
              className="block w-full text-sm text-ice-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-signal/10 file:text-signal
                hover:file:bg-signal/20
                cursor-pointer transition-colors"
            />
            <button 
              onClick={handleExtract}
              disabled={loading || !file}
              className={`px-6 py-2 rounded-full font-mono text-sm uppercase tracking-wider transition-all
                ${loading || !file ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-signal text-ice-950 hover:bg-signal/90 font-bold'}`}
            >
              {loading ? 'Extracting...' : 'Extract Drawing'}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </section>

        {/* Results Section */}
        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Status & Basic Info */}
            <section className="flex flex-col md:flex-row gap-4 items-center justify-between bg-green-500/5 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                <div>
                  <h3 className="text-green-400 font-semibold">Extraction Successful</h3>
                  <p className="text-xs text-ice-500">File: {file?.name}</p>
                </div>
              </div>
              {result.debug_image_url && (
                <a href={result.debug_image_url} target="_blank" rel="noreferrer" className="text-signal text-sm hover:underline flex items-center gap-1">
                  <FileText className="w-4 h-4"/> View OCR Debug Image
                </a>
              )}
            </section>

            {/* Dimensions Table */}
            <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-black/20">
                <h2 className="text-lg font-semibold text-powder">Dimensions & Features</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-ice-300">
                  <thead className="text-xs uppercase bg-black/40 text-ice-500 font-mono">
                    <tr>
                      <th className="px-4 py-3">Type Group</th>
                      <th className="px-4 py-3">Raw Text</th>
                      <th className="px-4 py-3">Format</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                      <th className="px-4 py-3 text-right">Min</th>
                      <th className="px-4 py-3 text-right">Max</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Mapping Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.keys(groupedDimensions).length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-ice-600">No dimensions extracted.</td></tr>
                    ) : (
                      Object.entries(groupedDimensions).map(([type, dims]: [string, any]) => (
                        <React.Fragment key={type}>
                          <tr className="bg-black/20 border-t border-white/10">
                            <td colSpan={9} className="px-4 py-2 font-mono text-xs text-signal uppercase tracking-wider">
                              {type} <span className="text-ice-600 ml-2">({dims.length})</span>
                            </td>
                          </tr>
                          {dims.map((dim: any, idx: number) => (
                            <tr key={`${type}-${idx}`} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3">
                                {renderReviewBadge(dim.requires_engineer_review)}
                              </td>
                              <td className="px-4 py-3 font-mono text-powder">{dim.raw_text || '-'}</td>
                              <td className="px-4 py-3 text-ice-500">{dim.source_format || '-'}</td>
                              <td className="px-4 py-3 text-right font-mono">{dim.nominal !== undefined && dim.nominal !== null ? dim.nominal : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono text-ice-500">{dim.min !== undefined && dim.min !== null ? dim.min : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono text-ice-500">{dim.max !== undefined && dim.max !== null ? dim.max : '-'}</td>
                              <td className="px-4 py-3 text-ice-500">{dim.unit || '-'}</td>
                              <td className="px-4 py-3">{renderBadge(dim.confidence)}</td>
                              <td className="px-4 py-3 text-xs text-ice-500 max-w-[200px] truncate" title={dim.mapping_reason}>{dim.mapping_reason || '-'}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Grid for smaller sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              
              {/* Title Block */}
              <section className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="font-semibold text-powder mb-4 border-b border-white/10 pb-2">Title Block</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(result.features?.title_block || {}).length === 0 ? (
                    <p className="text-ice-600">No title block data.</p>
                  ) : (
                    Object.entries(result.features.title_block).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between border-b border-white/5 py-1">
                        <span className="text-ice-500 font-mono text-xs uppercase">{k}</span>
                        <span className="text-ice-200">{v}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Materials */}
              <section className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="font-semibold text-powder mb-4 border-b border-white/10 pb-2">Materials</h3>
                <div className="space-y-2 text-sm">
                  {(!result.features?.materials || result.features.materials.length === 0) ? (
                    <p className="text-ice-600">No materials detected.</p>
                  ) : (
                    result.features.materials.map((m: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between border-b border-white/5 py-1">
                        <span className="text-ice-200 font-mono">{m.value}</span>
                        {renderBadge(m.confidence)}
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Notes */}
              <section className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="font-semibold text-powder mb-4 border-b border-white/10 pb-2">Notes</h3>
                <ul className="space-y-2 text-sm list-disc pl-4">
                  {(!result.features?.notes || result.features.notes.length === 0) ? (
                    <p className="text-ice-600 -ml-4">No notes detected.</p>
                  ) : (
                    result.features.notes.map((n: string, idx: number) => (
                      <li key={idx} className="text-ice-300">{n}</li>
                    ))
                  )}
                </ul>
              </section>
            </div>

            {/* BOM Table (if exists) */}
            {result.features?.bom_table && result.features.bom_table.length > 0 && (
              <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/10 bg-black/20">
                  <h2 className="text-lg font-semibold text-powder">BOM Table</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-ice-300">
                    <thead className="text-xs uppercase bg-black/40 text-ice-500 font-mono">
                      <tr>
                        {Object.keys(result.features.bom_table[0]).map(k => <th key={k} className="px-4 py-3">{k}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {result.features.bom_table.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/5">
                          {Object.values(row).map((v: any, i: number) => <td key={i} className="px-4 py-2">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Raw JSON Toggle */}
            <div className="pt-8">
              <button 
                onClick={() => setShowRawJson(!showRawJson)}
                className="flex items-center gap-2 text-ice-400 hover:text-signal transition-colors font-mono text-sm"
              >
                {showRawJson ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                View Raw Extraction JSON
              </button>
              
              {showRawJson && (
                <pre className="mt-4 p-4 bg-black/50 border border-white/10 rounded-xl overflow-x-auto text-xs text-ice-300 font-mono">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
