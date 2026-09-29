import React from 'react';
import { X, Shield, FileText, AlertTriangle } from 'lucide-react';

interface LegalModalProps {
  type: 'terms' | 'privacy' | 'help' | null;
  onClose: () => void;
}

export const LegalModals: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#16161C] border-t sm:border border-[#2A2A36] rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#23232C]">
          <div className="flex items-center gap-2">
            {type === 'terms' ? (
              <FileText className="w-5 h-5 text-[#FF69B4]" />
            ) : type === 'privacy' ? (
              <Shield className="w-5 h-5 text-[#FF69B4]" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[#FF69B4]" />
            )}
            <h3 className="font-bold text-white text-base">
              {type === 'terms' && 'Terms & Conditions'}
              {type === 'privacy' && 'Privacy Policy'}
              {type === 'help' && 'Help & Community Support'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 text-xs text-zinc-300 leading-relaxed space-y-4">
          {type === 'terms' && (
            <>
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 font-semibold">
                STRICT POLICY: Meet Up is exclusively for adults aged 18 and older. Any depiction of nudity, sexual harassment, or illegal content is strictly forbidden and results in instant account termination and IP ban.
              </div>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">1. Age Requirement & Eligibility</h4>
                <p>
                  You must be at least 18 years of age to register and use this service. By using Meet Up, you declare and warrant that you are 18 years of age or older.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">2. Zero Tolerance Policy on Nudity & Harassment</h4>
                <p>
                  We enforce zero tolerance for vulgarity, sexually explicit video/audio streams, solicitation, non-consensual sharing, or abusive speech. Violators are automatically blocked, reported, and permanently banned.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">3. Virtual Coins & Diamond Balance</h4>
                <p>
                  Coins are virtual tokens used to connect with listeners and creators on a per-minute basis. Coins have no direct monetary redemption outside the platform, except diamonds accumulated by verified listeners under listener payout terms.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">4. Account Termination & Deletion</h4>
                <p>
                  Users may delete their account at any time under Settings. Doing so permanently purges all profile data, auth credentials, and active records from Firestore.
                </p>
              </section>
            </>
          )}

          {type === 'privacy' && (
            <>
              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">1. Information We Collect</h4>
                <p>
                  We collect your profile details (name, age, bio, avatar, language), contact information (email address and mobile phone number), city location, call session logs, and reports submitted for platform safety.
                </p>
              </section>

              <section className="space-y-1 p-3 bg-[#FF69B4]/10 border border-[#FF69B4]/30 rounded-2xl">
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#FF69B4]" />
                  2. Admin Access for Support Purposes
                </h4>
                <p className="text-pink-100 font-medium leading-relaxed">
                  Authorized platform administrators can access your name, email ID, and mobile number strictly for user support, identity verification, account troubleshooting, billing inquiries, and trust & safety enforcement. Your personal contact details are never shared with other users or sold to third parties.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">3. Camera & Microphone Permissions</h4>
                <p>
                  Video and audio calls require access to your device microphone and camera. Streams are transmitted peer-to-peer or via secured WebRTC / ZEGOCLOUD channels and are never recorded without consent.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">4. Data Isolation & Security</h4>
                <p>
                  Your information is secured via Firebase Firestore authentication and security rules. Sensitive payment processing occurs through certified PCI-DSS test gateways (Cashfree / PhonePe sandbox).
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">5. Hard Deletion Rights (GDPR / CCPA)</h4>
                <p>
                  You retain full ownership of your data. You can delete your account at any time, which irrevocably scrubs your user document from Firestore.
                </p>
              </section>
            </>
          )}

          {type === 'help' && (
            <>
              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">Frequently Asked Questions</h4>
                <div className="space-y-2 mt-2">
                  <div className="p-3 bg-[#0B0B0E] rounded-xl border border-zinc-800">
                    <p className="font-bold text-white">How do call charges work?</p>
                    <p className="text-zinc-400 mt-1">
                      Each listener sets their per-minute rate. When a call connects, coins are deducted each minute from your wallet balance.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0B0B0E] rounded-xl border border-zinc-800">
                    <p className="font-bold text-white">How do I become a Listener?</p>
                    <p className="text-zinc-400 mt-1">
                      Click 'Become a Listener' in your Profile, fill out your languages and conversational experience, and submit your application.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0B0B0E] rounded-xl border border-zinc-800">
                    <p className="font-bold text-white">How do I report someone?</p>
                    <p className="text-zinc-400 mt-1">
                      Tap the (...) icon on any user card and select 'Report User' or 'Block User'.
                    </p>
                  </div>
                </div>
              </section>

              <div className="p-3 bg-[#FF69B4]/10 rounded-xl border border-[#FF69B4]/30 text-center">
                <p className="text-white font-bold">Need instant support?</p>
                <p className="text-zinc-400 mt-0.5">Email us at: safety@meetup.com</p>
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 py-3 rounded-xl bg-[#23232C] hover:bg-[#2A2A36] text-white font-bold text-xs transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};
