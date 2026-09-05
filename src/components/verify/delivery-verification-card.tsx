"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User as UserIcon,
} from "lucide-react";
import Image from "next/image";
import type { DeliveryPartnerVerificationResult } from "@/server/services/delivery-partner";

interface Props {
  data: DeliveryPartnerVerificationResult;
}

export function DeliveryVerificationCard({ data }: Props) {
  const { partner, restaurant, campus, isAuthorized } = data;
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  // Live anti-screenshot clock ticking every second
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour12: true,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Kolkata",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedExpiry = partner.expiresAt
    ? new Date(partner.expiresAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No Expiry";

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 select-none">
      <div className="space-y-4">
        {/* TreFood Official Campus Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/30">
              <span className="font-black text-white text-lg tracking-tight">Tf</span>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                TreFood Campus Pass
              </div>
              <div className="text-sm font-bold text-white">
                Delivery Verification System
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              Official Seal
            </span>
          </div>
        </div>

        {/* Primary Security Status Banner */}
        {isAuthorized ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white shadow-xl shadow-emerald-900/40 border border-emerald-400/30">
            {/* Animated subtle shimmer line */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shrink-0 shadow-inner">
                <ShieldCheck className="h-9 w-9 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  Verified Active
                </div>
                <h1 className="text-xl font-extrabold tracking-tight mt-0.5">
                  ENTRY PERMITTED
                </h1>
                <p className="text-xs text-emerald-100/90 mt-1">
                  Authorized TreFood Campus Vendor Delivery Partner.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-rose-700 via-red-800 to-rose-900 p-5 text-white shadow-xl shadow-rose-900/40 border border-rose-400/40">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shrink-0 shadow-inner">
                <ShieldAlert className="h-9 w-9 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-rose-200">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  Status: {partner.status}
                </div>
                <h1 className="text-xl font-extrabold tracking-tight mt-0.5">
                  ACCESS DENIED
                </h1>
                <p className="text-xs text-rose-100/90 mt-1">
                  This delivery pass is expired, inactive, or revoked. Do not permit campus entry.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Anti-Screenshot Live Real-Time Clock */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="text-[11px] font-medium text-slate-400">
              Live Security Clock (IST)
            </div>
          </div>
          <div className="flex items-baseline gap-2 font-mono font-bold text-slate-100">
            <span className="text-sm text-emerald-400">{currentTime || "Loading..."}</span>
            <span className="text-[11px] text-slate-400">{currentDate}</span>
          </div>
        </div>

        {/* Delivery Partner Details Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-4">
            {partner.photoUrl ? (
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden border-2 border-orange-500 shrink-0 shadow-md">
                <Image
                  src={partner.photoUrl}
                  alt={partner.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                <UserIcon className="h-10 w-10" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Delivery Partner
              </div>
              <h2 className="text-lg font-bold text-white truncate">
                {partner.name}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-orange-400 font-bold border border-slate-700">
                  {partner.badgeId}
                </span>
                {partner.vehicleNumber ? (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                    <Truck className="h-3 w-3 text-slate-400" />
                    {partner.vehicleNumber}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-3 space-y-2.5 text-xs">
            {/* Associated Vendor */}
            <div className="flex items-start justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Authorized Vendor
              </span>
              <span className="font-semibold text-white text-right">
                {partner.restaurantName}
              </span>
            </div>

            {/* Campus */}
            <div className="flex items-start justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Target Campus
              </span>
              <span className="font-semibold text-slate-200 text-right">
                {campus?.name || partner.campusName}
              </span>
            </div>

            {/* Allowed Gates */}
            <div className="flex items-start justify-between">
              <span className="text-slate-400">Gate Access</span>
              <span className="font-medium text-emerald-400 text-right">
                {partner.allowedGates.join(", ")}
              </span>
            </div>

            {/* Pass Validity */}
            <div className="flex items-start justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Valid Until
              </span>
              <span className="font-mono text-slate-300 text-right">
                {formattedExpiry}
              </span>
            </div>
          </div>
        </div>

        {/* Security Guard Actions */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            Guard Actions / Dispute Resolution
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Call Vendor */}
            {restaurant?.phone || partner.phone ? (
              <a
                href={`tel:${restaurant?.phone || partner.phone}`}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-850 active:scale-98 transition border border-slate-700 text-xs font-medium text-slate-200"
              >
                <Phone className="h-4 w-4 text-emerald-400" />
                Call Vendor
              </a>
            ) : null}

            {/* Campus Security Helpline */}
            <a
              href="tel:1800123456"
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-850 active:scale-98 transition border border-slate-700 text-xs font-medium text-slate-200"
            >
              <ShieldAlert className="h-4 w-4 text-orange-400" />
              TreFood Ops Desk
            </a>
          </div>
        </div>
      </div>

      {/* Footer Branding & Watermark */}
      <div className="pt-6 pb-2 text-center text-[11px] text-slate-400 border-t border-slate-800/80 mt-6">
        <p>Official Digital Pass issued by TreFood Technologies Pvt. Ltd.</p>
        <p className="text-slate-400 mt-0.5">
          Scan verified securely on TreFood Core Gateway.
        </p>
      </div>
    </div>
  );
}
