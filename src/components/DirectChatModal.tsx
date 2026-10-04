import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Phone, 
  Video, 
  Smile, 
  CheckCheck, 
  Loader2,
  Sparkles,
  ShieldAlert,
  Heart
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  setDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth, stripUndefinedFields } from '../context/AuthContext';
import { UserProfile } from '../types';
import { getUserAvatarUrl } from '../services/staticCdnService';

export interface DirectMessage {
  id?: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: any;
}

interface DirectChatModalProps {
  targetUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onVoiceCall?: (user: UserProfile) => void;
  onVideoCall?: (user: UserProfile) => void;
}

export const DirectChatModal: React.FC<DirectChatModalProps> = ({
  targetUser,
  isOpen,
  onClose,
  onVoiceCall,
  onVideoCall,
}) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const chatId = currentUser && targetUser 
    ? [currentUser.uid, targetUser.uid].sort().join('_')
    : null;

  useEffect(() => {
    if (!isOpen || !chatId || !currentUser || !targetUser) return;

    setLoadingHistory(true);
    const msgsRef = collection(db, 'direct_chats', chatId, 'messages');
    const q = query(msgsRef, orderBy('created_at', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DirectMessage[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as DirectMessage);
      });
      setMessages(list);
      setLoadingHistory(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }, (err) => {
      console.warn('[DirectChat] Snapshot query fallback notice:', err);
      setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [isOpen, chatId, currentUser, targetUser]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !currentUser || !targetUser || !chatId || sending) return;

    setInputText('');
    setSending(true);

    const optimisticMsg: DirectMessage = {
      sender_id: currentUser.uid,
      receiver_id: targetUser.uid,
      text,
      created_at: new Date(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      // 1. Add to messages subcollection
      const msgsRef = collection(db, 'direct_chats', chatId, 'messages');
      await addDoc(msgsRef, stripUndefinedFields({
        sender_id: currentUser.uid,
        receiver_id: targetUser.uid,
        text,
        created_at: serverTimestamp(),
      }));

      // 2. Update chat metadata doc
      await setDoc(doc(db, 'direct_chats', chatId), stripUndefinedFields({
        id: chatId,
        users: [currentUser.uid, targetUser.uid],
        last_message: text,
        last_message_at: serverTimestamp(),
        last_sender_id: currentUser.uid,
        updated_at: serverTimestamp(),
      }), { merge: true });

    } catch (err) {
      console.error('[DirectChat] Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !targetUser) return null;

  const targetAvatar = getUserAvatarUrl(targetUser);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md h-[92vh] sm:h-[640px] bg-[#121217] border border-[#23232C] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-3.5 bg-[#16161F] border-b border-[#23232C] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <img
                src={targetAvatar}
                alt={targetUser.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-[#FF6BA9] shadow-sm"
              />
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-black ${
                targetUser.status === 'online' ? 'bg-emerald-400' : 'bg-zinc-500'
              }`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                <span>{targetUser.name}</span>
                {targetUser.role === 'listener' && (
                  <span className="px-1.5 py-0.2 bg-[#FF6BA9]/20 text-[#FF6BA9] text-[9px] font-extrabold rounded-md">
                    Listener
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                {targetUser.location || 'Online'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onVoiceCall && (
              <button
                type="button"
                onClick={() => onVoiceCall(targetUser)}
                className="p-2 rounded-xl bg-[#20202A] hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition active:scale-95 cursor-pointer"
                title="Voice Call"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}
            {onVideoCall && targetUser.allowVideoCalls !== false && (
              <button
                type="button"
                onClick={() => onVideoCall(targetUser)}
                className="p-2 rounded-xl bg-[#20202A] hover:bg-pink-500/20 text-[#FF6BA9] hover:text-pink-300 transition active:scale-95 cursor-pointer"
                title="Video Call"
              >
                <Video className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#20202A] hover:bg-zinc-800 text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B0B0E]">
          {loadingHistory ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF6BA9]" />
              <span>Connecting encrypted chat...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#FF6BA9]/15 border border-[#FF6BA9]/30 flex items-center justify-center text-[#FF6BA9] shadow-lg">
                <Heart className="w-7 h-7 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-white">Start the conversation!</h4>
              <p className="text-xs text-zinc-400 max-w-[240px]">
                Say hi to {targetUser.name}! Break the ice with friendly conversation or start a call.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {['Hi there! 👋', 'Loved your profile! ✨', 'Are you free to talk? 📞', 'How is your day? 🌸'].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInputText(prompt);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-[#16161F] hover:bg-[#20202A] border border-[#23232C] text-zinc-300 text-[11px] font-medium transition cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUser?.uid;
              return (
                <div
                  key={msg.id || idx}
                  className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <img
                      src={targetAvatar}
                      alt={targetUser.name}
                      className="w-6 h-6 rounded-full object-cover shrink-0 mb-1"
                    />
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                      isMe
                        ? 'bg-gradient-to-r from-[#FF6BA9] to-[#FF4D8D] text-white rounded-br-none'
                        : 'bg-[#181822] border border-[#262635] text-zinc-200 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                    <div className={`mt-1 text-[9px] flex items-center justify-end gap-1 ${
                      isMe ? 'text-pink-100/70' : 'text-zinc-500'
                    }`}>
                      <span>
                        {msg.created_at?.toDate
                          ? msg.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && <CheckCheck className="w-3 h-3 text-pink-200" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-[#16161F] border-t border-[#23232C] flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${targetUser.name}...`}
            className="flex-1 bg-[#0E0E14] border border-[#282835] focus:border-[#FF6BA9] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition"
            maxLength={600}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-2.5 rounded-2xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white transition active:scale-95 disabled:opacity-40 disabled:hover:bg-[#FF6BA9] cursor-pointer shadow-[0_2px_12px_rgba(255,107,169,0.3)] shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
