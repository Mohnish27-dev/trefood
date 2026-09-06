"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import { Input, Label } from "@/components/ui/input";
import { updateProfile } from "@/server/actions/account";

/**
 * Edit profile.
 *
 * A dialog rather than a screen, because there are two fields and neither one
 * needs thinking about. Email is shown and disabled instead of hidden: a
 * student who cannot find their email in here will look for it in support.
 *
 * The phone is the number a vendor rings when they cannot find you at the
 * gate, so the copy says that rather than "contact details".
 */
export function EditProfileDialog({
  name: initialName,
  email,
  phone: initialPhone,
}: {
  name: string;
  email: string;
  phone: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedPhone = phone.replace(/\s/g, "");
  const phoneValid = trimmedPhone === "" || /^\+?[0-9]{10,15}$/.test(trimmedPhone);
  const nameValid = name.trim().length >= 2;
  const canSave = nameValid && phoneValid && !saving;

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateProfile({ name: name.trim(), phone });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("That did not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // Re-open always starts from what the server currently holds, so a cancelled
  // edit does not linger in the fields.
  const onOpenChange = (next: boolean): void => {
    if (next) {
      setName(initialName);
      setPhone(initialPhone ?? "");
      setError(null);
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-saffron/30 bg-saffron-wash px-3 text-xs font-semibold text-saffron transition-colors hover:bg-saffron/20 active:scale-95"
        >
          <Pencil className="size-3.5" />
          Edit
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Your name and number are what the restaurant sees on the order and what they
            ring if they cannot find you at the gate.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={60}
              aria-invalid={name.length > 0 && !nameValid}
            />
          </div>

          <div>
            <Label htmlFor="profile-phone">Phone number</Label>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              aria-invalid={phone.length > 0 && !phoneValid}
            />
            {phone.length > 0 && !phoneValid ? (
              <p className="mt-1.5 text-xs text-chili">Enter a valid phone number.</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={email} disabled readOnly />
            <p className="mt-1.5 text-xs text-faint">
              Your email is how you sign in, so it cannot be changed here. Contact support
              if it is wrong.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-chili">
              {error}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!canSave}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Saving" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
