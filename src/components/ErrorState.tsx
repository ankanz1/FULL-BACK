interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({
  title = 'REQUEST FAILED',
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center px-4 ${className}`}>
      <div className="text-[#D9622B] mono text-[0.75rem] tracking-widest mb-3">▲ {title}</div>
      <p className="mono text-[0.65rem] text-neutral-400 leading-relaxed max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mono border border-[#ECEAE3] text-[#ECEAE3] px-4 py-2 hover:bg-[#D9622B] hover:border-[#D9622B] hover:text-white transition tracking-wider text-[0.65rem]"
        >
          RETRY
        </button>
      )}
    </div>
  );
}
