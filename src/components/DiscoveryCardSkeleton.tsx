import React from 'react';

export const DiscoveryCardSkeleton: React.FC = () => {
  return (
    <div className="relative bg-[#16161C] border border-[#23232C] rounded-2xl overflow-hidden flex flex-col shadow-lg animate-pulse">
      {/* Top Image Skeleton with Shimmer */}
      <div className="relative h-72 w-full bg-[#1A1A23] overflow-hidden">
        {/* Shimmer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
        
        {/* Gradient shadow towards bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#16161C] via-transparent to-black/30" />

        {/* Top Badges (Status badge & action buttons) */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          {/* Status badge skeleton */}
          <div className="h-6 w-20 rounded-full bg-zinc-700/50 border border-zinc-600/30" />

          {/* Action icon skeletons */}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-zinc-700/50 border border-zinc-600/30" />
            <div className="w-8 h-8 rounded-full bg-zinc-700/50 border border-zinc-600/30" />
          </div>
        </div>

        {/* Bottom Image Info Skeleton (Name, Age, Location) */}
        <div className="absolute bottom-3 left-3 right-3 z-10 space-y-2">
          <div className="h-6 w-36 bg-zinc-700/70 rounded-lg" />
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-zinc-700/60" />
            <div className="h-3.5 w-28 bg-zinc-700/50 rounded-md" />
          </div>
        </div>
      </div>

      {/* Card Body Skeleton */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
        {/* Bio lines */}
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-zinc-800/80 rounded" />
          <div className="h-3 w-4/5 bg-zinc-800/60 rounded" />
        </div>

        {/* Language badge & Tag Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <div className="h-5 w-16 bg-purple-500/10 border border-purple-500/20 rounded-full" />
          <div className="h-5 w-20 bg-zinc-800/80 rounded-full border border-zinc-700/30" />
          <div className="h-5 w-16 bg-zinc-800/80 rounded-full border border-zinc-700/30" />
        </div>

        {/* Rate Cards Skeleton */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#23232C]">
          <div className="bg-[#0B0B0E] p-2 rounded-xl border border-zinc-800/80 h-10 flex items-center justify-between px-2.5">
            <div className="h-3.5 w-12 bg-zinc-800 rounded" />
            <div className="h-3.5 w-8 bg-zinc-800 rounded" />
          </div>
          <div className="bg-[#0B0B0E] p-2 rounded-xl border border-zinc-800/80 h-10 flex items-center justify-between px-2.5">
            <div className="h-3.5 w-12 bg-zinc-800 rounded" />
            <div className="h-3.5 w-8 bg-zinc-800 rounded" />
          </div>
        </div>

        {/* Action Call Buttons Skeleton */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20" />
          <div className="h-9 rounded-xl bg-pink-500/15 border border-pink-500/20" />
        </div>
      </div>
    </div>
  );
};
