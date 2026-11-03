"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCampus } from "@/server/actions/admin";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface AddCampusDialogProps {
  canManage?: boolean;
}

export function AddCampusDialog({ canManage = true }: AddCampusDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [lat, setLat] = useState("25.6206");
  const [lng, setLng] = useState("85.1721");

  // Initial Gate
  const [createInitialGate, setCreateInitialGate] = useState(true);
  const [gateName, setGateName] = useState("Main Gate / Academic Area");
  const [gateInstructions, setGateInstructions] = useState(
    "Wait at the security barrier at the main entrance.",
  );

  // Pricing & Timers
  const [deliveryFeeRupees, setDeliveryFeeRupees] = useState("15");
  const [commissionPercent, setCommissionPercent] = useState("10");
  const [transitMinutes, setTransitMinutes] = useState("8");

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched) {
      setSlug(toSlug(val));
    }
  };

  const resetForm = () => {
    setName("");
    setCity("");
    setSlug("");
    setSlugTouched(false);
    setTimezone("Asia/Kolkata");
    setLat("25.6206");
    setLng("85.1721");
    setCreateInitialGate(true);
    setGateName("Main Gate / Academic Area");
    setGateInstructions("Wait at the security barrier at the main entrance.");
    setDeliveryFeeRupees("15");
    setCommissionPercent("10");
    setTransitMinutes("8");
    setShowAdvanced(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !city.trim() || !slug.trim()) {
      toast.error("Please fill in the campus name, city, and slug.");
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      toast.error("Please enter valid latitude and longitude coordinates.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createCampus({
        name: name.trim(),
        city: city.trim(),
        slug: slug.trim(),
        timezone: timezone.trim() || "Asia/Kolkata",
        lat: parsedLat,
        lng: parsedLng,
        deliveryFeeRupees: Number(deliveryFeeRupees) || 15,
        commissionPercent: Number(commissionPercent) || 10,
        transitMinutes: Number(transitMinutes) || 8,
        initialGateName: createInitialGate ? gateName.trim() : undefined,
        initialGateInstructions: createInitialGate ? gateInstructions.trim() : undefined,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      const newCampusId = result.campusId;
      setOpen(false);
      resetForm();

      if (newCampusId) {
        router.push(`/admin/campuses/${newCampusId}/zones`);
      } else {
        router.refresh();
      }
    } catch {
      toast.error("Failed to create campus. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManage) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="size-4" />
          <span>Add Campus</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-saffron/15 text-saffron">
              <Building2 className="size-5" />
            </span>
            <div>
              <DialogTitle>Add College / Campus</DialogTitle>
              <DialogDescription>
                Expand TreFood to another college, institute, or university location.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* 1. Basic Info */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campus-name">College / Campus Name *</Label>
                <Input
                  id="campus-name"
                  placeholder="e.g. IIT Patna, BIT Mesra"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="campus-city">City *</Label>
                <Input
                  id="campus-city"
                  placeholder="e.g. Bihta, Patna, Ranchi"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Slug & Timezone */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campus-slug">URL Slug *</Label>
                <Input
                  id="campus-slug"
                  placeholder="e.g. iit-patna"
                  value={slug}
                  onChange={(e) => {
                    setSlug(toSlug(e.target.value));
                    setSlugTouched(true);
                  }}
                  required
                />
                <p className="text-[11px] text-muted">
                  Used in student URLs:{" "}
                  <code className="text-bone">/c/{slug || "slug"}</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="campus-timezone">Timezone</Label>
                <Input
                  id="campus-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Asia/Kolkata"
                />
                <p className="text-[11px] text-muted">
                  Curfews & orders compare against this clock.
                </p>
              </div>
            </div>

            {/* Coordinates */}
            <div className="rounded-xl border border-line bg-surface-raised/40 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-bone">
                <MapPin className="size-3.5 text-saffron" />
                <span>Campus Center Map Coordinates</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Initial center point for the gates map and geofence. You can adjust this anytime.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label htmlFor="campus-lat" className="text-xs">Latitude</Label>
                  <Input
                    id="campus-lat"
                    type="number"
                    step="0.000001"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="campus-lng" className="text-xs">Longitude</Label>
                  <Input
                    id="campus-lng"
                    type="number"
                    step="0.000001"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Initial Gate Option */}
            <div className="rounded-xl border border-line p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-bone flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    <span>Create 24×7 Fallback Gate</span>
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Campuses require at least one 24×7 fallback gate for late deliveries.
                  </p>
                </div>
                <Switch
                  checked={createInitialGate}
                  onCheckedChange={setCreateInitialGate}
                  aria-label="Create initial fallback gate"
                />
              </div>

              {createInitialGate && (
                <div className="space-y-2 pt-1 border-t border-line/60">
                  <div>
                    <Label htmlFor="initial-gate-name" className="text-xs">Gate / Premise Name</Label>
                    <Input
                      id="initial-gate-name"
                      value={gateName}
                      onChange={(e) => setGateName(e.target.value)}
                      placeholder="e.g. Main Gate / Academic Area"
                    />
                  </div>
                  <div>
                    <Label htmlFor="initial-gate-inst" className="text-xs">Handover Instructions</Label>
                    <Input
                      id="initial-gate-inst"
                      value={gateInstructions}
                      onChange={(e) => setGateInstructions(e.target.value)}
                      placeholder="e.g. Wait at the security post at the main gate."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between rounded-xl border border-line/60 bg-surface px-3 py-2 text-xs font-medium text-muted hover:text-bone hover:bg-surface-raised transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>Pricing & Timers (Defaults)</span>
              </span>
              {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-3 rounded-xl border border-line bg-surface-raised/30 p-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <Label htmlFor="delivery-fee" className="text-xs">Delivery Fee (₹)</Label>
                    <Input
                      id="delivery-fee"
                      type="number"
                      min="0"
                      value={deliveryFeeRupees}
                      onChange={(e) => setDeliveryFeeRupees(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="commission-rate" className="text-xs">Commission (%)</Label>
                    <Input
                      id="commission-rate"
                      type="number"
                      min="0"
                      max="30"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transit-time" className="text-xs">Transit (mins)</Label>
                    <Input
                      id="transit-time"
                      type="number"
                      min="1"
                      max="60"
                      value={transitMinutes}
                      onChange={(e) => setTransitMinutes(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-faint">
                  You can fine-tune timers, grace periods, and auto-expire rules from the Pricing page later.
                </p>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Creating Campus...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Create Campus & Open Gates</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

