"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Pencil, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteCampus, toggleCampusActive, updateCampus } from "@/server/actions/admin";

interface EditCampusDialogProps {
  campus: {
    _id: string;
    slug: string;
    name: string;
    city: string;
    timezone: string;
    center: { lat: number; lng: number };
    isActive: boolean;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage?: boolean;
}

export function EditCampusDialog({
  campus,
  open,
  onOpenChange,
  canManage = true,
}: EditCampusDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState(campus.name);
  const [city, setCity] = useState(campus.city);
  const [timezone, setTimezone] = useState(campus.timezone);
  const [lat, setLat] = useState(String(campus.center.lat));
  const [lng, setLng] = useState(String(campus.center.lng));
  const [isActive, setIsActive] = useState(campus.isActive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !city.trim()) {
      toast.error("Please enter campus name and city.");
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
      const result = await updateCampus({
        campusId: campus._id,
        name: name.trim(),
        city: city.trim(),
        timezone: timezone.trim() || "Asia/Kolkata",
        lat: parsedLat,
        lng: parsedLng,
        isActive,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to update campus.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${campus.name}? This will remove the campus and its premises. If there are restaurants or orders, deletion will be safely rejected.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteCampus({ campusId: campus._id });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete campus.");
    } finally {
      setDeleting(false);
    }
  };

  if (!canManage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-surface-raised text-bone">
              <Pencil className="size-4" />
            </span>
            <div>
              <DialogTitle>Edit Campus: {campus.name}</DialogTitle>
              <DialogDescription>
                Update location details, map center coordinates, or active status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-campus-name">Campus Name *</Label>
                <Input
                  id="edit-campus-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-campus-city">City *</Label>
                <Input
                  id="edit-campus-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={campus.slug} disabled className="bg-surface-raised opacity-70" />
                <p className="text-[11px] text-muted">URL: /c/{campus.slug}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-campus-timezone">Timezone</Label>
                <Input
                  id="edit-campus-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Asia/Kolkata"
                />
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface-raised/40 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-bone">
                <MapPin className="size-3.5 text-saffron" />
                <span>Center Map Coordinates</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label htmlFor="edit-campus-lat" className="text-xs">Latitude</Label>
                  <Input
                    id="edit-campus-lat"
                    type="number"
                    step="0.000001"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-campus-lng" className="text-xs">Longitude</Label>
                  <Input
                    id="edit-campus-lng"
                    type="number"
                    step="0.000001"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <div>
                <p className="text-sm font-medium text-bone">Campus Live / Active</p>
                <p className="text-xs text-muted">
                  When turned off, students cannot browse or place orders on this campus.
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Campus active status"
              />
            </div>
          </DialogBody>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={submitting || deleting}
              onClick={handleDelete}
              className="text-chili hover:bg-chili-wash hover:text-chili mr-auto"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              <span>Delete</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={submitting || deleting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || deleting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

