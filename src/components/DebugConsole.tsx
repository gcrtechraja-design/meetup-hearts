import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Trash2, 
  Download, 
  Filter, 
  Wifi, 
  Radio, 
  Activity, 
  Server, 
  AlertCircle, 
  Search, 
  ArrowDownCircle,
  Minimize2,
  Maximize2,
  X
} from 'lucide-react';
import { WebRTCLogEntry, CandidateCounts } from '../services/webrtcService';

export interface DebugConsoleProps {
  logs: WebRTCLogEntry[];
  signalingState: string;
  iceState: string;
  connectionState: string;
  iceGatheringState: string;
  candidateCounts?: CandidateCounts;
  isOpen: boolean;
  onClose?: () => void;
  onClearLogs: () => void;
  defaultCollapsed?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({
  logs,
  signalingState,
  iceState,
  connectionState,
  iceGatheringState,
  candidateCounts = { host: 0, srflx: 0, relay: 0, total: 0 },
  isOpen,
  onClose,
  onClearLogs,
  defaultCollapsed = true,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(
    controlledCollapsed !== undefined ? controlledCollapsed : defaultCollapsed
  );

  // Sync internal state if controlledCollapsed changes from parent
  useEffect(() => {
    if (controlledCollapsed !== undefined) {
      setInternalCollapsed(controlledCollapsed);
    }
  }, [controlledCollapsed]);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const setIsCollapsed = (valOrFn: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof valOrFn === 'function' ? valOrFn(isCollapsed) : valOrFn;
    setInternalCollapsed(nextVal);
    onToggleCollapse?.(nextVal);
  };

  // Requirement 2: Auto-collapse console when ICE state becomes "connected"
  useEffect(() => {
    if (iceState === 'connected' || iceState === 'completed') {
      setIsCollapsed(true);
    }
  }, [iceState]);

  const [filterType, setFilterType] = useState<'all' | 'ice' | 'signaling' | 'conn' | 'errors'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExpandedFull, setIsExpandedFull] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to latest logs when enabled
  useEffect(() => {
    if (autoScroll && !isCollapsed && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isCollapsed, filterType, searchQuery]);

  if (!isOpen) return null;

  const errorCount = logs.filter(
    (l) => l.type === 'error' || l.tag.includes('ERR') || l.tag.includes('FAIL')
  ).length;

  const handleCopy = () => {
    const formatted = logs
      .map((l) => `[${l.timestamp}] [${l.tag.padEnd(12)}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const header = `# WebRTC Diagnostic Log Export\n# Exported at: ${new Date().toISOString()}\n# Signaling: ${signalingState} | ICE: ${iceState} | Conn: ${connectionState} | Gather: ${iceGatheringState}\n# ------------------------------------------------------------\n\n`;
    const formatted = header + logs
      .map((l) => `[${l.timestamp}] [${l.tag}] ${l.message}`)
      .join('\n');
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webrtc-debug-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'errors') {
      const isErr = log.type === 'error' || log.tag.includes('ERR') || log.tag.includes('FAIL');
      if (!isErr) return false;
    } else if (filterType === 'ice') {
      const isIce = log.type === 'ice' || log.tag.startsWith('ICE') || log.tag.includes('CAND');
      if (!isIce) return false;
    } else if (filterType === 'signaling') {
      const isSig = log.type === 'signaling' || log.tag.startsWith('OFFER') || log.tag.startsWith('ANSWER') || log.tag.startsWith('SIG');
      if (!isSig) return false;
    } else if (filterType === 'conn') {
      const isConn = log.type === 'conn' || log.tag.startsWith('CONN') || log.tag.startsWith('DISC');
      if (!isConn) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.tag.toLowerCase().includes(q) ||
        log.timestamp.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getIceBadge = () => {
    switch (iceState) {
      case 'connected':
      case 'completed':
        return { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40' };
      case 'checking':
        return { dot: 'bg-amber-400 animate-ping', text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40' };
      case 'disconnected':
        return { dot: 'bg-yellow-400 animate-ping', text: 'text-yellow-400', bg: 'bg-yellow-500/25', border: 'border-yellow-500/50' };
      case 'failed':
        return { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/25', border: 'border-red-500/50' };
      default:
        return { dot: 'bg-zinc-400', text: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' };
    }
  };

  const getConnBadge = () => {
    switch (connectionState) {
      case 'connected':
        return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40' };
      case 'connecting':
        return { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/40' };
      case 'disconnected':
        return { text: 'text-yellow-400', bg: 'bg-yellow-500/25', border: 'border-yellow-500/50' };
      case 'failed':
        return { text: 'text-red-400', bg: 'bg-red-500/25', border: 'border-red-500/50' };
      default:
        return { text: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' };
    }
  };

  const iceBadge = getIceBadge();
  const connBadge = getConnBadge();

  // 1. COLLAPSED VIEW (Floating Diagnostic Overlay Pill)
  // Requirement 3: Ensure video elements have higher z-index (20, 30) than debug panel when collapsed (10)
  if (isCollapsed) {
    return (
      <div 
        id="webrtc-debug-console"
        data-testid="debug-console"
        data-state="collapsed"
        style={{ zIndex: 10 }}
        className="fixed top-16 right-3 sm:right-6 z-10 animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0E0E18]/90 hover:bg-[#161626] backdrop-blur-xl border border-zinc-700/80 shadow-[0_8px_30px_rgba(0,0,0,0.8)] text-xs font-mono transition-all duration-200 hover:scale-105 active:scale-95 group"
          title="Click to expand WebRTC Debug Console"
        >
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${iceBadge.dot}`} />
            <Terminal className="w-3.5 h-3.5 text-[#FF69B4]" />
            <span className="font-bold text-white text-[11px] tracking-tight">Debug Console</span>
          </span>

          <span className="h-3 w-[1px] bg-zinc-700" />

          {/* Candidate Types Summary (Requirement 6) */}
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] font-mono text-zinc-300">
            <span className="text-blue-300">🏠{candidateCounts.host}</span>
            <span className={candidateCounts.srflx > 0 ? 'text-emerald-300 font-bold' : 'text-zinc-500'}>🌐{candidateCounts.srflx}</span>
            <span className={candidateCounts.relay > 0 ? 'text-purple-300 font-bold' : 'text-zinc-500'}>🔄{candidateCounts.relay}</span>
          </span>

          {errorCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-500/30 border border-red-500/60 text-red-300 text-[9px] font-bold">
              {errorCount} err
            </span>
          )}

          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold">
            {logs.length}
          </span>

          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform" />
        </button>
      </div>
    );
  }

  // 2. EXPANDED VIEW (Full Overlay Terminal Console)
  return (
    <div
      id="webrtc-debug-console"
      data-testid="debug-console"
      data-state="expanded"
      style={{ zIndex: 50 }}
      className={`fixed z-50 bg-[#0B0B14]/95 backdrop-blur-2xl border border-zinc-700/80 rounded-2xl sm:rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden font-mono transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
        isExpandedFull
          ? 'inset-3 sm:inset-6'
          : 'bottom-20 sm:bottom-24 right-2 left-2 sm:left-auto sm:right-4 sm:w-[540px] max-h-[75vh]'
      }`}
    >
      {/* 1. Header Bar with collapse/expand controls */}
      <div className="p-2.5 sm:p-3 bg-[#131322] border-b border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#FF69B4]/15 border border-[#FF69B4]/30 flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-[#FF69B4]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs tracking-tight">
                WebRTC Debug Console
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center gap-1 text-[10px] transition active:scale-95"
            title="Copy all logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition active:scale-95"
            title="Download logs file (.txt)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearLogs}
            className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />

          <button
            onClick={() => setIsExpandedFull(!isExpandedFull)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition hidden sm:block"
            title={isExpandedFull ? 'Restore normal size' : 'Expand full screen'}
          >
            {isExpandedFull ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            title="Collapse to compact overlay pill"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              title="Close Console"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Realtime State Ribbon */}
      <div className="p-2 bg-[#0E0E18] border-b border-zinc-850 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
        {/* ICE State */}
        <div className="p-1.5 bg-zinc-900/90 rounded-lg border border-zinc-800 flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1">
            <Wifi className="w-3 h-3 text-cyan-400" />
            ICE:
          </span>
          <span className={`px-1.5 py-0.5 rounded font-bold border ${iceBadge.bg} ${iceBadge.text} ${iceBadge.border}`}>
            {iceState}
          </span>
        </div>

        {/* Peer Connection State */}
        <div className="p-1.5 bg-zinc-900/90 rounded-lg border border-zinc-800 flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-pink-400" />
            Conn:
          </span>
          <span className={`px-1.5 py-0.5 rounded font-bold border ${connBadge.bg} ${connBadge.text} ${connBadge.border}`}>
            {connectionState}
          </span>
        </div>

        {/* Signaling State */}
        <div className="p-1.5 bg-zinc-900/90 rounded-lg border border-zinc-800 flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1">
            <Radio className="w-3 h-3 text-purple-400" />
            Signaling:
          </span>
          <span className="px-1.5 py-0.5 rounded font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            {signalingState}
          </span>
        </div>

        {/* ICE Gathering */}
        <div className="p-1.5 bg-zinc-900/90 rounded-lg border border-zinc-800 flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1">
            <Server className="w-3 h-3 text-amber-400" />
            Gather:
          </span>
          <span className="px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            {iceGatheringState}
          </span>
        </div>
      </div>

      {/* 2b. Candidate Types Found (Requirement 6) */}
      <div className="px-2 py-1.5 bg-[#0C0C16] border-b border-zinc-850 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
        <div className="flex items-center gap-1 text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
          <span>Candidates:</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Host */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300" title="Host candidates (Local network LAN / Wi-Fi)">
            <span>🏠 Host:</span>
            <span className="font-bold">{candidateCounts.host}</span>
          </div>

          {/* STUN srflx */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
            candidateCounts.srflx > 0 
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold' 
              : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
          }`} title="STUN srflx candidates (Public IP for NAT traversal)">
            <span>🌐 STUN:</span>
            <span>{candidateCounts.srflx}</span>
          </div>

          {/* TURN relay */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
            candidateCounts.relay > 0 
              ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 font-bold' 
              : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
          }`} title="TURN relay candidates (Fallback relay via server)">
            <span>🔄 Relay:</span>
            <span>{candidateCounts.relay}</span>
          </div>

          {/* Total */}
          <span className="text-[9px] text-zinc-500 font-mono">
            ({candidateCounts.total} total)
          </span>
        </div>
      </div>

      {/* Host Only Warning Banner (Requirement 2) */}
      {candidateCounts.host > 0 && candidateCounts.srflx === 0 && candidateCounts.relay === 0 && (
        <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Network Notice: Only host candidates found. STUN srflx not received; cross-network calls may need TURN fallback.</span>
        </div>
      )}

      {/* 3. Server Configuration & Filter Toolbar */}
      <div className="px-2.5 py-1.5 bg-[#121220] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-1.5">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
              filterType === 'all'
                ? 'bg-[#FF69B4] text-white shadow-sm'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            All ({logs.length})
          </button>
          <button
            onClick={() => setFilterType('errors')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition ${
              filterType === 'errors'
                ? 'bg-red-600 text-white shadow-sm'
                : errorCount > 0
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            Errors {errorCount > 0 && `(${errorCount})`}
          </button>
          <button
            onClick={() => setFilterType('ice')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
              filterType === 'ice'
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            ICE
          </button>
          <button
            onClick={() => setFilterType('signaling')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
              filterType === 'signaling'
                ? 'bg-purple-600 text-white'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            Signaling
          </button>
          <button
            onClick={() => setFilterType('conn')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
              filterType === 'conn'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            Connection
          </button>
        </div>

        {/* Search & Auto-scroll Toggle */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-6 pr-2 py-0.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-[10px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FF69B4] w-24 sm:w-32"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 transition ${
              autoScroll
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll paused'}
          >
            <ArrowDownCircle className={`w-3 h-3 ${autoScroll ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="hidden sm:inline">Auto-scroll</span>
          </button>
        </div>
      </div>

      {/* 4. Active Servers Indicator */}
      <div className="px-3 py-1 bg-[#090910] border-b border-zinc-850 flex items-center justify-between text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          STUN: <span className="text-zinc-300">stun.l.google.com:19302, stun1</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          TURN: <span className="text-zinc-300">openrelay.metered.ca:80/443 (Optional)</span>
        </span>
      </div>

      {/* 5. Logs Stream Area */}
      <div
        ref={logContainerRef}
        className={`p-2.5 overflow-y-auto space-y-1 font-mono text-[10.5px] leading-snug select-text bg-[#08080E] ${
          isExpandedFull ? 'flex-1 min-h-[300px]' : 'h-64 sm:h-72'
        }`}
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs py-10">
            <Terminal className="w-6 h-6 mb-2 text-zinc-600" />
            <p>No matching logs found</p>
            <span className="text-[10px] text-zinc-600 mt-0.5">
              {logs.length === 0 ? 'Waiting for WebRTC events...' : 'Try adjusting filter or search term'}
            </span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            let badgeStyle = 'bg-zinc-800 text-zinc-400 border-zinc-700';
            let messageStyle = 'text-zinc-300';

            if (log.type === 'error' || log.tag.includes('ERR') || log.tag.includes('FAIL')) {
              badgeStyle = 'bg-red-500/20 text-red-400 border-red-500/40 font-bold';
              messageStyle = 'text-red-300 font-medium';
            } else if (log.type === 'warn' || log.tag.includes('WARN') || log.tag.includes('TIMEOUT')) {
              badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
              messageStyle = 'text-amber-200';
            } else if (log.type === 'success' || log.tag.includes('RECOVER') || log.tag.includes('COMPLETE')) {
              badgeStyle = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
              messageStyle = 'text-emerald-300';
            } else if (log.type === 'signaling' || log.tag.startsWith('OFFER') || log.tag.startsWith('ANSWER')) {
              badgeStyle = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
              messageStyle = 'text-purple-200';
            } else if (log.type === 'ice' || log.tag.startsWith('ICE') || log.tag.includes('CAND')) {
              badgeStyle = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
              messageStyle = 'text-cyan-200';
            } else if (log.type === 'conn') {
              badgeStyle = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
              messageStyle = 'text-blue-200';
            }

            return (
              <div
                key={log.id}
                className="flex items-start gap-1.5 p-1 rounded hover:bg-zinc-900/60 transition group"
              >
                <span className="text-[9.5px] text-zinc-500 shrink-0 select-none pt-0.5">
                  {log.timestamp}
                </span>

                <span
                  className={`px-1.5 py-0.2 rounded text-[8.5px] uppercase tracking-wider shrink-0 border ${badgeStyle}`}
                >
                  {log.tag}
                </span>

                <span className={`break-all leading-normal ${messageStyle}`}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 6. Footer Ribbon */}
      <div className="px-3 py-1.5 bg-[#10101C] border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="text-zinc-500">Total events:</span>
          <span className="text-white font-bold">{logs.length}</span>
        </span>

        <button
          onClick={() => setIsCollapsed(true)}
          className="text-xs text-[#FF69B4] hover:underline flex items-center gap-1 font-bold"
        >
          <span>Collapse to badge</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
