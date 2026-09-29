import React from 'react';
import { Flame, Clock, User, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation, SupportedLanguage } from '../utils/i18n';

export type NavTab = 'home' | 'recents' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const { currentUser } = useAuth();
  const lang = (currentUser?.language?.toUpperCase() || 'EN') as SupportedLanguage;
  const { t } = useTranslation(lang);

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'home',
      label: t('home'),
      icon: <Flame className="w-5 h-5" />,
    },
    {
      id: 'recents',
      label: t('recents'),
      icon: <Clock className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: t('profile'),
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0f0f1a]/95 backdrop-blur-xl border-t border-[#232334] pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around py-2 px-3">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center w-20 py-1 rounded-xl transition-all duration-200 relative cursor-pointer ${
                isActive
                  ? 'text-[#ff4d8d]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div
                className={`p-1 rounded-full transition-transform ${
                  isActive ? 'scale-110 drop-shadow-[0_0_10px_rgba(255,77,141,0.6)]' : ''
                }`}
              >
                {item.icon}
              </div>
              <span className="text-[11px] font-medium tracking-tight mt-0.5">
                {item.label}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff4d8d] shadow-[0_0_6px_#ff4d8d] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
