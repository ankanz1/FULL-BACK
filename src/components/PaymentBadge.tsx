interface PaymentBadgeProps {
  amountLabel: string;
  tx?: string;
  chain?: string;
  className?: string;
}

export default function PaymentBadge({
  amountLabel,
  tx,
  chain = 'BASE SEPOLIA',
  className = '',
}: PaymentBadgeProps) {
  const shortTx = tx ? `${tx.slice(0, 10)}...` : null;

  return (
    <span
      className={`inline-flex items-center gap-2 mono text-[0.55rem] px-2 py-0.5 border border-[#D9622B]/30 bg-[#D9622B]/5 text-[#D9622B] rounded uppercase tracking-wider ${className}`}
    >
      <span>SETTLED · {amountLabel}</span>
      <span className="text-[#D9622B]/70">·</span>
      <span>{chain}</span>
      {shortTx && (
        <>
          <span className="text-[#D9622B]/70">·</span>
          <span className="text-neutral-400">Tx_{shortTx}</span>
        </>
      )}
    </span>
  );
}
