import React, { useState } from 'react';
import { ShieldAlert, Ban, Flag, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { ReportReason, UserProfile } from '../types';

interface ReportBlockModalProps {
  targetUser: UserProfile | null;
  onClose: () => void;
  onUserBlocked: (blockedId: string) => void;
}

const REPORT_REASONS: ReportReason[] = [
  'Fake Profile',
  'Inappropriate Content',
  'Abuse',
  'Others',
];

export const ReportBlockModal: React.FC<ReportBlockModalProps> = ({
  targetUser,
  onClose,
  onUserBlocked,
}) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'menu' | 'report' | 'block'>('menu');
  const [selectedReason, setSelectedReason] = useState<ReportReason>('Inappropriate Content');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!targetUser) return null;

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    try {
      await addDoc(collection(db, 'reports'), {
        reporter_id: currentUser.uid,
        reporter_name: currentUser.name,
        reported_id: targetUser.uid,
        reported_name: targetUser.name,
        reason: selectedReason,
        description: description.trim(),
        created_at: serverTimestamp(),
      });

      setSuccessMessage('Report submitted successfully. Our safety team will review it shortly.');
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      console.error('Failed to submit report:', err);
      alert('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlockConfirm = async () => {
    if (!currentUser) return;
    setSubmitting(true);

    try {
      await addDoc(collection(db, 'blocked_users'), {
        blocker_id: currentUser.uid,
        blocked_id: targetUser.uid,
        created_at: serverTimestamp(),
      });

      await addDoc(collection(db, 'blocks'), {
        blocker_id: currentUser.uid,
        blocked_id: targetUser.uid,
        created_at: serverTimestamp(),
      });

      onUserBlocked(targetUser.uid);
      setSuccessMessage(`${targetUser.name} has been blocked.`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to block user:', err);
      alert('Failed to block user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div 
        className="w-full max-w-sm bg-[#16161C] border border-[#2A2A36] rounded-2xl p-5 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between pb-3 border-b border-[#23232C]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#FF69B4]" />
            <h3 className="font-bold text-white text-base">Safety & Moderation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success confirmation */}
        {successMessage ? (
          <div className="py-8 text-center flex flex-col items-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 animate-bounce" />
            <p className="text-white font-semibold text-sm">{successMessage}</p>
          </div>
        ) : (
          <>
            {/* Step 1: Menu selection */}
            {activeTab === 'menu' && (
              <div className="py-4 space-y-3">
                <div className="flex items-center gap-3 p-3 bg-[#0B0B0E] rounded-xl border border-[#23232C]">
                  <img
                    src={targetUser.profile_pic}
                    alt={targetUser.name}
                    className="w-10 h-10 rounded-full object-cover border border-[#333]"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white">{targetUser.name}, {targetUser.age}</h4>
                    <p className="text-xs text-zinc-400">{targetUser.location}</p>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => setActiveTab('report')}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl bg-[#202028] hover:bg-[#2A2A36] border border-zinc-800 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Flag className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-sm font-semibold text-white">Report User</div>
                        <div className="text-xs text-zinc-400">Flag inappropriate behavior or fake profiles</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('block')}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Ban className="w-5 h-5 text-red-400" />
                      <div>
                        <div className="text-sm font-semibold text-red-400">Block User</div>
                        <div className="text-xs text-zinc-400">Immediately hide this user & stop interactions</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Report Form */}
            {activeTab === 'report' && (
              <form onSubmit={handleReportSubmit} className="py-3 space-y-3">
                <p className="text-xs text-zinc-400">
                  Select a reason for reporting <span className="text-white font-medium">{targetUser.name}</span>:
                </p>

                <div className="space-y-1.5">
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer text-xs font-medium border transition ${
                        selectedReason === reason
                          ? 'bg-[#FF69B4]/15 border-[#FF69B4] text-[#FF69B4]'
                          : 'bg-[#0B0B0E] border-[#23232C] text-zinc-300 hover:bg-[#1A1A22]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={reason}
                        checked={selectedReason === reason}
                        onChange={() => setSelectedReason(reason)}
                        className="text-[#FF69B4] focus:ring-0"
                      />
                      {reason}
                    </label>
                  ))}
                </div>

                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide additional details..."
                    rows={3}
                    className="w-full bg-[#0B0B0E] border border-[#2A2A36] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-[#FF69B4] focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('menu')}
                    className="flex-1 py-2.5 rounded-xl bg-[#23232C] text-xs font-semibold text-zinc-300 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-[#FF69B4] text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Block Confirmation */}
            {activeTab === 'block' && (
              <div className="py-4 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Block {targetUser.name}?</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    They won't be able to call you or appear in your feed. You can unblock anytime from Settings.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('menu')}
                    className="flex-1 py-2.5 rounded-xl bg-[#23232C] text-xs font-semibold text-zinc-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBlockConfirm}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition disabled:opacity-50"
                  >
                    {submitting ? 'Blocking...' : 'Yes, Block User'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
