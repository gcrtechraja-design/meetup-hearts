import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';

export type PaymentStatus = 'pending' | 'verified' | 'rejected' | 'success' | 'failed' | string;

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const normalizedStatus = (status || '').toLowerCase().trim();

  let config = {
    label: 'Pending',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
    Icon: Clock,
  };

  switch (normalizedStatus) {
    case 'verified':
    case 'success':
      config = {
        label: 'Verified',
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        dot: 'bg-emerald-400',
        Icon: CheckCircle,
      };
      break;

    case 'rejected':
    case 'failed':
      config = {
        label: 'Rejected',
        bg: 'bg-rose-500/15',
        border: 'border-rose-500/30',
        text: 'text-rose-400',
        dot: 'bg-rose-400',
        Icon: XCircle,
      };
      break;

    case 'pending':
    default:
      config = {
        label: 'Pending',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
        text: 'text-amber-300',
        dot: 'bg-amber-400',
        Icon: Clock,
      };
      break;
  }

  const { Icon } = config;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${config.bg} ${config.border} ${config.text} ${sizeClasses} ${className}`}
    >
      {showIcon && (
        <span className="relative flex items-center justify-center">
          {normalizedStatus === 'pending' ? (
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          ) : (
            <Icon className={`${iconSizes} shrink-0`} />
          )}
        </span>
      )}
      <span className="tracking-wide uppercase text-[10px] font-extrabold">{config.label}</span>
    </span>
  );
};

export default PaymentStatusBadge;
