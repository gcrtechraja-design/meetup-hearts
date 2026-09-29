import React from 'react';
import { X, Globe, Check } from 'lucide-react';
import { LANGUAGES, SupportedLanguage } from '../utils/i18n';
import { useAuth } from '../context/AuthContext';

interface LanguageSwitcherModalProps {
  onClose: () => void;
}

export const LanguageSwitcherModal: React.FC<LanguageSwitcherModalProps> = ({ onClose }) => {
  const { currentUser, updateUserLanguage } = useAuth();
  const currentLang = (currentUser?.language?.toUpperCase() || 'EN') as SupportedLanguage;

  const handleSelect = async (code: SupportedLanguage) => {
    await updateUserLanguage(code);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div 
        className="w-full max-w-sm bg-[#16161C] border-t sm:border border-[#2A2A36] rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto shadow-2xl relative p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#23232C]">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#FF69B4]" />
            <h3 className="font-bold text-white text-base">Select Language</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-3 grid grid-cols-1 gap-2">
          {LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition text-left ${
                  isSelected
                    ? 'bg-[#FF69B4]/15 border-[#FF69B4] text-white'
                    : 'bg-[#0B0B0E] border-[#23232C] text-zinc-300 hover:bg-[#1C1C24]'
                }`}
              >
                <div>
                  <span className="text-sm font-bold block">{lang.native}</span>
                  <span className="text-xs text-zinc-400">{lang.label} ({lang.code})</span>
                </div>

                {isSelected && (
                  <span className="p-1 rounded-full bg-[#FF69B4] text-white">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
