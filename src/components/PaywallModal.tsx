export interface PaywallRequest {
  resource: string;
  amount: string;
  description: string;
  resolve: (sig: string) => void;
  reject: (err: Error) => void;
}

interface PaywallModalProps {
  paywall: PaywallRequest;
  paymentStatus: string;
  paymentTx: string;
  onAbort: () => void;
  onSettle: () => void;
}

export default function PaywallModal({
  paywall,
  paymentStatus,
  paymentTx,
  onAbort,
  onSettle,
}: PaywallModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none font-jetbrains animate-fade-in">
      <div className="max-w-md w-full border border-[#D9622B]/30 bg-[#171715] rounded p-6 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-[#D9622B]" />

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 border border-neutral-800 bg-[#D9622B]/5 flex items-center justify-center text-[#D9622B] text-[1.2rem] font-bold">
            ▲
          </div>
          <div className="space-y-1">
            <h3 className="mono text-[0.85rem] font-bold text-white tracking-wider">HTTP 402 PAYMENT REQUIRED</h3>
            <div className="mono text-[0.6rem] text-neutral-500">SCHEME: EIP-3009 (EXACT) · NETWORK: BASE SEPOLIA</div>
          </div>
        </div>

        <div className="border border-[#2A2A28] bg-black/40 p-4 rounded space-y-3 text-[0.7rem] mono">
          <div className="flex justify-between border-b border-neutral-900 pb-1.5">
            <span className="text-neutral-500">RESOURCE_GATED:</span>
            <span className="text-white truncate max-w-[200px]">{paywall.resource}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-900 pb-1.5">
            <span className="text-neutral-500">DESCRIPTION:</span>
            <span className="text-white truncate max-w-[200px]">{paywall.description}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-900 pb-1.5">
            <span className="text-neutral-500">PAY_TO_ADDRESS:</span>
            <span className="text-white font-semibold">0x709979...dc79C8</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">REQUIRED_USDC:</span>
            <span className="text-[#D9622B] font-bold">{parseFloat(paywall.amount) / 1000000} USDC</span>
          </div>
        </div>

        <p className="mono text-[0.65rem] text-neutral-400 leading-relaxed">
          This resource requires a stablecoin micropayment on Base Sepolia. Settlement is verified via signature before the analyst unlocks the payload.
        </p>

        {paymentStatus === '' ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={onAbort}
              className="mono border border-neutral-800 text-neutral-400 py-2.5 hover:bg-neutral-900 transition tracking-wider text-[0.7rem] rounded"
            >
              ABORT_QUERY
            </button>
            <button
              type="button"
              onClick={onSettle}
              className="mono bg-[#D9622B] text-white py-2.5 hover:bg-[#D9622B]/90 transition tracking-wider text-[0.7rem] font-bold rounded cursor-pointer"
            >
              AUTHORIZE_&_PAY
            </button>
          </div>
        ) : (
          <div className="border border-neutral-800 bg-[#0E0E0E] p-4 rounded text-center space-y-2">
            {paymentStatus === 'signing' ? (
              <>
                <div className="w-5 h-5 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin mx-auto mb-2" />
                <div className="mono text-[0.65rem] text-neutral-500 uppercase tracking-widest">SIGNING_EIP3009_PERMIT_PROOF...</div>
              </>
            ) : (
              <>
                <div className="text-green-500 text-[1.1rem] mb-1">✔ SETTLED</div>
                <div className="mono text-[0.55rem] text-neutral-500 uppercase truncate">TX: {paymentTx}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
