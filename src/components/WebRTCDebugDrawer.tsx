import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  X, 
  Copy, 
  Check, 
  Trash2, 
  Minimize2, 
  Maximize2, 
  ShieldAlert, 
  Activity, 
  Wifi, 
  Radio,
  Server
} from 'lucide-react';
import { WebRTCLogEntry } from '../services/webrtcService';

interface WebRTCDebugDrawerProps {
  logs: WebRTCLogEntry[];
  signalingState: string;
  iceState: string;
  connectionState: string;
  iceGatheringState: string;
  isOpen: boolean;
  onClose: () => void;
  onClearLogs: () => void;
}

export const WebRTCDebugDrawer: React.FC<WebRTCDebugDrawerProps> = ({
  logs,
  signalingState,
  iceState,
  connectionState,
  iceGatheringState,
  isOpen,
  onClose,
  onClearLogs,
}) => {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'errors' | 'ice' | 'signaling'>('all');
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.tag}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'errors') return log.type === 'error' || log.tag.includes('ERROR') || log.tag.includes('FAILED');
    if (filter === 'ice') return log.tag.startsWith('ICE') || log.tag.includes('CANDIDATE');
    if (filter === 'signaling') return log.tag.startsWith('OFFER') || log.tag.startsWith('ANSWER') || log.tag.startsWith('SIGNALING');
    return true;
  });

  const getIceStateColor = (state: string) => {
    switch (state) {
      case 'connected':
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'checking':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse';
      case 'disconnected':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getConnStateColor = (state: string) => {
    switch (state) {
      case 'connected':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'connecting':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-pulse';
      case 'disconnected':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="fixed inset-x-2 bottom-20 sm:bottom-24 sm:right-4 sm:left-auto sm:w-[480px] z-50 bg-[#0c0c14]/95 backdrop-blur-2xl border border-zinc-700/80 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden font-mono text-xs animate-in fade-in slide-in-from-bottom-5 duration-200">
      {/* Header Bar */}
      <div className="p-3 bg-[#13131d] border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white text-xs tracking-tight">WebRTC Diagnostic Log</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
            Live
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Status Matrix Ribbon */}
          <div className="p-2.5 bg-[#101018] border-b border-zinc-800/80 grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center justify-between p-1.5 bg-zinc-900/80 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 flex items-center gap-1">
                <Wifi className="w-3 h-3 text-cyan-400" />
                ICE State:
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getIceStateColor(iceState)}`}>
                {iceState || 'new'}
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 bg-zinc-900/80 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-pink-400" />
                Connection:
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getConnStateColor(connectionState)}`}>
                {connectionState || 'new'}
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 bg-zinc-900/80 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 flex items-center gap-1">
                <Radio className="w-3 h-3 text-purple-400" />
                Signaling:
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {signalingState || 'stable'}
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 bg-zinc-900/80 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 flex items-center gap-1">
                <Server className="w-3 h-3 text-amber-400" />
                ICE Gather:
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {iceGatheringState || 'new'}
              </span>
            </div>
          </div>

          {/* STUN / TURN Servers Notice */}
          <div className="px-3 py-1.5 bg-[#09090e] border-b border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              STUN: <span className="text-zinc-200">stun.l.google.com:19302</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              TURN: <span className="text-zinc-200">openrelay.metered.ca</span>
            </span>
          </div>

          {/* Log Controls & Filter Tabs */}
          <div className="px-3 py-2 bg-[#12121c] border-b border-zinc-800 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                  filter === 'all' ? 'bg-[#FF69B4] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                All ({logs.length})
              </button>
              <button
                onClick={() => setFilter('errors')}
                className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                  filter === 'errors' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Errors
              </button>
              <button
                onClick={() => setFilter('ice')}
                className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                  filter === 'ice' ? 'bg-cyan-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                ICE
              </button>
              <button
                onClick={() => setFilter('signaling')}
                className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                  filter === 'signaling' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Signaling
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyLogs}
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded flex items-center gap-1 text-[10px] transition active:scale-95"
                title="Copy all logs to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={onClearLogs}
                className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition"
                title="Clear logs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Log Stream Window */}
          <div
            ref={scrollRef}
            className="p-3 h-64 overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed select-text"
          >
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                No logs recorded yet. WebRTC events will stream here in realtime.
              </div>
            ) : (
              filteredLogs.map((item) => {
                let badgeColor = 'bg-zinc-800 text-zinc-300';
                let textColor = 'text-zinc-300';

                if (item.type === 'error') {
                  badgeColor = 'bg-red-500/25 text-red-400 border border-red-500/40';
                  textColor = 'text-red-300';
                } else if (item.type === 'warn') {
                  badgeColor = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40';
                  textColor = 'text-yellow-300';
                } else if (item.type === 'success') {
                  badgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                  textColor = 'text-emerald-300';
                } else if (item.type === 'signaling') {
                  badgeColor = 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
                  textColor = 'text-purple-200';
                } else if (item.type === 'ice') {
                  badgeColor = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
                  textColor = 'text-cyan-200';
                }

                return (
                  <div key={item.id} className="flex items-start gap-1.5 hover:bg-zinc-900/60 p-1 rounded">
                    <span className="text-[10px] text-zinc-500 shrink-0 select-none">
                      {item.timestamp}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${badgeColor}`}>
                      {item.tag}
                    </span>
                    <span className={`break-all ${textColor}`}>
                      {item.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
