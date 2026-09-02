"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Loader2,
  Plus,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
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
import { createVendorAccount } from "@/server/actions/admin";

export interface CampusOption {
  id: string;
  name: string;
  city: string;
}

interface AddVendorDialogProps {
  campuses: CampusOption[];
}

export function AddVendorDialog({ campuses }: AddVendorDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form State
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [cuisines, setCuisines] = useState("North Indian, Chinese, Snacks");
  const [description, setDescription] = useState("");
  const [packagingFeeRupees, setPackagingFeeRupees] = useState("10");
  const [minOrderRupees, setMinOrderRupees] = useState("50");
  const [prepMinutes, setPrepMinutes] = useState("15");

  // Optional Compliance & Payout
  const [fssai, setFssai] = useState("");
  const [gstin, setGstin] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upiId, setUpiId] = useState("");

  const resetForm = () => {
    setOwnerName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRestaurantName("");
    setCampusId(campuses[0]?.id ?? "");
    setCuisines("North Indian, Chinese, Snacks");
    setDescription("");
    setPackagingFeeRupees("10");
    setMinOrderRupees("50");
    setPrepMinutes("15");
    setFssai("");
    setGstin("");
    setAccountName("");
    setAccountNumber("");
    setIfsc("");
    setUpiId("");
    setShowAdvanced(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusId) {
      toast.error("Please select a campus.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createVendorAccount({
        ownerName,
        email,
        phone,
        password,
        restaurantName,
        campusId,
        cuisines,
        description: description || undefined,
        packagingFeeRupees: Number(packagingFeeRupees) || 0,
        minOrderRupees: Number(minOrderRupees) || 0,
        prepMinutes: Number(prepMinutes) || 15,
        fssai: fssai || undefined,
        gstin: gstin || undefined,
        accountName: accountName || undefined,
        accountNumber: accountNumber || undefined,
        ifsc: ifsc || undefined,
        upiId: upiId || undefined,
      });

      if (result.status === "error") {
        toast.error(result.message);
        setSubmitting(false);
        return;
      }

      toast.success(result.message);
      resetForm();
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create vendor account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="md" className="gap-2 shadow-sm">
          <Plus className="size-4" />
          Add Vendor
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="size-5 text-saffron" />
              Onboard New Vendor
            </DialogTitle>
            <DialogDescription>
              Create the vendor account and initial restaurant profile. The vendor can
              immediately sign in using their email and password.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            {/* ── Section 1: Credentials ─────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-saffron">
                <User className="size-3.5" />
                <span>1. Vendor Account & Login Credentials</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="vendor-owner-name">Owner / Manager Name *</Label>
                  <Input
                    id="vendor-owner-name"
                    required
                    placeholder="e.g. Ramesh Chandra"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="vendor-phone">Phone Number *</Label>
                  <Input
                    id="vendor-phone"
                    required
                    type="tel"
                    placeholder="e.g. +919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="vendor-email">Login Email *</Label>
                  <Input
                    id="vendor-email"
                    required
                    type="email"
                    placeholder="e.g. canteen@campus.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="vendor-password">Login Password *</Label>
                  <Input
                    id="vendor-password"
                    required
                    type="password"
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Section 2: Restaurant Profile ──────────────────────── */}
            <div className="space-y-3 pt-2 border-t border-line">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-saffron">
                <Building2 className="size-3.5" />
                <span>2. Restaurant Details</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="restaurant-name">Restaurant Name *</Label>
                  <Input
                    id="restaurant-name"
                    required
                    placeholder="e.g. NIT Night Canteen"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="restaurant-campus">Campus *</Label>
                  <select
                    id="restaurant-campus"
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    required
                    className="flex h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-bone focus-visible:border-saffron focus-visible:outline-none"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id} className="bg-surface text-bone">
                        {c.name} ({c.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="restaurant-cuisines">Cuisines (comma-separated)</Label>
                  <Input
                    id="restaurant-cuisines"
                    placeholder="e.g. North Indian, Thalis, Rolls, Fast Food"
                    value={cuisines}
                    onChange={(e) => setCuisines(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="restaurant-packaging">Packaging Fee (₹)</Label>
                  <Input
                    id="restaurant-packaging"
                    type="number"
                    min={0}
                    value={packagingFeeRupees}
                    onChange={(e) => setPackagingFeeRupees(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="restaurant-min-order">Minimum Order (₹)</Label>
                  <Input
                    id="restaurant-min-order"
                    type="number"
                    min={0}
                    value={minOrderRupees}
                    onChange={(e) => setMinOrderRupees(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="restaurant-prep">Estimated Prep Time (minutes)</Label>
                  <Input
                    id="restaurant-prep"
                    type="number"
                    min={1}
                    value={prepMinutes}
                    onChange={(e) => setPrepMinutes(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="restaurant-desc">Short Description (optional)</Label>
                  <Input
                    id="restaurant-desc"
                    placeholder="e.g. Quick hot meals and rolls cooked to order."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Section 3: Advanced KYC & Banking ──────────────────── */}
            <div className="pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center justify-between py-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted hover:text-bone"
              >
                <span className="flex items-center gap-2">
                  <Landmark className="size-3.5" />
                  3. KYC & Bank Details (Optional)
                </span>
                {showAdvanced ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>

              {showAdvanced ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="kyc-fssai">FSSAI Licence Number</Label>
                    <Input
                      id="kyc-fssai"
                      placeholder="14-digit FSSAI number"
                      value={fssai}
                      onChange={(e) => setFssai(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="kyc-gstin">GSTIN</Label>
                    <Input
                      id="kyc-gstin"
                      placeholder="15-character GSTIN"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank-acc-name">Bank Account Name</Label>
                    <Input
                      id="bank-acc-name"
                      placeholder="Name on bank passbook"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank-acc-no">Bank Account Number</Label>
                    <Input
                      id="bank-acc-no"
                      placeholder="Account number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank-ifsc">IFSC Code</Label>
                    <Input
                      id="bank-ifsc"
                      placeholder="SBIN0001234"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank-upi">UPI ID</Label>
                    <Input
                      id="bank-upi"
                      placeholder="vendor@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {submitting ? "Creating..." : "Create Vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
