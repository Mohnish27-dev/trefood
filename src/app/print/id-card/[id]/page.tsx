import { notFound } from "next/navigation";
import { getDeliveryPartnerForVerification } from "@/server/services/delivery-partner";
import { generateTreFoodQrSvg } from "@/server/services/qr";
import { PrintButton } from "@/components/print/print-button";
import { ShieldCheck, User } from "lucide-react";
import Image from "next/image";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function IdCardPrintPage({ params }: Props) {
  const { id } = await params;
  if (!id) notFound();

  const data = await getDeliveryPartnerForVerification(id);
  if (!data) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-red-600">Delivery Partner Not Found</h1>
        <p className="text-sm text-gray-600 mt-2">Cannot generate ID Card for ID: {id}</p>
      </div>
    );
  }

  const { partner, restaurant, campus } = data;
  const canonicalId = partner.badgeId || partner._id;
  const verifyUrl = `https://trefood.in/verify/delivery/${encodeURIComponent(canonicalId)}`;

  // Generate high-resolution SVG QR code directly
  const qrSvg = await generateTreFoodQrSvg({
    url: verifyUrl,
    size: 280,
  });

  const formattedIssued = new Date(partner.issuedAt).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

  const formattedExpiry = partner.expiresAt
    ? new Date(partner.expiresAt).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      })
    : "PERMANENT";

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 text-slate-900 print:bg-white print:p-0">
      {/* Non-printed action bar */}
      <div className="max-w-xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            TreFood Delivery Partner ID Card
          </h1>
          <p className="text-xs text-slate-600">
            Standard CR80 Size (54mm × 86mm). Print on PVC or glossy photo card.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Printable Sheet containing Card Front and Card Back */}
      <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8 print:flex-row print:gap-4 print:m-0">
        
        {/* ================= CARD FRONT ================= */}
        <div
          id="card-front"
          className="relative bg-white rounded-2xl border-2 border-slate-300 shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400"
          style={{ width: "54mm", height: "86mm", boxSizing: "border-box" }}
        >
          {/* Lanyard punch guide hole (hidden on print) */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-6 h-1.5 rounded-full border border-dashed border-slate-300 print:border-slate-400" />

          {/* Top Brand Banner */}
          <div className="bg-[#ff5414] text-white px-3 pt-3.5 pb-2 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-black text-sm tracking-tight">TREFOOD</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider bg-white/20 px-1 py-0.5 rounded">
                Campus
              </span>
            </div>
            <div className="text-[7.5px] tracking-widest font-extrabold uppercase opacity-95 mt-0.5">
              Authorized Delivery Partner
            </div>
          </div>

          {/* Partner Photo + Identity */}
          <div className="px-3 pt-2 text-center flex flex-col items-center">
            {partner.photoUrl ? (
              <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-[#ff5414] shadow-sm mb-1.5">
                <Image
                  src={partner.photoUrl}
                  alt={partner.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-[#ff5414] flex items-center justify-center text-slate-400 mb-1.5">
                <User className="w-7 h-7 text-slate-400" />
              </div>
            )}

            <h2 className="text-[11px] font-black text-slate-900 leading-tight">
              {partner.name}
            </h2>
            <div className="inline-block mt-0.5 px-1.5 py-0.5 bg-orange-50 border border-orange-200 text-[#ff5414] font-mono font-bold text-[8px] rounded">
              ID: {partner.badgeId}
            </div>

            {/* Vendor & Campus Details */}
            <div className="mt-1.5 w-full text-[7.5px] text-slate-600 space-y-0.5 border-t border-slate-100 pt-1">
              <div className="flex justify-between items-center font-medium">
                <span className="text-slate-600">Vendor:</span>
                <span className="font-bold text-slate-900 truncate max-w-[28mm]">
                  {partner.restaurantName}
                </span>
              </div>
              <div className="flex justify-between items-center font-medium">
                <span className="text-slate-600">Campus:</span>
                <span className="font-semibold text-slate-800">
                  {campus?.name || partner.campusName}
                </span>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="px-3 pb-2 pt-1 flex flex-col items-center justify-center bg-slate-50 border-t border-slate-100">
            <div
              className="w-16 h-16 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="text-[6.5px] font-bold text-slate-500 uppercase tracking-wide mt-1 text-center">
              Scan to Verify at Campus Gate
            </div>
          </div>
        </div>

        {/* ================= CARD BACK ================= */}
        <div
          id="card-back"
          className="relative bg-white rounded-2xl border-2 border-slate-300 shadow-xl overflow-hidden flex flex-col justify-between p-3 print:shadow-none print:border-slate-400 text-slate-800"
          style={{ width: "54mm", height: "86mm", boxSizing: "border-box" }}
        >
          {/* Lanyard punch guide hole (hidden on print) */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-6 h-1.5 rounded-full border border-dashed border-slate-300 print:border-slate-400" />

          <div className="pt-2">
            <div className="flex items-center gap-1 text-[#ff5414] font-bold text-[9px] uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              Campus Entry Guidelines
            </div>
            <ul className="mt-1.5 text-[6.5px] text-slate-600 space-y-1 leading-tight list-disc pl-2.5">
              <li>Wear this identity pass visibly at all times inside campus.</li>
              <li>Handover food only at authorized hostel gates and delivery points.</li>
              <li>Comply with campus gate curfew timings strictly.</li>
              <li>Unauthorized entry into residential hostel rooms is strictly prohibited.</li>
            </ul>
          </div>

          <div className="border-t border-slate-200 pt-2 space-y-1 text-[7px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Issue Date:</span>
              <span className="font-bold">{formattedIssued}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Valid Till:</span>
              <span className="font-bold">{formattedExpiry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Helpline:</span>
              <span className="font-bold text-[#ff5414]">+91 98765 43210</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2 text-center text-[6px] text-slate-600 leading-tight">
            <p className="font-semibold text-slate-700">Property of TreFood Technologies Pvt. Ltd.</p>
            <p className="mt-0.5">If found, please return to university security office or contact TreFood.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
