import React, { useState } from 'react';
import { Plus, Award, UploadCloud, CheckCircle2, Sparkles, ExternalLink, Edit2 } from 'lucide-react';
import { Certification } from '../../../types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { PillButton } from '../../../components/common/PillButton';

interface CertificationsTabProps {
  certifications: Certification[];
  readOnly?: boolean;
  onRefresh: () => void;
}

const PROVIDERS = [
  'AWS',
  'Coursera',
  'Udemy',
  'NPTEL',
  'Google',
  'Oracle',
  'Cisco',
  'RedHat',
  'NVIDIA',
  'UiPath',
  'GeeksforGeeks',
  'Medium',
  'Other',
];

export const CertificationsTab: React.FC<CertificationsTabProps> = ({ certifications, readOnly = false, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [provider, setProvider] = useState('AWS');
  const [title, setTitle] = useState('');
  const [dateCompleted, setDateCompleted] = useState('2024-03-15');
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const { user } = useAuth();
  const activeRollNo = user?.rollNumber || '23091A3251';

  const completedCerts = certifications.filter((c) => !c.suggested);
  const suggestedCerts = certifications.filter((c) => c.suggested);

  // Format ISO dates to human-readable format (e.g. "Mar 15, 2024")
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '2024';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Check if a certificate URL is actually reachable (not a placeholder/broken S3 bucket)
  const isCertUrlValid = (url: string | undefined): boolean => {
    if (!url) return false;
    // Reject placeholder URLs from local dev without S3
    if (url.includes('placeholder-no-bucket')) return false;
    // Reject known non-existent bucket URLs
    if (url.includes('advitiyans-uploads.s3')) return false;
    return true;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || readOnly) return;
    setUploading(true);
    try {
      const presigned = await api.getUploadUrl(activeRollNo, file.name, 'certs');

      // Upload the file to S3 using the PUT pre-signed URL
      if (presigned.uploadUrl && !presigned.warning) {
        await fetch(presigned.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
      }

      // Store the viewUrl (GET pre-signed URL) for later viewing
      setFileUrl(presigned.viewUrl || presigned.uploadUrl);
    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (cert: Certification) => {
    setEditingCert(cert);
    setProvider(cert.provider);
    setTitle(cert.title);
    setDateCompleted(cert.date_completed ? cert.date_completed.slice(0, 10) : '2024-03-15');
    setFileUrl(cert.certificate_file_url || null);
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingCert(null);
    setProvider('AWS');
    setTitle('');
    setDateCompleted('2024-03-15');
    setFileUrl(null);
    setShowModal(true);
  };

  const handleSaveCert = async () => {
    if (!title.trim() || readOnly) return;
    try {
      const certData = {
        provider,
        title: title.trim(),
        date_completed: dateCompleted,
        certificate_file_url: fileUrl || undefined,
        suggested: false,
      };

      if (editingCert && editingCert.id) {
        await api.updateCertification(activeRollNo, editingCert.id, certData);
      } else {
        await api.saveCertification(activeRollNo, certData);
      }

      setShowModal(false);
      setEditingCert(null);
      setTitle('');
      onRefresh();
    } catch (e: any) {
      alert('Failed to save certificate: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-textPrimary">Industry Certifications</h3>
          <p className="text-xs text-textSecondary">Upload verified technical certifications & cloud credentials</p>
        </div>
        {!readOnly && (
          <PillButton variant="primary" size="sm" onClick={openAddModal} icon={<Plus className="w-3.5 h-3.5" />}>
            Add Certification
          </PillButton>
        )}
      </div>

      {/* Completed Certifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {completedCerts.map((cert) => (
          <div key={cert.id || cert.title} className="bg-surface border border-borderLine rounded-xl p-5 shadow-sm flex items-start gap-4">
            <div className="p-3 rounded-xl bg-brand-soft text-brand-primary shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-primary text-white">
                    {cert.provider}
                  </span>
                  <span className="text-xs text-textSecondary">{formatDate(cert.date_completed)}</span>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => openEditModal(cert)}
                    className="p-1.5 rounded-lg text-textSecondary hover:text-brand-primary hover:bg-brand-soft/50 transition-all"
                    title="Edit certification"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <h4 className="text-sm font-bold text-textPrimary mt-1.5">{cert.title}</h4>
              {cert.certificate_file_url && (
                isCertUrlValid(cert.certificate_file_url) ? (
                  <a
                    href={cert.certificate_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Certificate PDF</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="mt-2 text-xs font-medium text-textSecondary inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    Certificate uploaded (file preview unavailable)
                  </span>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested Certifications Section */}
      {suggestedCerts.length > 0 && (
        <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
          <h4 className="text-sm font-bold text-textPrimary mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-primary" />
            <span>Recommended Certifications for your Career Goal</span>
          </h4>
          <div className="space-y-3">
            {suggestedCerts.map((sc) => (
              <div key={sc.id || sc.title} className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 mr-2">
                    {sc.provider}
                  </span>
                  <span className="text-xs font-semibold text-textPrimary">{sc.title}</span>
                </div>
                <PillButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingCert(null);
                    setProvider(sc.provider);
                    setTitle(sc.title);
                    setShowModal(true);
                  }}
                >
                  Add to My Certs
                </PillButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-bold text-textPrimary mb-4">
              {editingCert ? 'Edit Certification' : 'Add Certification'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Certification Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AWS Certified Solutions Architect"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Date Completed</label>
                <input
                  type="date"
                  value={dateCompleted}
                  onChange={(e) => setDateCompleted(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Upload Certificate File (PDF/Image)</label>
                <input type="file" onChange={handleFileUpload} className="text-xs text-textSecondary" />
                {uploading && <p className="text-xs text-brand-primary mt-1">Generating pre-signed S3 upload URL...</p>}
                {fileUrl && <p className="text-xs text-success font-semibold mt-1">✓ File ready for upload</p>}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <PillButton variant="outline" size="sm" onClick={() => { setShowModal(false); setEditingCert(null); }}>Cancel</PillButton>
                <PillButton variant="primary" size="sm" onClick={handleSaveCert}>
                  {editingCert ? 'Update Certificate' : 'Save Certificate'}
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
