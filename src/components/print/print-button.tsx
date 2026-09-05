"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff5414] hover:bg-[#e0450b] active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition cursor-pointer"
    >
      <Printer className="w-4 h-4" />
      Print ID Card
    </button>
  );
}
