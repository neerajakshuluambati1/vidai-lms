/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  LeadAPI,
  api,
  type Lead,
  type LeadDocument,
} from "../services/leads.api";
import type { RootState } from ".";
import { resolveUserRole } from "../utils/roleAccess";

// ====================== API Error Type ======================
type ApiError = {
  response?: {
    data?: {
      detail?: string;
      message?: string;
      [key: string]: unknown;
    };
  };
  message?: string;
};

type AuthLikeUser = {
  id?: number | string;
  user_id?: number | string;
  user?: {
    id?: number | string;
    user_id?: number | string;
  };
};

const toNumericId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const collectLeadIds = (lead: Lead, keys: string[]): (number | string)[] => {
  const rawLead = lead as unknown as Record<string, unknown>;
  return keys
    .map((key) => rawLead[key])
    .filter((value) => value !== null && value !== undefined)
    .map((value) => typeof value === "number" ? value : String(value));
};

const resolveCurrentUserId = (
  authUser: AuthLikeUser | null | undefined,
): number | null => {
  return (
    toNumericId(authUser?.id) ??
    toNumericId(authUser?.user_id) ??
    toNumericId(authUser?.user?.id) ??
    toNumericId(authUser?.user?.user_id) ??
    null
  );
};

const filterLeadsForRole = (
  leads: Lead[],
  role: "super_admin" | "admin" | "user" | "unknown",
  currentUserId: number | null,
): Lead[] => {
  if (role !== "user") {
    return leads;
  }

  if (!currentUserId) {
    return leads;
  }

  // Compare as both number and string for robustness
  return leads.filter((lead) => {
    const assigneeIds = collectLeadIds(lead, [
      "assigned_to_id",
      "assigned_to",
      "assignee_id",
      "owner_id",
    ]);
    return assigneeIds.some(
      (id) => id === currentUserId || id === String(currentUserId)
    );
  });
};

// ====================== Type Definitions ======================
interface LeadState {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  deletingIds: string[];
  documentsUploading: boolean;
  documentsError: string | null;
}

const initialState: LeadState = {
  leads: [],
  loading: false,
  error: null,
  deletingIds: [],
  documentsUploading: false,
  documentsError: null,
};

// ====================== Status Normalizer ======================
const normalizeStatus = (raw: string): string => {
  const map: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    appointment: "Appointment",
    "follow up": "Follow Up",
    follow_up: "Follow Up",
    "follow-up": "Follow Up",
    negotiation: "Negotiation",
    "proposal sent": "Proposal Sent",
    "contract signed": "Contract Signed",
    converted: "Converted Lead",
    "converted lead": "Converted Lead",
    lost: "Lost Lead",
    "lost lead": "Lost Lead",
    cycle_conversion: "Cycle Conversion",
    "cycle conversion": "Cycle Conversion",
  };
  return map[raw?.toLowerCase()?.trim()] ?? "New";
};

const formatDateForApi = (value: unknown): string => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const isoPrefixMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoPrefixMatch) {
    return isoPrefixMatch[1];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  return "";
};

const normalizeTreatmentInterestForUpdate = (
  value: Lead["treatment_interest"],
): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const obj = item as { id?: unknown; name?: unknown };
          if (typeof obj.id === "string") return obj.id.trim();
          if (typeof obj.id === "number") return String(obj.id);
          if (typeof obj.name === "string") return obj.name.trim();
        }
        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

// ====================== Async Thunks ======================

/** Fetch all leads */
export const fetchLeads = createAsyncThunk<
  Lead[],
  void,
  { rejectValue: string; state: RootState }
>("leads/fetchAll", async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const clinicId = state.clinic.data?.id;
    const authUser = state.auth.user as AuthLikeUser | null;
    const role = resolveUserRole(
      authUser as unknown as Record<string, unknown> | null,
    );
    const currentUserId = resolveCurrentUserId(authUser);

    if (!clinicId) {
      return rejectWithValue("Clinic not selected");
    }

    const leads = await LeadAPI.list(clinicId);
    return filterLeadsForRole(leads, role, currentUserId);
  } catch (err) {
    const error = err as ApiError;
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch leads";
    return rejectWithValue(message);
  }
});

/** Book Appointment */
export const bookAppointment = createAsyncThunk<
  { leadId: string; appointmentData: any },
  { leadId: string; payload: any; leadSnapshot?: Partial<Lead> },
  { rejectValue: string; state: { leads: LeadState } }
>(
  "leads/bookAppointment",
  async ({ leadId, payload, leadSnapshot }, { rejectWithValue, getState }) => {
    const normalizedLeadId = String(leadId).replace(/^#/, "").trim();

    const leadFromState = getState().leads.leads.find((l) => {
      const currentId = String(l.id ?? "").replace(/^#/, "").trim();
      return currentId === normalizedLeadId;
    });

    const lead = leadFromState ?? (leadSnapshot as Lead | undefined);
    if (!lead) {
      return rejectWithValue("Lead not found for appointment update");
    }

    const normalizedAppointmentDate = formatDateForApi(
      payload.appointment_date,
    );
    if (!normalizedAppointmentDate) {
      return rejectWithValue(
        "Invalid appointment date. Please select a valid date.",
      );
    }

    const apiPayload: any = {
      clinic_id: lead.clinic_id,
      department_id: lead.department_id,
      full_name: lead.full_name,
      contact_no: lead.contact_no,
      source: lead.source || "Unknown",
      treatment_interest: normalizeTreatmentInterestForUpdate(
        lead.treatment_interest,
      ),
      book_appointment: true,
      appointment_date: normalizedAppointmentDate,
      slot: payload.slot,
      is_active: lead.is_active !== false,
      partner_inquiry: lead.partner_inquiry || false,
      lead_status: "appointment",
      ...(payload.assigned_to_id && { assigned_to_id: payload.assigned_to_id }),
      ...(payload.remark && { remark: payload.remark }),
    };

    try {
      await api.put(
        `/leads/${normalizedLeadId}/update/?clinic_id=${lead.clinic_id}`,
        apiPayload,
      );
      console.log("✅ Appointment saved to server:", normalizedLeadId);
    } catch (err) {
      const error = err as ApiError;
      const message =
        error?.response?.data?.detail ||
        (error?.response?.data as any)?.non_field_errors?.[0] ||
        error?.message ||
        "Failed to book appointment";
      return rejectWithValue(message);
    }

    return { leadId, appointmentData: payload };
  },
);

/** Convert Lead */
export const convertLead = createAsyncThunk<
  string,
  string,
  { rejectValue: string; state: { leads: LeadState } }
>("leads/convert", async (leadUuid, { rejectWithValue, getState }) => {
  try {
    const lead = getState().leads.leads.find((l) => l.id === leadUuid);
    if (!lead) throw new Error("Lead not found in state");

    const normalizedAppointmentDate = formatDateForApi(lead.appointment_date);
    const shouldKeepAppointment = Boolean(
      lead.book_appointment && normalizedAppointmentDate,
    );

    await api.put(`/leads/${leadUuid}/update/?clinic_id=${lead.clinic_id}`, {
      clinic_id: lead.clinic_id,
      department_id: lead.department_id,
      full_name: lead.full_name,
      contact_no: lead.contact_no,
      source: lead.source || "Unknown",
      treatment_interest: Array.isArray(lead.treatment_interest)
        ? lead.treatment_interest.map((t: any) =>
            typeof t === "string" ? t : t.id,
          )
        : typeof lead.treatment_interest === "string"
          ? lead.treatment_interest
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      book_appointment: shouldKeepAppointment,
      appointment_date: shouldKeepAppointment
        ? normalizedAppointmentDate
        : null,
      slot: shouldKeepAppointment ? lead.slot || "" : "",
      is_active: lead.is_active !== false,
      partner_inquiry: lead.partner_inquiry || false,
      lead_status: "converted",
      next_action_status: "completed",
      next_action_description: "Lead converted to patient",
    });

    console.log("✅ Lead converted:", leadUuid);
    return leadUuid;
  } catch (err) {
    const error = err as ApiError;
    const message =
      error?.response?.data?.detail ||
      (error?.response?.data as any)?.lead_status?.[0] ||
      error?.message ||
      "Failed to convert lead";
    return rejectWithValue(message);
  }
});

/** Delete a lead (soft delete) */
export const deleteLead = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("leads/delete", async (leadId, { rejectWithValue }) => {
  try {
    await LeadAPI.delete(leadId);
    return leadId;
  } catch (err) {
    const error = err as ApiError;
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to delete lead";
    return rejectWithValue(message);
  }
});

/** Delete multiple leads */
export const deleteLeads = createAsyncThunk<
  string[],
  string[],
  { rejectValue: string }
>("leads/deleteMultiple", async (leadIds, { rejectWithValue }) => {
  try {
    await Promise.all(leadIds.map((id) => LeadAPI.delete(id)));
    return leadIds;
  } catch (err) {
    const error = err as ApiError;
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to delete leads";
    return rejectWithValue(message);
  }
});

// ====================== Document Thunks ======================

/**
 * Upload a single document file to a lead.
 * PUT /leads/{lead_id}/update/ with multipart/form-data
 */
export const uploadLeadDocument = createAsyncThunk<
  { leadId: string; updatedLead: Lead },
  { leadId: string; file: File },
  { rejectValue: string }
>("leads/uploadDocument", async ({ leadId, file }, { rejectWithValue }) => {
  try {
    const updatedLead = await LeadAPI.uploadDocument(leadId, file);
    return { leadId, updatedLead };
  } catch (err) {
    const error = err as ApiError;
    return rejectWithValue(
      error?.response?.data?.detail ||
        error?.message ||
        "Failed to upload document",
    );
  }
});

/**
 * Upload multiple document files to a lead.
 * PUT /leads/{lead_id}/update/ with multipart/form-data
 */
export const uploadLeadDocuments = createAsyncThunk<
  { leadId: string; updatedLead: Lead },
  { leadId: string; files: File[] },
  { rejectValue: string }
>("leads/uploadDocuments", async ({ leadId, files }, { rejectWithValue }) => {
  try {
    const updatedLead = await LeadAPI.uploadDocuments(leadId, files);
    return { leadId, updatedLead };
  } catch (err) {
    const error = err as ApiError;
    return rejectWithValue(
      error?.response?.data?.detail ||
        error?.message ||
        "Failed to upload documents",
    );
  }
});

/**
 * Fetch the documents list for a specific lead from the API.
 * GET /leads/{lead_id}/ → returns lead.documents[] as LeadDocument[]
 *
 * FIX: was typed as `documents: string[]` which conflicted with
 * Lead.documents: LeadDocument[] after the API type was updated.
 */
export const fetchLeadDocuments = createAsyncThunk<
  { leadId: string; documents: LeadDocument[] }, // ← was string[], now LeadDocument[]
  string,
  { rejectValue: string }
>("leads/fetchDocuments", async (leadId, { rejectWithValue }) => {
  try {
    const documents = await LeadAPI.getDocuments(leadId);
    return { leadId, documents };
  } catch (err) {
    const error = err as ApiError;
    return rejectWithValue(
      error?.response?.data?.detail ||
        error?.message ||
        "Failed to fetch documents",
    );
  }
});

// ====================== Slice ======================
const leadSlice = createSlice({
  name: "leads",
  initialState,
  reducers: {
    clearLeads: (state) => {
      state.leads = [];
    },
    clearError: (state) => {
      state.error = null;
    },
    clearDocumentsError: (state) => {
      state.documentsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Fetch Leads ────────────────────────────────────────────
      .addCase(fetchLeads.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loading = false;
        state.leads = action.payload.map((lead) => ({
          ...lead,
          status: normalizeStatus(
            (lead as any).lead_status || (lead as any).status || "new",
          ),
        }));
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to fetch leads";
      })

      // ── Book Appointment ───────────────────────────────────────
      .addCase(bookAppointment.pending, (state, action) => {
        const { leadId, payload } = action.meta.arg;
        state.leads = state.leads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                status: "Appointment" as any,
                lead_status: "appointment" as any,
                book_appointment: true,
                appointment_date: payload.appointment_date,
                slot: payload.slot,
                ...(payload.department_id && {
                  department_id: payload.department_id,
                }),
                ...(payload.assigned_to_id && {
                  assigned_to_id: payload.assigned_to_id,
                }),
                ...(payload.remark && { remark: payload.remark }),
              }
            : lead,
        );
      })
      .addCase(bookAppointment.fulfilled, () => {
        // already patched optimistically in .pending
      })
      .addCase(bookAppointment.rejected, (state, action) => {
        const { leadId } = action.meta.arg;
        state.leads = state.leads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                status: "New" as any,
                lead_status: "new" as any,
                book_appointment: false,
              }
            : lead,
        );
        state.error = action.payload ?? "Failed to book appointment";
      })

      // ── Convert Lead ───────────────────────────────────────────
      .addCase(convertLead.fulfilled, (state, action) => {
        state.leads = state.leads.map((lead) =>
          lead.id === action.payload
            ? {
                ...lead,
                status: "Converted" as any,
                lead_status: "converted" as any,
              }
            : lead,
        );
      })
      .addCase(convertLead.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to convert lead";
      })

      // ── Delete Single Lead ─────────────────────────────────────
      .addCase(deleteLead.pending, (state, action) => {
        state.deletingIds.push(action.meta.arg);
        state.error = null;
      })
      .addCase(deleteLead.fulfilled, (state, action) => {
        state.deletingIds = state.deletingIds.filter(
          (id) => id !== action.payload,
        );
        state.leads = state.leads.filter((lead) => lead.id !== action.payload);
      })
      .addCase(deleteLead.rejected, (state, action) => {
        state.deletingIds = state.deletingIds.filter(
          (id) => id !== action.meta.arg,
        );
        state.error = action.payload ?? "Failed to delete lead";
      })

      // ── Delete Multiple Leads ──────────────────────────────────
      .addCase(deleteLeads.pending, (state, action) => {
        state.deletingIds.push(...action.meta.arg);
        state.error = null;
      })
      .addCase(deleteLeads.fulfilled, (state, action) => {
        state.deletingIds = state.deletingIds.filter(
          (id) => !action.payload.includes(id),
        );
        state.leads = state.leads.filter(
          (lead) => !action.payload.includes(lead.id),
        );
      })
      .addCase(deleteLeads.rejected, (state, action) => {
        state.deletingIds = state.deletingIds.filter(
          (id) => !action.meta.arg.includes(id),
        );
        state.error = action.payload ?? "Failed to delete leads";
      })

      // ── Upload Single Document ─────────────────────────────────
      .addCase(uploadLeadDocument.pending, (state) => {
        state.documentsUploading = true;
        state.documentsError = null;
      })
      .addCase(uploadLeadDocument.fulfilled, (state, action) => {
        state.documentsUploading = false;
        const { leadId, updatedLead } = action.payload;
        state.leads = state.leads.map((lead) =>
          lead.id === leadId
            ? { ...lead, documents: updatedLead.documents ?? lead.documents }
            : lead,
        );
      })
      .addCase(uploadLeadDocument.rejected, (state, action) => {
        state.documentsUploading = false;
        state.documentsError = action.payload ?? "Failed to upload document";
      })

      // ── Upload Multiple Documents ──────────────────────────────
      .addCase(uploadLeadDocuments.pending, (state) => {
        state.documentsUploading = true;
        state.documentsError = null;
      })
      .addCase(uploadLeadDocuments.fulfilled, (state, action) => {
        state.documentsUploading = false;
        const { leadId, updatedLead } = action.payload;
        state.leads = state.leads.map((lead) =>
          lead.id === leadId
            ? { ...lead, documents: updatedLead.documents ?? lead.documents }
            : lead,
        );
      })
      .addCase(uploadLeadDocuments.rejected, (state, action) => {
        state.documentsUploading = false;
        state.documentsError = action.payload ?? "Failed to upload documents";
      })

      // ── Fetch Documents ────────────────────────────────────────
      // FIX: documents is now LeadDocument[] (was string[]) to match Lead type
      .addCase(fetchLeadDocuments.fulfilled, (state, action) => {
        const { leadId, documents } = action.payload;
        state.leads = state.leads.map((lead) =>
          lead.id === leadId ? { ...lead, documents } : lead,
        );
      });
  },
});

export const { clearLeads, clearError, clearDocumentsError } =
  leadSlice.actions;
export default leadSlice.reducer;

// ====================== Selectors ======================
export const selectLeads = (state: { leads: LeadState }) => state.leads.leads;
export const selectLeadsLoading = (state: { leads: LeadState }) =>
  state.leads.loading;
export const selectLeadsError = (state: { leads: LeadState }) =>
  state.leads.error;
export const selectDeletingIds = (state: { leads: LeadState }) =>
  state.leads.deletingIds;
export const selectIsLeadDeleting =
  (leadId: string) => (state: { leads: LeadState }) =>
    state.leads.deletingIds.includes(leadId);

// ── Document selectors ─────────────────────────────────────────
export const selectDocumentsUploading = (state: { leads: LeadState }) =>
  state.leads.documentsUploading;
export const selectDocumentsError = (state: { leads: LeadState }) =>
  state.leads.documentsError;
export const selectLeadDocuments =
  (leadId: string) => (state: { leads: LeadState }) =>
    state.leads.leads.find((l) => l.id === leadId)?.documents ?? [];
