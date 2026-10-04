import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, UserCheck, Languages, DollarSign, Headphones, AlertCircle, Loader2 } from 'lucide-react';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth, stripUndefinedFields } from '../context/AuthContext';
import { getRandomListenerAvatar } from '../data/listenerAvatars';

interface ListenerApplicationModalProps {
  onClose: () => void;
}

export const ListenerApplicationModal: React.FC<ListenerApplicationModalProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [experience, setExperience] = useState('');
  const [languages, setLanguages] = useState<string[]>(['Tamil', 'English']);
  const [voiceRate, setVoiceRate] = useState<number>(10);
  const [videoRate, setVideoRate] = useState<number>(50);
  const [allowVideoCalls, setAllowVideoCalls] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const availableLanguages = [
    'Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam', 'Kannada', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi'
  ];

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter((l) => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorToast(null);

    if (!currentUser) {
      setErrorToast('Please log in to submit your listener application.');
      return;
    }

    setSubmitting(true);

    try {
      const assignedPic = currentUser.profile_pic && !currentUser.profile_pic.includes('randomuser.me') 
        ? currentUser.profile_pic 
        : getRandomListenerAvatar();

      const payload = stripUndefinedFields({
        user_id: currentUser.uid,
        name: currentUser.name || 'Member',
        email: currentUser.email || '',
        profile_pic: assignedPic,
        avatar_url: assignedPic,
        languages: languages.length > 0 ? languages : ['Tamil', 'English'],
        experience: experience.trim() || 'Friendly listener',
        voice_rate: Number(voiceRate) || 10,
        video_rate: Number(videoRate) || 50,
        allowVideoCalls: Boolean(allowVideoCalls),
        status: 'pending',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // 1. Add to listener_applications collection with await
      await addDoc(collection(db, 'listener_applications'), payload);

      // 2. Also register in listeners collection with await
      await setDoc(doc(db, 'listeners', currentUser.uid), payload, { merge: true });

      setSubmitted(true);
    } catch (err: any) {
      console.error('[ListenerApplication] Submission error:', err);
      setErrorToast(err?.message || 'Submission failed. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#16161C] border-t sm:border border-[#2A2A36] rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#23232C]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FF69B4]/20 flex items-center justify-center text-[#FF69B4]">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Become a Listener</h3>
              <p className="text-[11px] text-zinc-400">Earn diamonds from audio & video calls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorToast && (
          <div className="my-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="flex-1">{errorToast}</span>
            <button 
              type="button" 
              onClick={() => setErrorToast(null)} 
              className="p-1 hover:text-white text-zinc-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {submitted ? (
          <div className="py-10 text-center flex flex-col items-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 animate-bounce" />
            <h4 className="text-lg font-bold text-white">Application Submitted!</h4>
            <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
              Your application has been received. Our admin team will review your profile and approve your listener badge shortly.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-[#FF69B4] text-xs font-bold text-white shadow-md hover:opacity-90 transition"
            >
              Back to App
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-4 space-y-4">
            {/* Step Indicators */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className={`w-8 h-1.5 rounded-full ${step >= 1 ? 'bg-[#FF69B4]' : 'bg-zinc-800'}`} />
              <span className={`w-8 h-1.5 rounded-full ${step >= 2 ? 'bg-[#FF69B4]' : 'bg-zinc-800'}`} />
              <span className={`w-8 h-1.5 rounded-full ${step >= 3 ? 'bg-[#FF69B4]' : 'bg-zinc-800'}`} />
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Languages className="w-4 h-4 text-[#FF69B4]" />
                  Languages you are fluent in
                </h4>
                <p className="text-xs text-zinc-400">
                  Select all languages you are comfortable speaking during calls:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {availableLanguages.map((lang) => {
                    const isSelected = languages.includes(lang);
                    return (
                      <button
                        type="button"
                        key={lang}
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                          isSelected
                            ? 'bg-[#FF69B4]/20 border-[#FF69B4] text-[#FF69B4]'
                            : 'bg-[#0B0B0E] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full mt-4 py-3 rounded-xl bg-[#FF69B4] text-xs font-bold text-white hover:opacity-90 transition"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Your Listening Experience & Style
                </h4>
                <p className="text-xs text-zinc-400">
                  Briefly describe your conversational style and how you support callers:
                </p>
                <textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g. Empathetic listener with background in psychology and friendly counseling..."
                  rows={4}
                  className="w-full bg-[#0B0B0E] border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF69B4] resize-none"
                  required
                />

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 rounded-xl bg-[#23232C] text-xs font-semibold text-zinc-300"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={!experience.trim()}
                    className="flex-1 py-3 rounded-xl bg-[#FF69B4] text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Proposed Rates (Coins per minute)
                </h4>

                <div className="space-y-3">
                  {/* Allow Video Calls Toggle */}
                  <div className="p-3 bg-[#0B0B0E] border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">Allow Video Calls</span>
                      <span className="text-[10px] text-zinc-400 block">
                        {allowVideoCalls ? 'Accept both audio & video calls (Recommended)' : 'Audio calls only (Video Call hidden)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAllowVideoCalls(!allowVideoCalls)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        allowVideoCalls ? 'bg-[#FF69B4]' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          allowVideoCalls ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Voice Call Rate (Coins/min): <span className="text-amber-300 font-bold">{voiceRate}</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      value={voiceRate}
                      onChange={(e) => setVoiceRate(Number(e.target.value))}
                      className="w-full accent-[#FF69B4]"
                    />
                  </div>

                  {allowVideoCalls && (
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">
                        Video Call Rate (Coins/min): <span className="text-amber-300 font-bold">{videoRate}</span>
                      </label>
                      <input
                        type="range"
                        min="40"
                        max="90"
                        value={videoRate}
                        onChange={(e) => setVideoRate(Number(e.target.value))}
                        className="w-full accent-[#FF69B4]"
                      />
                    </div>
                  )}
                </div>

                <div className="p-3 bg-[#0B0B0E] rounded-xl border border-zinc-800 text-[11px] text-zinc-400">
                  Listeners earn 1 diamond for every 10 coins spent by callers, withdrawable as real rewards!
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 rounded-xl bg-[#23232C] text-xs font-semibold text-zinc-300"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white transition disabled:opacity-50 shadow-md"
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
