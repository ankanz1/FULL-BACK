interface LoadingStateProps {
  label?: string;
  className?: string;
}

export default function LoadingState({
  label = 'LOADING TELEMETRY...',
  className = '',
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className="w-8 h-8 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin mb-4" />
      <span className="mono text-[0.6rem] text-neutral-500 tracking-widest uppercase">{label}</span>
    </div>
  );
}
