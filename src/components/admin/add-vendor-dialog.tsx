"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Share2,
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
  triggerLabel?: string;
}

export function AddVendorDialog({
  campuses,
  triggerLabel = "Add Restaurant",
}: AddVendorDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "campus_nitp");
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

  // Newly Created Credentials State (for instant sharing)
  const [createdCredentials, setCreatedCredentials] = useState<{
    restaurantName: string;
    email: string;
    password?: string;
  } | null>(null);

  const resetForm = () => {
    setOwnerName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRestaurantName("");
    setCampusId(campuses[0]?.id ?? "campus_nitp");
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
    setShowPassword(false);
    setCreatedCredentials(null);
  };

  const handleGeneratePassword = () => {
    const prefixes = ["Taste", "Spice", "Trefood", "Chef", "Kitchen", "Zaika", "Bhojan"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(100 + Math.random() * 900);
    const generated = `${prefix}@${randomNum}`;
    setPassword(generated);
    setShowPassword(true);
    toast.info("Generated a secure password");
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handleCopyFullCredentials = async () => {
    if (!createdCredentials) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://trefood.in";
    const loginUrl = `${origin}/signin?tab=vendor`;

    const message = `🍽️ *TREFOOD Vendor Portal Credentials*
━━━━━━━━━━━━━━━━━━━━━
🏪 *Restaurant:* ${createdCredentials.restaurantName}
🔗 *Vendor Login URL:* ${loginUrl}
📧 *Login Email:* ${createdCredentials.email}
🔑 *Password:* ${createdCredentials.password || "Set by Admin"}
━━━━━━━━━━━━━━━━━━━━━
Sign in to view live orders, prepare KOTs, update menu availability, and manage daily operations.`;

    await handleCopy(message, "Full credentials message");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCampusId = campusId || campuses[0]?.id || "campus_nitp";

    setSubmitting(true);

    try {
      const result = await createVendorAccount({
        ownerName,
        email,
        phone,
        password,
        restaurantName,
        campusId: effectiveCampusId,
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

      setCreatedCredentials({
        restaurantName: result.credentials?.restaurantName || restaurantName,
        email: result.credentials?.email || email,
        password: result.credentials?.password || password,
      });
      toast.success(result.message);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create vendor account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="primary" size="md" className="gap-2 shadow-sm font-medium">
          <Plus className="size-4" />
          <Store className="size-4" />
          <span>{triggerLabel}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {createdCredentials ? (
          /* ── Step 2: Credentials Share Screen ──────────────────────────── */
          <div className="space-y-6 py-2">
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-mint/15 text-mint mb-2">
                <CheckCircle2 className="size-7" />
              </div>
              <DialogTitle className="text-center text-xl text-bone">
                Restaurant &amp; Vendor Account Created!
              </DialogTitle>
              <DialogDescription className="text-center text-muted">
                The restaurant has been onboarded and the vendor account is ready.
                Give these credentials to the vendor so they can sign in to manage their dashboard.
              </DialogDescription>
            </DialogHeader>

            {/* Credentials Card */}
            <div className="rounded-2xl border border-line bg-surface-raised/80 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <Store className="size-4 text-saffron" />
                  <span className="text-xs uppercase tracking-wider text-faint">Restaurant</span>
                </div>
                <span className="font-display font-semibold text-bone">
                  {createdCredentials.restaurantName}
                </span>
              </div>

              {/* Login URL */}
              <div className="flex items-center justify-between text-xs border-b border-line pb-3">
                <span className="text-muted flex items-center gap-1.5">
                  <ExternalLink className="size-3.5 text-faint" />
                  Vendor Sign-in URL
                </span>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-surface px-2 py-1 font-mono text-[11px] text-saffron">
                    /signin?tab=vendor
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `${typeof window !== "undefined" ? window.location.origin : ""}/signin?tab=vendor`,
                        "Sign-in link",
                      )
                    }
                    className="p-1 text-muted hover:text-bone transition-colors"
                    title="Copy sign-in link"
                  >
                    {copiedField === "Sign-in link" ? (
                      <Check className="size-3.5 text-mint" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Login Email */}
              <div className="flex items-center justify-between text-xs border-b border-line pb-3">
                <span className="text-muted flex items-center gap-1.5">
                  <User className="size-3.5 text-faint" />
                  Login Email ID
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-bone">
                    {createdCredentials.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdCredentials.email, "Email")}
                    className="p-1 text-muted hover:text-bone transition-colors"
                    title="Copy email"
                  >
                    {copiedField === "Email" ? (
                      <Check className="size-3.5 text-mint" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-faint" />
                  Login Password
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-bone">
                    {showPassword ? createdCredentials.password : "••••••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-muted hover:text-bone transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(createdCredentials.password || "", "Password")
                    }
                    className="p-1 text-muted hover:text-bone transition-colors"
                    title="Copy password"
                  >
                    {copiedField === "Password" ? (
                      <Check className="size-3.5 text-mint" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleCopyFullCredentials}
                className="w-full gap-2 text-sm shadow-md"
              >
                {copiedField === "Full credentials message" ? (
                  <>
                    <Check className="size-4" />
                    <span>Credentials Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="size-4" />
                    <span>Copy Full Credentials Message (WhatsApp / SMS)</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
                className="w-full text-muted hover:text-bone"
              >
                Done &amp; Close
              </Button>
            </div>
          </div>
        ) : (
          /* ── Step 1: Input Form ────────────────────────────────────────── */
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="size-5 text-saffron" />
                Add Restaurant &amp; Vendor Account
              </DialogTitle>
              <DialogDescription>
                Create the restaurant and assign vendor login credentials. The vendor can
                immediately sign in using their email and password to operate their dashboard.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-6 pt-2">
              {/* ── Section 1: Credentials ─────────────────────────────── */}
              <div className="space-y-3 rounded-2xl border border-saffron/20 bg-saffron-wash/30 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-saffron">
                  <KeyRound className="size-3.5" />
                  <span>1. Vendor Account &amp; Login Credentials</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="vendor-email">Vendor Login Email ID *</Label>
                    <Input
                      id="vendor-email"
                      required
                      type="email"
                      placeholder="e.g. royalbihar@canteen.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Vendor will use this email to sign in to their dashboard.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="vendor-password">Vendor Login Password *</Label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] font-medium text-saffron hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="size-3" />
                        Generate
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="vendor-password"
                        required
                        type={showPassword ? "text" : "password"}
                        minLength={6}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-bone"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      Give this password to the vendor. You can reset it anytime.
                    </p>
                  </div>

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
                    <Label htmlFor="vendor-phone">Contact Phone Number *</Label>
                    <Input
                      id="vendor-phone"
                      required
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* ── Section 2: Restaurant Profile ──────────────────────── */}
              <div className="space-y-3 pt-2 border-t border-line">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-bone">
                  <Building2 className="size-3.5 text-saffron" />
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
                  className="flex w-full items-center justify-between py-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted hover:text-bone cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Landmark className="size-3.5 text-muted" />
                    3. KYC &amp; Bank Details (Optional)
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
                {submitting ? "Creating Restaurant..." : "Create Restaurant & Vendor"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
