import type { ReactNode } from 'react';

interface LockedPreviewProps {
  title: string;
  description: string;
  amountUsdc: string;
  onUnlock: () => void;
  disabled?: string | boolean;
  className?: string;
  children?: ReactNode;
}

export default function LockedPreview({
  title,
  description,
  amountUsdc,
  onUnlock,
  disabled = false,
  className = '',
  children,
}: LockedPreviewProps) {
  return (
    <div className={`relative overflow-hidden min-h-[220px] ${className}`}>
      <div className="pointer-events-none select-none blur-[6px] opacity-40 scale-[1.01]" aria-hidden>
        {children || (
          <div className="space-y-3 p-2">
            <div className="h-3 w-2/3 bg-neutral-800 rounded" />
            <div className="h-3 w-1/2 bg-neutral-800 rounded" />
            <div className="h-24 w-full bg-neutral-900 border border-[#2A2A28] rounded" />
            <div className="h-3 w-3/4 bg-neutral-800 rounded" />
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[1px] p-6 text-center">
        <div className="mono text-[0.55rem] text-[#D9622B] tracking-widest mb-2">HTTP 402 · PAYMENT REQUIRED</div>
        <h4 className="font-syncopate text-[0.75rem] tracking-widest text-white mb-2">{title}</h4>
        <p className="mono text-[0.65rem] text-neutral-400 max-w-xs leading-relaxed mb-5">{description}</p>
        <button
          type="button"
          onClick={onUnlock}
          disabled={Boolean(disabled)}
          className="mono bg-[#D9622B] text-white px-5 py-2.5 hover:bg-[#D9622B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition tracking-wider text-[0.7rem] font-bold rounded cursor-pointer"
        >
          UNLOCK · {amountUsdc} USDC
        </button>
      </div>
    </div>
  );
}
