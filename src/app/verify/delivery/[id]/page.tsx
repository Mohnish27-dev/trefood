import { notFound } from "next/navigation";
import { getDeliveryPartnerForVerification } from "@/server/services/delivery-partner";
import { DeliveryVerificationCard } from "@/components/verify/delivery-verification-card";
import { AlertOctagon, ShieldX } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function DeliveryVerifyPage({ params }: Props) {
  const { id } = await params;
  if (!id) notFound();

  const verificationData = await getDeliveryPartnerForVerification(id);

  if (!verificationData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-900/60 p-8 space-y-5 shadow-2xl shadow-rose-950/50">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-600 flex items-center justify-center text-rose-500">
            <ShieldX className="h-9 w-9" />
          </div>

          <div>
            <div className="text-xs font-black uppercase tracking-widest text-rose-400">
              Security Alert
            </div>
            <h1 className="text-2xl font-black text-white mt-1">
              RECORD NOT FOUND
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              No registered delivery personnel exists with Badge ID{" "}
              <span className="font-mono text-rose-400 font-bold">"{id}"</span>.
              This QR code or ID card is invalid or counterfeit.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-[11px] text-rose-300 font-medium text-left flex items-start gap-2.5">
            <AlertOctagon className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>
              <strong>Gate Security Notice:</strong> Do not grant entry into the campus. Report this unauthorized person to TreFood Security immediately.
            </span>
          </div>

          <div className="pt-2">
            <a
              href="tel:1800123456"
              className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
            >
              Call TreFood Security Helpline
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <DeliveryVerificationCard data={verificationData} />;
}
