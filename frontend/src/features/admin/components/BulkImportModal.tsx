import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Download, X, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { PillButton } from '../../../components/common/PillButton';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ success: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const parseCSV = (csvContent: string) => {
    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      if (values.length === 0 || !values[0]) continue;

      const obj: any = {};
      headers.forEach((h, idx) => {
        const val = values[idx] || '';
        if (h === 'roll_number' || h === 'regno' || h === 'registrationnumber' || h === 'roll') {
          obj.roll_number = val.toUpperCase();
        } else if (h === 'name' || h === 'fullname') {
          obj.name = val;
        } else if (h === 'email') {
          obj.email = val;
        } else if (h === 'year') {
          obj.year = val;
        } else if (h === 'department' || h === 'dept') {
          obj.department = val;
        } else if (h === 'section' || h === 'sec') {
          obj.section = val;
        } else if (h === 'cgpa' || h === 'gpa') {
          obj.cgpa = parseFloat(val) || 0;
        } else if (h === 'batch') {
          obj.batch = val;
        } else if (h === 'phone' || h === 'mobile') {
          obj.phone = val;
        }
      });

      // Default fallbacks if header mapping differed
      if (!obj.roll_number && values[0]) obj.roll_number = values[0].toUpperCase();
      if (!obj.name && values[1]) obj.name = values[1];
      if (!obj.email && obj.roll_number) obj.email = `${obj.roll_number.toLowerCase()}@rgmcet.edu.in`;
      if (!obj.year) obj.year = '3rd Year';
      if (!obj.department) obj.department = 'CSE(Data Science)';
      if (!obj.section) obj.section = 'A';
      if (!obj.batch) obj.batch = '2023-2027';

      if (obj.roll_number) {
        rows.push(obj);
      }
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setRawText(content);
      parseCSV(content);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setRawText(text);
    parseCSV(text);
  };

  const downloadSampleTemplate = () => {
    const sampleHeaders = 'roll_number,name,email,year,department,section,cgpa,batch,phone\n';
    const sampleRows =
      '23091A3251,Jayanth Kumar,jayanth@rgmcet.edu.in,3rd Year,CSE(Data Science),A,9.45,2023-2027,9876543210\n' +
      '23091A32A0,Ramesh Varma,23091a32a0@rgmcet.edu.in,3rd Year,CSE(Data Science),B,9.15,2023-2027,9876543211\n' +
      '23091A32B5,Sravani Reddy,23091a32b5@rgmcet.edu.in,3rd Year,CSE(Data Science),A,8.80,2023-2027,9876543212\n';

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sample_Student_Roster_Import.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) {
      alert('Please upload a valid CSV file or paste formatted CSV rows.');
      return;
    }

    setLoading(true);
    setResultMessage(null);

    try {
      const res = await api.bulkImportStudents(parsedRows);
      setResultMessage({
        success: true,
        text: res.message || `Successfully imported ${parsedRows.length} student records into database.`,
      });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setResultMessage({
        success: false,
        text: err.message || 'Failed to complete bulk import.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-borderLine rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderLine pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-textPrimary">Bulk Import Roster & Marks (CSV)</h3>
              <p className="text-xs text-textSecondary">Upload student marksheet CSV to register or update multiple profiles instantly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-background text-textSecondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Download & Upload Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-dashed border-borderLine rounded-xl p-4 text-center hover:border-brand-primary transition-all bg-background/50 flex flex-col items-center justify-center">
            <FileText className="w-8 h-8 text-brand-primary mb-2" />
            <p className="text-xs font-bold text-textPrimary mb-1">Select CSV File</p>
            <p className="text-[11px] text-textSecondary mb-3">{fileName || 'Supports .csv format with headers'}</p>
            <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all">
              Browse File
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="bg-background/80 border border-borderLine rounded-xl p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-textPrimary mb-1 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-brand-primary" />
                Sample Template CSV
              </h4>
              <p className="text-[11px] text-textSecondary mb-3">Download standard CSV template formatted for JNTUA student registration & CGPA import.</p>
            </div>
            <PillButton variant="outline" size="sm" onClick={downloadSampleTemplate} icon={<Download className="w-3.5 h-3.5" />}>
              Download CSV Template
            </PillButton>
          </div>
        </div>

        {/* Text Area for Direct Paste */}
        <div>
          <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Or Paste CSV Text Directly</label>
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="roll_number,name,email,year,department,section,cgpa,batch,phone&#10;23091A3251,Jayanth Kumar,jayanth@rgmcet.edu.in,3rd Year,CSE(Data Science),A,9.45,2023-2027,9876543210"
            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-borderLine bg-background text-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        {/* Preview Table */}
        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-textPrimary">Parsed Rows Preview ({parsedRows.length} Valid Records)</span>
              <span className="text-emerald-600 font-semibold">✓ Ready for import</span>
            </div>
            <div className="max-h-40 overflow-y-auto border border-borderLine rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-background border-b border-borderLine text-textSecondary">
                  <tr>
                    <th className="py-2 px-3">Roll No</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Year / Sec</th>
                    <th className="py-2 px-3">CGPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {parsedRows.slice(0, 10).map((r, idx) => (
                    <tr key={idx} className="hover:bg-background/50">
                      <td className="py-2 px-3 font-mono font-bold text-brand-primary">{r.roll_number}</td>
                      <td className="py-2 px-3 text-textPrimary">{r.name}</td>
                      <td className="py-2 px-3 text-textSecondary">{r.year} • Sec {r.section}</td>
                      <td className="py-2 px-3 font-bold text-green-600">{r.cgpa > 0 ? r.cgpa : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 && (
                <div className="p-2 text-center text-[10px] text-textSecondary bg-background border-t border-borderLine">
                  + {parsedRows.length - 10} more rows
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notification Result Banner */}
        {resultMessage && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${resultMessage.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {resultMessage.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{resultMessage.text}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-borderLine pt-4">
          <PillButton variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </PillButton>
          <PillButton variant="primary" size="sm" onClick={handleImportSubmit} disabled={loading || parsedRows.length === 0} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}>
            {loading ? 'Importing Roster...' : `Import ${parsedRows.length} Students`}
          </PillButton>
        </div>
      </div>
    </div>
  );
};
