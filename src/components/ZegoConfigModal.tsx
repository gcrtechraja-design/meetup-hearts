import React, { useState } from 'react';
import { X, Key, ShieldCheck, Video, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import { getZegoAppId, getZegoServerSecret, setZegoCredentials } from '../services/zegoService';

interface ZegoConfigModalProps {
  onClose: () => void;
}

export const ZegoConfigModal: React.FC<ZegoConfigModalProps> = ({ onClose }) => {
  const [appId, setAppId] = useState<string>(getZegoAppId().toString());
  const [serverSecret, setServerSecret] = useState<string>(getZegoServerSecret());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numAppId = Number(appId.trim());
    if (isNaN(numAppId) || numAppId <= 0) {
      alert('Please enter a valid numeric ZEGOCLOUD AppID');
      return;
    }
    if (!serverSecret.trim()) {
      alert('Please enter a valid ZEGOCLOUD Server Secret');
      return;
    }

    setZegoCredentials(numAppId, serverSecret.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    localStorage.removeItem('meetup_zego_app_id');
    localStorage.removeItem('meetup_zego_server_secret');
    setAppId(getZegoAppId().toString());
    setServerSecret(getZegoServerSecret());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div 
        className="w-full max-w-sm bg-[#16161C] border border-[#FF69B4] rounded-3xl p-5 shadow-[0_0_25px_rgba(255,105,180,0.3)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#23232C]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#FF69B4]/20 text-[#FF69B4]">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">ZEGOCLOUD Settings</h3>
              <p className="text-[10px] text-zinc-400">Configure AppID & Server Secret</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess ? (
          <div className="py-8 text-center flex flex-col items-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
            <h4 className="text-sm font-bold text-white">ZEGOCLOUD Keys Saved!</h4>
            <p className="text-xs text-zinc-400">Live Video, Voice & Screen Share configured.</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="py-4 space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                ZEGOCLOUD AppID
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="e.g. 1484647939"
                className="w-full bg-[#0B0B0E] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#FF69B4]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                ZEGOCLOUD Server Secret
              </label>
              <input
                type="text"
                value={serverSecret}
                onChange={(e) => setServerSecret(e.target.value)}
                placeholder="e.g. 4068ef573678dc2fbb5591cfc24cb349"
                className="w-full bg-[#0B0B0E] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#FF69B4]"
                required
              />
            </div>

            <div className="p-2.5 rounded-xl bg-purple-900/20 border border-purple-500/30 text-[11px] text-zinc-300 leading-relaxed">
              <span className="font-bold text-purple-300 block mb-0.5">Features Enabled:</span>
              ✓ 1-on-1 HD Video Calling<br/>
              ✓ High Fidelity Voice Calling<br/>
              ✓ Real-time Screen Sharing
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="p-2.5 rounded-xl bg-[#23232C] hover:bg-[#2F2F3D] text-zinc-300 text-xs flex items-center justify-center transition"
                title="Reset to default"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#FF69B4] hover:opacity-95 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save ZEGOCLOUD Keys
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
