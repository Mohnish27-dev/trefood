"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Phone,
  PhoneCall,
  Search,
  ShieldAlert,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";

import { formatINR } from "@/lib/money";
import {
  assignTeammateAction,
  reopenIssueAction,
  resolveIssueAction,
} from "@/server/actions/issues";
import type { IssueCategory, IssueDeskItem, IssueDeskSnapshot } from "@/server/services/issues";
import type { Campus } from "@/types/campus";
import { toast } from "sonner";

export function IssueDeskDashboard({
  initialSnapshot,
  campuses,
}: {
  initialSnapshot: IssueDeskSnapshot;
  campuses: Campus[];
}) {
  const [items, setItems] = useState<IssueDeskItem[]>(initialSnapshot.items);
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | IssueCategory>("ALL");
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [selectedCampus, setSelectedCampus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dialog / Modal state
  const [assignModalItem, setAssignModalItem] = useState<IssueDeskItem | null>(null);
  const [teammateInput, setTeammateInput] = useState<string>("");

  const [resolveModalItem, setResolveModalItem] = useState<IssueDeskItem | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState<string>("");

  const [contactModalItem, setContactModalItem] = useState<{
    item: IssueDeskItem;
    target: "VENDOR" | "CUSTOMER";
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  // Filtered items
  const filteredItems = items.filter((item) => {
    if (statusFilter === "open" && item.isResolved) return false;
    if (statusFilter === "resolved" && !item.isResolved) return false;

    if (selectedCategory !== "ALL" && item.issueCategory !== selectedCategory) return false;
    if (selectedCampus !== "all" && item.campusId !== selectedCampus) return false;

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      const match =
        item.orderNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.customerPhone.toLowerCase().includes(q) ||
        item.restaurantName.toLowerCase().includes(q) ||
        (item.assignedTeammate && item.assignedTeammate.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const openCount = items.filter((i) => !i.isResolved).length;
  const rejectedCount = items.filter((i) => !i.isResolved && i.issueCategory === "REJECTED").length;
  const vendorNotAcceptedCount = items.filter(
    (i) => !i.isResolved && i.issueCategory === "VENDOR_NOT_ACCEPTED",
  ).length;
  const delayedCount = items.filter((i) => !i.isResolved && i.issueCategory === "DELAYED").length;
  const resolvedCount = items.filter((i) => i.isResolved).length;

  const handleAssignTeammate = () => {
    if (!assignModalItem) return;
    startTransition(async () => {
      const res = await assignTeammateAction({
        orderId: assignModalItem.orderId,
        teammateName: teammateInput.trim() || null,
      });

      if (res.status === "ok") {
        toast.success(res.message);
        setItems((prev) =>
          prev.map((i) =>
            i.orderId === assignModalItem.orderId
              ? { ...i, assignedTeammate: teammateInput.trim() || null }
              : i,
          ),
        );
        setAssignModalItem(null);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleResolveIssue = () => {
    if (!resolveModalItem) return;
    startTransition(async () => {
      const res = await resolveIssueAction({
        orderId: resolveModalItem.orderId,
        resolutionNote: resolutionNoteInput.trim() || "Issue resolved by admin",
      });

      if (res.status === "ok") {
        toast.success(res.message);
        setItems((prev) =>
          prev.map((i) =>
            i.orderId === resolveModalItem.orderId
              ? {
                  ...i,
                  isResolved: true,
                  resolvedAt: new Date().toISOString(),
                  resolutionNote: resolutionNoteInput.trim() || "Issue resolved by admin",
                }
              : i,
          ),
        );
        setResolveModalItem(null);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleReopenIssue = (item: IssueDeskItem) => {
    startTransition(async () => {
      const res = await reopenIssueAction({ orderId: item.orderId });
      if (res.status === "ok") {
        toast.success(res.message);
        setItems((prev) =>
          prev.map((i) =>
            i.orderId === item.orderId
              ? { ...i, isResolved: false, resolvedAt: null, resolutionNote: null }
              : i,
          ),
        );
      } else {
        toast.error(res.message);
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard (${text})`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-bone">Issue Desk</h1>
          <p className="text-sm text-muted">
            Monitor and resolve operational exceptions: rejected, delayed, and unaccepted orders.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <button
          onClick={() => {
            setStatusFilter("open");
            setSelectedCategory("ALL");
          }}
          className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
            statusFilter === "open" && selectedCategory === "ALL"
              ? "border-saffron bg-saffron/10"
              : "border-line bg-surface/50 hover:bg-surface"
          }`}
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Open Issues</span>
          <span className="mt-2 text-2xl font-bold text-bone">{openCount}</span>
        </button>

        <button
          onClick={() => {
            setStatusFilter("open");
            setSelectedCategory("REJECTED");
          }}
          className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
            statusFilter === "open" && selectedCategory === "REJECTED"
              ? "border-red-500 bg-red-500/10"
              : "border-line bg-surface/50 hover:bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">Rejected</span>
            <XCircle className="size-4 text-red-400" />
          </div>
          <span className="mt-2 text-2xl font-bold text-red-400">{rejectedCount}</span>
        </button>

        <button
          onClick={() => {
            setStatusFilter("open");
            setSelectedCategory("VENDOR_NOT_ACCEPTED");
          }}
          className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
            statusFilter === "open" && selectedCategory === "VENDOR_NOT_ACCEPTED"
              ? "border-amber-500 bg-amber-500/10"
              : "border-line bg-surface/50 hover:bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">Not Accepted</span>
            <AlertTriangle className="size-4 text-amber-400" />
          </div>
          <span className="mt-2 text-2xl font-bold text-amber-400">{vendorNotAcceptedCount}</span>
        </button>

        <button
          onClick={() => {
            setStatusFilter("open");
            setSelectedCategory("DELAYED");
          }}
          className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
            statusFilter === "open" && selectedCategory === "DELAYED"
              ? "border-blue-500 bg-blue-500/10"
              : "border-line bg-surface/50 hover:bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">Delayed</span>
            <Clock className="size-4 text-blue-400" />
          </div>
          <span className="mt-2 text-2xl font-bold text-blue-400">{delayedCount}</span>
        </button>

        <button
          onClick={() => {
            setStatusFilter("resolved");
            setSelectedCategory("ALL");
          }}
          className={`col-span-2 flex flex-col justify-between rounded-xl border p-4 text-left transition sm:col-span-4 lg:col-span-1 ${
            statusFilter === "resolved"
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-line bg-surface/50 hover:bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">Resolved</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <span className="mt-2 text-2xl font-bold text-emerald-400">{resolvedCount}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="inline-flex rounded-lg border border-line bg-surface p-1">
            <button
              onClick={() => setStatusFilter("open")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                statusFilter === "open"
                  ? "bg-surface-raised text-bone shadow-sm"
                  : "text-muted hover:text-bone"
              }`}
            >
              Open ({openCount})
            </button>
            <button
              onClick={() => setStatusFilter("resolved")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                statusFilter === "resolved"
                  ? "bg-surface-raised text-bone shadow-sm"
                  : "text-muted hover:text-bone"
              }`}
            >
              Resolved ({resolvedCount})
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                statusFilter === "all"
                  ? "bg-surface-raised text-bone shadow-sm"
                  : "text-muted hover:text-bone"
              }`}
            >
              All
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1">
            {(["ALL", "REJECTED", "VENDOR_NOT_ACCEPTED", "DELAYED"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  selectedCategory === cat
                    ? "bg-saffron text-night"
                    : "bg-surface text-muted hover:bg-surface-raised hover:text-bone"
                }`}
              >
                {cat === "ALL"
                  ? "All Categories"
                  : cat === "REJECTED"
                    ? "Rejected"
                    : cat === "VENDOR_NOT_ACCEPTED"
                      ? "Unaccepted"
                      : "Delayed"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Campus Selector */}
          {campuses.length > 1 && (
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs text-bone focus:outline-none focus:ring-1 focus:ring-saffron"
            >
              <option value="all">All Campuses</option>
              {campuses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-faint" />
            <input
              type="text"
              placeholder="Search order #, name, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-xs text-bone placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-saffron"
            />
          </div>
        </div>
      </div>

      {/* Issues List */}
      {filteredItems.length === 0 ? (
        <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/20 p-8 text-center">
          <ShieldAlert className="size-10 text-faint" />
          <p className="mt-3 text-base font-semibold text-bone">No issues found</p>
          <p className="mt-1 text-xs text-muted">
            {statusFilter === "open"
              ? "Great job! All operational issues are resolved."
              : "No orders match the selected filters."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isRejected = item.issueCategory === "REJECTED";
            const isUnaccepted = item.issueCategory === "VENDOR_NOT_ACCEPTED";
            const isDelayed = item.issueCategory === "DELAYED";

            return (
              <div
                key={item.orderId}
                className={`relative flex flex-col justify-between rounded-2xl border p-4 transition ${
                  item.isResolved
                    ? "border-line bg-surface/30 opacity-75"
                    : isRejected
                      ? "border-red-500/30 bg-red-950/10 hover:border-red-500/50"
                      : isUnaccepted
                        ? "border-amber-500/30 bg-amber-950/10 hover:border-amber-500/50"
                        : "border-blue-500/30 bg-blue-950/10 hover:border-blue-500/50"
                }`}
              >
                {/* Header Badge & Order # */}
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-bone">{item.orderNumber}</span>
                      <span className="text-xs text-muted">· {item.zoneName}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.isResolved ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="size-3" /> Resolved
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                          <XCircle className="size-3" /> Rejected
                        </span>
                      ) : isUnaccepted ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                          <AlertTriangle className="size-3" /> Unaccepted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-400">
                          <Clock className="size-3" /> Delayed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Issue Reason / Banner */}
                  <div className="mt-3 rounded-lg bg-surface/60 p-2.5 text-xs text-bone">
                    <p className="font-medium text-bone">{item.issueReason}</p>
                    {item.cancellationReason && (
                      <p className="mt-1 text-[11px] text-red-300">
                        Reason: {item.cancellationReason}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-faint">
                      {item.minutesInState} mins in state · Total: {formatINR(item.grandTotalPaise)}
                    </p>
                  </div>

                  {/* Customer & Vendor Details */}
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-md bg-surface/40 p-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-faint">Vendor</p>
                        <p className="truncate font-semibold text-bone">{item.restaurantName}</p>
                        <p className="text-[11px] text-muted">{item.restaurantPhone}</p>
                      </div>
                      <button
                        onClick={() =>
                          setContactModalItem({ item, target: "VENDOR" })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-bone hover:bg-surface-raised"
                      >
                        <Phone className="size-3 text-saffron" /> Contact
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-md bg-surface/40 p-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-faint">Customer</p>
                        <p className="truncate font-semibold text-bone">{item.customerName}</p>
                        <p className="text-[11px] text-muted">{item.customerPhone}</p>
                      </div>
                      <button
                        onClick={() =>
                          setContactModalItem({ item, target: "CUSTOMER" })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-bone hover:bg-surface-raised"
                      >
                        <Phone className="size-3 text-saffron" /> Contact
                      </button>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="mt-3 text-[11px] text-muted">
                    <span className="font-medium text-bone">Items: </span>
                    <span className="line-clamp-2">{item.itemsSummary}</span>
                  </div>

                  {/* Assigned Teammate Banner */}
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-line/60 bg-surface/30 px-2.5 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="size-3.5 text-saffron" />
                      <span className="text-muted">Assigned: </span>
                      <span className="font-semibold text-bone">
                        {item.assignedTeammate || "Unassigned"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setAssignModalItem(item);
                        setTeammateInput(item.assignedTeammate || "");
                      }}
                      className="text-[11px] font-medium text-saffron hover:underline"
                    >
                      {item.assignedTeammate ? "Change" : "Assign"}
                    </button>
                  </div>

                  {/* Resolution note if resolved */}
                  {item.isResolved && item.resolutionNote && (
                    <div className="mt-2 rounded-lg bg-emerald-950/20 p-2 text-[11px] text-emerald-300">
                      <span className="font-semibold">Resolution: </span>
                      {item.resolutionNote}
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-4 flex items-center gap-2 border-t border-line/60 pt-3">
                  {!item.isResolved ? (
                    <button
                      onClick={() => {
                        setResolveModalItem(item);
                        setResolutionNoteInput("");
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-saffron px-3 py-2 text-xs font-semibold text-night transition hover:bg-saffron/90"
                    >
                      <CheckCircle2 className="size-4" /> Mark as Resolved
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReopenIssue(item)}
                      disabled={isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-bone transition hover:bg-surface-raised"
                    >
                      Reopen Issue
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Teammate Modal */}
      {assignModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-bone">Assign Teammate</h3>
            <p className="mt-1 text-xs text-muted">
              Assign a support team member to take ownership of issue on order{" "}
              <span className="font-bold text-bone">{assignModalItem.orderNumber}</span>.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-faint">Teammate Name / Handle</label>
              <input
                type="text"
                placeholder="e.g. Alex (Support Lead)"
                value={teammateInput}
                onChange={(e) => setTeammateInput(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-sm text-bone focus:outline-none focus:ring-1 focus:ring-saffron"
                autoFocus
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setAssignModalItem(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-muted hover:text-bone"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTeammate}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-saffron px-4 py-2 text-xs font-semibold text-night hover:bg-saffron/90"
              >
                <UserPlus className="size-4" /> Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Resolved Modal */}
      {resolveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-bone">Mark Issue as Resolved</h3>
            <p className="mt-1 text-xs text-muted">
              Record resolution details for order{" "}
              <span className="font-bold text-bone">{resolveModalItem.orderNumber}</span>.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-faint">Resolution Notes</label>
              <textarea
                rows={3}
                placeholder="e.g. Contacted vendor to re-cook, customer informed and agreed."
                value={resolutionNoteInput}
                onChange={(e) => setResolutionNoteInput(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-raised p-3 text-sm text-bone focus:outline-none focus:ring-1 focus:ring-saffron"
                autoFocus
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setResolveModalItem(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-muted hover:text-bone"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveIssue}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-saffron px-4 py-2 text-xs font-semibold text-night hover:bg-saffron/90"
              >
                <CheckCircle2 className="size-4" /> Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Options Modal */}
      {contactModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-bone">
                Contact {contactModalItem.target === "VENDOR" ? "Vendor" : "Customer"}
              </h3>
              <button
                onClick={() => setContactModalItem(null)}
                className="text-muted hover:text-bone"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-surface-raised p-4">
              <p className="text-xs text-faint">
                {contactModalItem.target === "VENDOR" ? "Restaurant Name" : "Customer Name"}
              </p>
              <p className="text-base font-bold text-bone">
                {contactModalItem.target === "VENDOR"
                  ? contactModalItem.item.restaurantName
                  : contactModalItem.item.customerName}
              </p>

              <p className="mt-3 text-xs text-faint">Phone Number</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-saffron">
                  {contactModalItem.target === "VENDOR"
                    ? contactModalItem.item.restaurantPhone
                    : contactModalItem.item.customerPhone}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      contactModalItem.target === "VENDOR"
                        ? contactModalItem.item.restaurantPhone
                        : contactModalItem.item.customerPhone,
                      contactModalItem.target === "VENDOR" ? "Vendor phone" : "Customer phone",
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-bone hover:bg-surface-raised"
                >
                  <Copy className="size-3.5" /> Copy
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <a
                href={`tel:${
                  contactModalItem.target === "VENDOR"
                    ? contactModalItem.item.restaurantPhone
                    : contactModalItem.item.customerPhone
                }`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-xs font-semibold text-night hover:bg-saffron/90"
              >
                <PhoneCall className="size-4" /> Call Phone
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
