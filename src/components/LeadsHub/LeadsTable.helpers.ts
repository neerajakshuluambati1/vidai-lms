import type {
  RawLead,
  ApiErrorShape,
  ProcessedLead,
  Quality,
} from "./LeadsTable.types";

import { VALID_TASK_TYPES } from "./LeadsTable.types";;

// ====================== Error extractor ======================
export const extractErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as ApiErrorShape;
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
};

// ====================== Phone normalizer ======================
export const normalizePhone = (phone: string | undefined): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly && /^0+$/.test(digitsOnly)) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
  return `+${cleaned}`;
};

export const hasUsablePhone = (phone: string | null | undefined): boolean => {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length > 0 && !/^0+$/.test(digitsOnly);
};

// ====================== Lead field formatters ======================
export const deriveQuality = (lead: RawLead): "Hot" | "Warm" | "Cold" => {
  const createdAt = lead.created_at ?? null;

  if (!createdAt) return "Cold";

  const createdDate = new Date(createdAt);
  if (isNaN(createdDate.getTime())) return "Cold";

  const diffDays =
    (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 7)  return "Hot";
  if (diffDays < 30) return "Warm";
  return "Cold";
};

export const formatLeadId = (
  id: string | number | null | undefined,
): string => {
  const safeId = id == null ? "" : String(id);
  if (!safeId) return "#LN-000";

  if (safeId.match(/^#?LN-\d+$/i))
    return safeId.startsWith("#") ? safeId : `#${safeId}`;
  const lnMatch = safeId.match(/#?LN-(\d+)/i);
  if (lnMatch) return `#LN-${lnMatch[1]}`;
  const numMatch = safeId.match(/\d+/);
  if (numMatch) return `#LN-${numMatch[0]}`;
  const hash = safeId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `#LN-${(hash % 900) + 100}`;
};

export const formatStatus = (status: string): string => {
  if (!status) return "New";
  const lower = status.toLowerCase().trim();
  const map: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    converted: "Converted",
    "follow up": "Follow Up",
    "follow-up": "Follow Up",
    "follow-ups": "Follow Up",
    follow_up: "Follow Up",
    appointment: "Appointment",
    lost: "Lost",
    "cycle conversion": "Cycle Conversion",
    cycle_conversion: "Cycle Conversion",
  };
  return map[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
};

export const formatTaskStatus = (
  nextActionStatus: string | null | undefined,
  taskType: string | null | undefined,
): string => {
  if (taskType === "Book Appointment") return "Done";
  const s = (nextActionStatus || "").toLowerCase();
  if (s === "completed") return "Done";
  if (s === "pending") return "To Do";
  return "";
};

export const formatTaskType = (raw: string | null | undefined): string => {
  if (!raw || raw.trim() === "") return "";
  const trimmed = raw.trim();
  if (VALID_TASK_TYPES.includes(trimmed)) return trimmed;
  const found = VALID_TASK_TYPES.find(
    (p) => p.toLowerCase() === trimmed.toLowerCase(),
  );
  return found ?? trimmed;
};

const extractStageFromDescription = (
  description: string | null | undefined,
): string => {
  if (!description) return "";
  const match = description.match(/(?:^|\|)\s*Stage:\s*([^|]+)/i);
  return match?.[1]?.trim() ?? "";
};

// ====================== action_status → display value ======================
// Backend stores : "to_do" | "in_progress" | "completed" | null | ""
// UI displays    : "To Do" | "In Progress"  | "Completed" | ""
//
// "to_do"  → "To Do"   ← exact label, never "Pending"
// null/""  → ""        ← table renders "—", no default injected
export const mapActionStatus = (
  raw: string | null | undefined,
): "To Do" | "In Progress" | "Completed" | "" => {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "to_do")       return "To Do";
  if (v === "in_progress") return "In Progress";
  if (v === "completed")   return "Completed";
  // Legacy display-value strings from older records
  if (v === "to do")       return "To Do";
  if (v === "in progress") return "In Progress";
  if (v === "pending")     return "To Do"; // old records used "pending" → map to To Do
  return "";                               // not set → caller decides display
};

// ====================== Lead processor ======================
export const processLead = (lead: RawLead): ProcessedLead => {
  const stageTaskType = extractStageFromDescription(
    lead.next_action_description,
  );
  const stageName =
    typeof lead.stage_name === "string" ? lead.stage_name.trim() : "";
  const stageStatus =
    stageName ||
    (typeof lead.status === "string" ? lead.status.trim() : "") ||
    (typeof lead.lead_status === "string" ? lead.lead_status.trim() : "") ||
    stageTaskType;
  const rawTaskType =
    lead.next_action_type ||
    lead.task_type ||
    lead.nextActionType ||
    lead.taskType ||
    lead.action_type ||
    stageTaskType ||
    "";
  const taskType = formatTaskType(rawTaskType);

  // ── Task status: action_status is the ONLY source of truth ────────────────
  // next_action_status stores pipeline stage names (e.g. "follow up"),
  // NOT task completion state — never fall back to it.
  // null/empty action_status → "" so the table shows "—" instead of a
  // misleading default label.
  const taskStatus = mapActionStatus(lead.action_status);

  return {
    ...lead,
    assigned: lead.assigned_to_name || "Unassigned",
    status: formatStatus(stageStatus || "New"),
    lead_status: stageStatus || "New",
    quality:
      (lead as unknown as { quality?: Quality }).quality ||
      lead.quality ||
      "Cold",
    score: lead.score ?? 0,
    taskType,
    taskStatus,
    displayId: formatLeadId(lead.id),
    initials: (lead.full_name || "?").charAt(0).toUpperCase(),
  };
};