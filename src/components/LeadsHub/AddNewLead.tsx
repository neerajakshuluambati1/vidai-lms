/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
} from "@mui/material";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Dayjs } from "dayjs";

import { useSelector, useDispatch } from "react-redux";
import { selectCampaign } from "../../store/campaignSlice";
import { selectUser } from "../../store/authSlice";
import { selectClinic } from "../../store/clinicSlice";
import {
  loadReferralSources,
  loadDashboardCounts,
} from "../../store/referralSlice";
import type { AppDispatch } from "../../store";
import {
  resolveUserRole,
  hasAnySubcategoryActionPermission,
} from "../../utils/roleAccess";
import { fetchUsers } from "../../store/userSlice";

import type { FormState, Interest } from "../../types/leads.types";
import { LeadAPI, DepartmentAPI, LeadEmailAPI, InterestAPI } from "../../services/leads.api";
import type { Department } from "../../services/leads.api";
// FIX ERROR 3: Import the API-side Interest type under an alias so we can cast
import type { Interest as ApiInterest } from "../../services/leads.api";
import { authApi } from "../../services/auth.api";
import {
  pipelineApi,
  isActiveStageStatus,
  type Pipeline,
  type PipelineStage,
  type PipelineStageField,
} from "../../services/pipeline.api";

import {
  ALLOWED_DOC_TYPES,
  MAX_DOC_SIZE_MB,
  TASK_TYPES,
  strOrNull,
  intOrNull,
  type LeadPayload,
  type LeadGeneratedByObject,
  type ReferralSourceObject,
  type NextActionStatusOption,
  type CampaignData,
  type ApiError,
  type TaskStatusValue,          // ← renamed from ActionStatusValue
} from "../LeadsHub/addNewLead.constants";

import { validateStep } from "../LeadsHub/addNewLead.validation";
import { Step1, Step2, Step3 } from "../LeadsHub/addNewLead.steps";

import {
  IS_MEDICAL_APP,
  IS_CONTRACTS_APP,
  ACTIVE_FLOW_COPY,
} from "../../config/appType";
import { sanitizeNameInput, capitalizeFirst } from "../../utils/nameValidation";

import { fetchReferralDepartments } from "../../services/referral.api";
import type { ReferralDepartment } from "../../services/referral.api";
import { selectUsers } from "../../store/userSlice";

const STORAGE_KEY_SELECTED_INDUSTRY = "leads_selected_industry";
const STORAGE_KEY_SELECTED_PIPELINE = "leads_selected_pipeline_id";
const STORAGE_KEY_DEFAULT_PIPELINE = "leads_default_pipeline_id";

// ── Helpers ───────────────────────────────────────────────────────────────────

const toReadableError = (value: unknown): string => {
  if (value == null) return "Unknown error";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    const first = value[0];
    return first == null ? "Unknown error" : toReadableError(first);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    const firstKey = Object.keys(obj)[0];
    if (!firstKey) return "Unknown error";
    return `${firstKey}: ${toReadableError(obj[firstKey])}`;
  }
  return "Unknown error";
};

type AssigneeOption = {
  id: number;
  first_name: string | undefined;
  last_name: string | undefined;
  username: string | undefined;
  role: string | undefined;
  designation: string | undefined;
  email: string | undefined;
};

const normalizeUsersList = (users: any[]): AssigneeOption[] => {
  return users.map((u) => ({
    id: u.id,
    first_name: u.first_name || u.firstName,
    last_name: u.last_name || u.lastName,
    username: u.username,
    role: u.role?.name || u.role || '',
    designation: undefined,
    email: u.email,
  }));
};

const normalizeAssignees = (res: any): AssigneeOption[] => {
  const users =
    (Array.isArray(res) && res) ||
    res?.data?.objects ||
    res?.data?.results ||
    res?.data?.users ||
    res?.objects ||
    res?.results ||
    res?.users ||
    res?.data ||
    [];
  return users.map((u: any) => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    username: u.username,
    role: u.role,
    designation: u.designation,
    email: u.email,
  }));
};

const assigneeLabel = (option: AssigneeOption): string => {
  const fullName =
    `${option.first_name ?? ""} ${option.last_name ?? ""}`.trim();
  const primary = fullName || option.username || `User ${option.id}`;
  return primary;
};

const personnelLabel = (option: AssigneeOption): string =>
  assigneeLabel(option);

const toLeadGeneratedByObject = (
  option: AssigneeOption,
): LeadGeneratedByObject => ({
  id: option.id,
  first_name: option.first_name ?? "",
  last_name: option.last_name ?? "",
  role: option.role ?? option.designation ?? "",
  email: option.email ?? "",
});

const INPUT_TOAST_OPTIONS = { position: "top-right" as const, autoClose: 1400 };

const showInputToast = (toastId: string, message: string) => {
  if (!toast.isActive(toastId)) {
    toast.error(message, { ...INPUT_TOAST_OPTIONS, toastId });
  }
};

const sanitizeEmailInput = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9@._%+-]/g, "");

// ── Derive action type labels from a single stage's enabled rules ─────────────
const deriveActionTypeOptions = (stage: PipelineStage): string[] => {
  const labels = stage.rules
    .filter((r) => r.is_enabled)
    .map((r) =>
      r.custom_label?.trim() ? r.custom_label.trim() : r.action_type,
    );
  return labels.length > 0 ? labels : [...TASK_TYPES];
};

// ── Derive union of action type labels across all stages ──────────────────────
const deriveAllActionTypeOptions = (stages: PipelineStage[]): string[] => {
  const labels = Array.from(
    new Set(
      stages.flatMap((s) =>
        s.rules
          .filter((r) => r.is_enabled)
          .map((r) =>
            r.custom_label?.trim() ? r.custom_label.trim() : r.action_type,
          ),
      ),
    ),
  );
  return labels.length > 0 ? labels : [...TASK_TYPES];
};

const buildDataCaptureKey = (field: PipelineStageField): string => {
  if (field.id) return String(field.id);
  return field.field_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
};

// ====================== Component ======================
export default function AddNewLead() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isCouple, setIsCouple] = React.useState<"yes" | "no">("yes");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Dayjs | null>(null);

  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = React.useState(false);
  const loadingEmployees = false;

  const [assigneeName, setAssigneeName] = React.useState("");
  const [assigneeSearch, setAssigneeSearch] = React.useState("");
  const [assigneeOptions, setAssigneeOptions] = React.useState<AssigneeOption[]>([]);
  const [assigneeLoading, setAssigneeLoading] = React.useState(false);

  const [leadGeneratedBySearch, setLeadGeneratedBySearch] = React.useState("");
  const [selectedLeadGeneratedBy, setSelectedLeadGeneratedBy] =
    React.useState<LeadGeneratedByObject | null>(null);
  const [leadGeneratedByOptions, setLeadGeneratedByOptions] = React.useState<AssigneeOption[]>([]);
  const [leadGeneratedByLoading, setLeadGeneratedByLoading] = React.useState(false);

  const [appointmentPersonnelInput, setAppointmentPersonnelInput] = React.useState("");
  const [appointmentPersonnelOptions, setAppointmentPersonnelOptions] = React.useState<AssigneeOption[]>([]);
  const [appointmentPersonnelLoading, setAppointmentPersonnelLoading] = React.useState(false);

  const [referralDepartments, setReferralDepartments] = React.useState<ReferralDepartment[]>([]);
  const [loadingReferralDepts, setLoadingReferralDepts] = React.useState(false);

  // ── File state ─────────────────────────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [docDragOver, setDocDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ── Pipeline / stage state ─────────────────────────────────────────────────
  const [nextActionTypeOptions, setNextActionTypeOptions] = React.useState<string[]>([]);
  const [pipelineStageNames, setPipelineStageNames] = React.useState<string[]>([]);
  const [pipelineStages, setPipelineStages] = React.useState<PipelineStage[]>([]);
  const [selectedNextActionStageId, setSelectedNextActionStageId] = React.useState<string | null>(null);
  const [dataCaptureFields, setDataCaptureFields] = React.useState<PipelineStageField[]>([]);
  const [dataCaptureValues, setDataCaptureValues] = React.useState<Record<string, string>>({});
  
  // ── Interests ─────────────────────────────────────────────────
  const [interests, setInterests] = React.useState<Interest[]>([]);
  const [loadingInterests, setLoadingInterests] = React.useState(false);

  const leadStatusOptions = React.useMemo<NextActionStatusOption[]>(
    () =>
      pipelineStages.map((s) => ({
        label: s.stage_name.trim(),
        value: s.stage_name.trim(),
      })),
    [pipelineStages],
  );

  const resolvedDataCaptureFields = React.useMemo(
    () =>
      dataCaptureFields
        .filter((field) => field.field_name.trim().length > 0)
        .map((field) => ({
          key: buildDataCaptureKey(field),
          label: field.field_name.trim(),
          type: field.field_type,
          required: field.is_mandatory,
        })),
    [dataCaptureFields],
  );

  const applyStageDataCapture = React.useCallback((stage: PipelineStage | null) => {
    const nextFields = Array.isArray(stage?.fields) ? stage.fields : [];
    setDataCaptureFields(nextFields);
    setDataCaptureValues((previous) => {
      const next: Record<string, string> = {};
      nextFields.forEach((field) => {
        const key = buildDataCaptureKey(field);
        next[key] = previous[key] ?? "";
      });
      return next;
    });
  }, []);

  const rawCampaigns = useSelector(selectCampaign);
  const authedUser = useSelector(selectUser);
  const selectedClinic = useSelector(selectClinic);
  const clinicId =
    selectedClinic?.id ?? Number(localStorage.getItem("clinic_id") ?? 1);

  // ── Permission guard ───────────────────────────────────────────────────────
  const _authUserRaw = authedUser as unknown as Record<string, unknown> | null;
  const _nestedUser =
    _authUserRaw?.user && typeof _authUserRaw.user === "object"
      ? (_authUserRaw.user as Record<string, unknown>)
      : null;
  const _role = resolveUserRole(_authUserRaw);
  const _perms = _authUserRaw?.permissions ?? _nestedUser?.permissions;
  const authIsLoaded = authedUser != null;
  const authMode = localStorage.getItem("auth_mode");
  const isInternal = authMode === "INT";
  const canAddLeads =
    _role === "super_admin" ||
    hasAnySubcategoryActionPermission(_perms, ["leads hub"], "add");

  const campaigns = React.useMemo(
    () =>
      (rawCampaigns || []).flatMap((api: CampaignData) => {
        const isEmail = api.campaign_mode === 3;
        const base = {
          id: api.id,
          name: capitalizeFirst(api.campaign_name ?? ""),
          source: isEmail ? "Direct" : "Social Media",
          isActive: api.is_active !== false,
        };

        if (isEmail) {
          return [{ ...base, subSource: "Gmail" }];
        }

        const platforms = (api.social_media || [])
          .map((p) => p?.platform_name ?? "")
          .filter((p) => Boolean(p.trim()));

        if (platforms.length === 0) {
          return [{ ...base, subSource: "" }];
        }

        return platforms.map((platform) => ({
          ...base,
          subSource: platform
            .split("_")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" "),
        }));
      }),
    [rawCampaigns],
  );
  
  React.useEffect(() => {
    const loadInterests = async () => {
      try {
        setLoadingInterests(true);

        const data = await InterestAPI.listActiveByClinic(clinicId);

        setInterests(data);
      } catch {
        setInterests([]);
      } finally {
        setLoadingInterests(false);
      }
    };

    loadInterests();
  }, [clinicId]);

  const [form, setForm] = React.useState<FormState>({
    full_name: "",
    contact: "",
    email: "",
    location: "",
    gender: "",
    age: "",
    marital: "",
    address: "",
    language: "",
    partnerName: "",
    partnerAge: "",
    partnerGender: "",
    source: "",
    subSource: "",
    campaign: "",
    campaignName: "",
    assignee: "",
    nextType: "",
    nextStatus: "",
    nextDesc: "",
    leadStatus: "",
    taskStatus: "",              // ← renamed from actionStatus
    treatmentInterest: "",
    treatments: [],
    wantAppointment: "no",
    department: "",
    personnel: "",
    appointmentDate: "",
    slot: "",
    remark: "",
    contactFullName: "",
    designation: "",
    contactPhone: "",
    contactEmail: "",
    leadGeneratedBy: "",
    referralDepartment: "",
  });

  const users = useSelector(selectUsers);

  React.useEffect(() => {
    if (!Array.isArray(users) || users.length > 0) return;
    void dispatch(fetchUsers());
  }, [dispatch, users]);

  // Next action status = only stages that come AFTER the selected lead status
  const filteredNextActionStatusOptions = React.useMemo<NextActionStatusOption[]>(() => {
    if (!form.leadStatus) {
      return pipelineStageNames.map((name) => ({ label: name, value: name }));
    }
    const currentStage = pipelineStages.find(
      (s) =>
        s.stage_name.trim().toLowerCase() ===
        form.leadStatus.trim().toLowerCase(),
    );
    if (!currentStage) {
      return pipelineStageNames.map((name) => ({ label: name, value: name }));
    }
    return pipelineStages
      .filter((s) => s.stage_order > currentStage.stage_order)
      .map((s) => ({ label: s.stage_name, value: s.stage_name }));
  }, [pipelineStages, pipelineStageNames, form.leadStatus]);

  // ── Fetch Departments ──────────────────────────────────────────────────────
  React.useEffect(() => {
    setDepartments([]);
    setForm((prev) => ({ ...prev, department: "", personnel: "" }));
    const fetchDeps = async () => {
      try {
        setLoadingDepartments(true);
        const fetched = await DepartmentAPI.listActiveByClinic(clinicId);
        setDepartments(fetched);
        if (fetched.length > 0) {
          setForm((prev) =>
            prev.department
              ? prev
              : { ...prev, department: String(fetched[0].id) },
          );
        }
      } catch (err) {
        const error = err as ApiError;
        toast.error(
          `Departments: ${toReadableError(error?.response?.data) || error?.message || "Failed"}`,
          { position: "top-right", autoClose: 3000, theme: "colored" },
        );
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDeps();
  }, [clinicId]);

  // ── Load pipeline stages ───────────────────────────────────────────────────
  React.useEffect(() => {
    const loadFromPipeline = async () => {
      const selectedIndustry =
        localStorage.getItem(STORAGE_KEY_SELECTED_INDUSTRY) ?? "";
      const selectedPipelineId =
        localStorage.getItem(STORAGE_KEY_SELECTED_PIPELINE) ??
        localStorage.getItem(STORAGE_KEY_DEFAULT_PIPELINE) ??
        "";

      try {
        let selectedPipeline: Pipeline | null = null;

        if (selectedPipelineId) {
          try {
            selectedPipeline = await pipelineApi.getById(selectedPipelineId);
          } catch {
            selectedPipeline = null;
          }
        }

        if (!selectedPipeline) {
          const pipelines = await pipelineApi.list(clinicId);
          const byIndustry = selectedIndustry
            ? pipelines.filter((p) => p.industry_type === selectedIndustry)
            : pipelines;

          selectedPipeline =
            pipelines.find((p) => p.id === selectedPipelineId) ??
            byIndustry.find((p) => p.is_active) ??
            byIndustry[0] ??
            pipelines.find((p) => p.is_active) ??
            pipelines[0] ??
            null;
        }

        const rawStages = selectedPipeline?.stages ?? [];
        const activeStages = rawStages
          .filter((s) => isActiveStageStatus(s.stage_status))
          .filter((s) => s.stage_name.trim())
          .sort((a, b) => {
            const aOrder = typeof a.stage_order === "number" ? a.stage_order : 0;
            const bOrder = typeof b.stage_order === "number" ? b.stage_order : 0;
            if (aOrder === bOrder) return 0;
            return aOrder - bOrder;
          });

        const stageNames = activeStages.map((s) => s.stage_name.trim());

        setPipelineStageNames(stageNames);
        setPipelineStages(activeStages);

        if (activeStages.length > 0) {
          const firstStage = activeStages[0];
          const secondStage = activeStages[1] ?? null;
          const firstStageName = firstStage.stage_name.trim();
          const secondStageName = secondStage ? secondStage.stage_name.trim() : "";

          const initialActionTypeOptions = secondStage
            ? deriveActionTypeOptions(secondStage)
            : deriveAllActionTypeOptions(activeStages);

          setNextActionTypeOptions(initialActionTypeOptions);

          setForm((prev) =>
            prev.leadStatus
              ? prev
              : {
                  ...prev,
                  leadStatus: firstStageName,
                  nextStatus: secondStageName,
                },
          );

          setSelectedNextActionStageId(firstStage.id ?? null);
          applyStageDataCapture(firstStage);
        } else {
          setNextActionTypeOptions(deriveAllActionTypeOptions(activeStages));
          applyStageDataCapture(null);
        }
      } catch {
        setNextActionTypeOptions([...TASK_TYPES]);
        applyStageDataCapture(null);
      }
    };

    void loadFromPipeline();
  }, [applyStageDataCapture, clinicId]);

  // ── Auto-clear nextType if it's no longer valid for the selected stage ─────
  React.useEffect(() => {
    if (!form.nextType) return;
    if (nextActionTypeOptions.includes(form.nextType)) return;
    setForm((prev) => ({ ...prev, nextType: "" }));
  }, [form.nextType, nextActionTypeOptions]);

  // ── Fetch Referral Departments ─────────────────────────────────────────────
  React.useEffect(() => {
    const load = async () => {
      try {
        setLoadingReferralDepts(true);
        const data = await fetchReferralDepartments(clinicId);
        setReferralDepartments(data);
      } catch {
        setReferralDepartments([]);
      } finally {
        setLoadingReferralDepts(false);
      }
    };
    load();
  }, [clinicId]);

  // ── Assignee search ────────────────────────────────────────────────────────
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setAssigneeLoading(true);
        const trimmedSearch = assigneeSearch.trim();
        const normalizedUsers = Array.isArray(users)
          ? normalizeUsersList(users)
          : [];

        const fetchFromApi = async () => {
          const response = await authApi.searchUsers({
            search: trimmedSearch,
            limit: trimmedSearch ? 20 : 50,
            offset: 0,
          });
          return normalizeAssignees(response);
        };

        if (!trimmedSearch) {
          if (normalizedUsers.length > 0) {
            setAssigneeOptions(normalizedUsers);
            return;
          }

          const apiUsers = await fetchFromApi();
          setAssigneeOptions(apiUsers);
          return;
        }

        if (normalizedUsers.length > 0) {
          const filtered = normalizedUsers.filter((u) =>
            `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.username ?? ""}`
              .toLowerCase()
              .includes(trimmedSearch.toLowerCase()),
          );
          if (filtered.length > 0) {
            setAssigneeOptions(filtered);
            return;
          }
        }

        const apiUsers = await fetchFromApi();
        if (apiUsers.length > 0) {
          setAssigneeOptions(apiUsers);
        } else {
          setAssigneeOptions([]);
        }
      } catch (err) {
        console.log(err);
        const normalizedUsers = Array.isArray(users)
          ? normalizeUsersList(users)
          : [];
        const trimmedSearch = assigneeSearch.trim().toLowerCase();
        if (!trimmedSearch) {
          setAssigneeOptions(normalizedUsers);
        } else {
          setAssigneeOptions(
            normalizedUsers.filter((u) =>
              `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.username ?? ""}`
                .toLowerCase()
                .includes(trimmedSearch),
            ),
          );
        }
      } finally {
        setAssigneeLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [assigneeSearch, isInternal, users]);

  // ── Lead Generated By search ───────────────────────────────────────────────
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLeadGeneratedByLoading(true);
        const trimmedSearch = leadGeneratedBySearch.trim();
        const normalizedUsers = Array.isArray(users)
          ? normalizeUsersList(users)
          : [];

        const fetchFromApi = async () => {
          const response = await authApi.searchUsers({
            search: trimmedSearch,
            limit: trimmedSearch ? 20 : 50,
            offset: 0,
          });
          return normalizeAssignees(response);
        };

        if (!trimmedSearch) {
          if (normalizedUsers.length > 0) {
            setLeadGeneratedByOptions(normalizedUsers);
            return;
          }

          const apiUsers = await fetchFromApi();
          setLeadGeneratedByOptions(apiUsers);
          return;
        }

        if (normalizedUsers.length > 0) {
          const filtered = normalizedUsers.filter((u) =>
            `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.username ?? ""}`
              .toLowerCase()
              .includes(trimmedSearch.toLowerCase()),
          );
          if (filtered.length > 0) {
            setLeadGeneratedByOptions(filtered);
            return;
          }
        }

        const apiUsers = await fetchFromApi();
        if (apiUsers.length > 0) {
          setLeadGeneratedByOptions(apiUsers);
        } else {
          setLeadGeneratedByOptions([]);
        }
      } catch {
        const normalizedUsers = Array.isArray(users)
          ? normalizeUsersList(users)
          : [];
        const trimmedSearch = leadGeneratedBySearch.trim().toLowerCase();
        if (!trimmedSearch) {
          setLeadGeneratedByOptions(normalizedUsers);
        } else {
          setLeadGeneratedByOptions(
            normalizedUsers.filter((u) =>
              `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.username ?? ""}`
                .toLowerCase()
                .includes(trimmedSearch),
            ),
          );
        }
      } finally {
        setLeadGeneratedByLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isInternal, leadGeneratedBySearch, users]);

  // ── Appointment personnel search ───────────────────────────────────────────
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (form.wantAppointment !== "yes" || !appointmentPersonnelInput.trim()) {
        setAppointmentPersonnelOptions([]);
        return;
      }
      try {
        setAppointmentPersonnelLoading(true);
        const normalized = Array.isArray(users) ? normalizeUsersList(users) : [];
        if (normalized.length > 0) {
          const filtered = normalized.filter((u) =>
            `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.username ?? ""}`
              .toLowerCase()
              .includes(appointmentPersonnelInput.toLowerCase()),
          );
          if (filtered.length > 0) {
            setAppointmentPersonnelOptions(filtered);
            return;
          }
        }

        const response = await authApi.searchUsers({
          search: appointmentPersonnelInput,
          limit: 20,
          offset: 0,
        });
        const apiUsers = normalizeAssignees(response);
        setAppointmentPersonnelOptions(apiUsers.length > 0 ? apiUsers : normalized);
      } catch {
        const normalized = Array.isArray(users) ? normalizeUsersList(users) : [];
        setAppointmentPersonnelOptions(
          normalized.filter((u) =>
            `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.username ?? ""}`
              .toLowerCase()
              .includes(appointmentPersonnelInput.toLowerCase()),
          ),
        );
      } finally {
        setAppointmentPersonnelLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [appointmentPersonnelInput, form.department, form.wantAppointment, isInternal, users]);

  const selectedAppointmentPersonnel = React.useMemo(() => {
    const selectedId = Number(form.personnel);
    if (Number.isFinite(selectedId)) {
      const matched = appointmentPersonnelOptions.find((o) => o.id === selectedId);
      if (matched) return matched;
    }
    if (!appointmentPersonnelInput.trim()) return null;
    return {
      id: Number.isFinite(Number(form.personnel)) ? Number(form.personnel) : 0,
      first_name: undefined,
      last_name: undefined,
      username: appointmentPersonnelInput,
      role: undefined,
      designation: undefined,
      email: undefined,
    } satisfies AssigneeOption;
  }, [appointmentPersonnelInput, appointmentPersonnelOptions, form.personnel]);

  // ── Sync campaign → source + campaignName ─────────────────────────────────
  React.useEffect(() => {
    if (!form.campaign) {
      setForm((prev) => ({ ...prev, campaignName: "" }));
      return;
    }
    const matched = campaigns.find((c) => c.id === form.campaign);
    if (!matched) return;
    setForm((prev) => ({
      ...prev,
      campaignName: capitalizeFirst(matched.name),
      source: matched.source,
    }));
  }, [form.campaign, campaigns]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      if (field === "full_name") {
        const sanitized = sanitizeNameInput(rawValue);
        if (sanitized !== rawValue)
          showInputToast("add-lead-name-invalid", "enter only alphanumeric");
        setForm((prev) => ({ ...prev, full_name: capitalizeFirst(sanitized) }));
        return;
      }
      if (field === "partnerName") {
        const sanitized = sanitizeNameInput(rawValue);
        if (sanitized !== rawValue)
          showInputToast("add-lead-name-invalid", "enter only alphanumeric");
        setForm((prev) => ({ ...prev, partnerName: capitalizeFirst(sanitized) }));
        return;
      }
      if (field === "contactFullName") {
        const sanitized = sanitizeNameInput(rawValue);
        if (sanitized !== rawValue)
          showInputToast("add-lead-name-invalid", "enter only alphanumeric");
        setForm((prev) => ({ ...prev, contactFullName: capitalizeFirst(sanitized) }));
        return;
      }
      if (field === "contact") {
        const rawDigits = rawValue.replace(/\D/g, "");
        const digitsOnly = rawDigits.slice(0, 15);
        setForm((prev) => ({ ...prev, contact: digitsOnly }));
        return;
      }
      if (field === "contactPhone") {
        const rawDigits = rawValue.replace(/\D/g, "");
        const digitsOnly = rawDigits.slice(0, 15);
        setForm((prev) => ({ ...prev, contactPhone: digitsOnly }));
        return;
      }
      if (field === "email") {
        const sanitized = sanitizeEmailInput(rawValue);
        if (sanitized !== rawValue.toLowerCase())
          showInputToast("add-lead-email-invalid", "enter valid email characters only");
        setForm((prev) => ({ ...prev, email: sanitized }));
        return;
      }
      if (field === "contactEmail") {
        const sanitized = sanitizeEmailInput(rawValue);
        if (sanitized !== rawValue.toLowerCase())
          showInputToast("add-lead-email-invalid", "enter valid email characters only");
        setForm((prev) => ({ ...prev, contactEmail: sanitized }));
        return;
      }
      setForm((prev) => ({ ...prev, [field]: capitalizeFirst(rawValue) }));
    };

  const handleSelectChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCampaignChange = (value: string) => {
    if (!value) {
      setForm((prev) => ({ ...prev, campaign: "", campaignName: "" }));
      return;
    }
    const matched = campaigns.find((c) => c.id === value);
    if (!matched) {
      setForm((prev) => ({ ...prev, campaign: value }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      campaign: value,
      campaignName: capitalizeFirst(matched.name),
      source: matched.source,
    }));
  };

  const handleSourceChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      source: value,
      subSource: "",
      campaign: "",
      campaignName: "",
    }));
  };

  const handleSubSourceChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      subSource: value,
      campaign: "",
      campaignName: "",
    }));
  };

  const handleDepartmentChange = (value: string) => {
    setAppointmentPersonnelInput("");
    setForm((prev) => ({ ...prev, department: value, personnel: "" }));
  };

  const handleLeadStatusChange = (value: string) => {
    const trimmed = value.trim();
    const matched = pipelineStages.find(
      (s) => s.stage_name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    applyStageDataCapture(matched ?? null);
    setSelectedNextActionStageId(matched?.id ?? null);
    const nextStages = pipelineStages
      .filter((s) => (matched ? s.stage_order > matched.stage_order : true))
      .sort((a, b) => a.stage_order - b.stage_order);
    const autoNextStatus =
      trimmed && nextStages[0] ? nextStages[0].stage_name.trim() : "";
    const autoNextStage = nextStages[0] ?? null;
    const stageActionOptions = autoNextStage
      ? deriveActionTypeOptions(autoNextStage)
      : deriveAllActionTypeOptions(pipelineStages);
    setNextActionTypeOptions(stageActionOptions);
    setForm((prev) => ({
      ...prev,
      leadStatus: trimmed,
      nextStatus: autoNextStatus,
      nextType: "",
    }));
  };

  const handleNextTypeChange = (value: string) =>
    setForm((prev) => ({ ...prev, nextType: value }));

  const handleNextStatusChange = (value: string) => {
    const trimmed = value.trim();
    const matched = pipelineStages.find(
      (s) => s.stage_name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    const stageActionOptions = matched
      ? deriveActionTypeOptions(matched)
      : deriveAllActionTypeOptions(pipelineStages);
    setNextActionTypeOptions(stageActionOptions);
    setForm((prev) => ({ ...prev, nextStatus: trimmed, nextType: "" }));
  };

  const handleReferralDepartmentChange = (value: string) =>
    setForm((prev) => ({ ...prev, referralDepartment: value }));

  // ── File Handlers ──────────────────────────────────────────────────────────
  const addFiles = (files: File[]) => {
    files.forEach((file) => {
      if (!ALLOWED_DOC_TYPES.includes(file.type)) {
        toast.error(
          `"${file.name}" — unsupported type. Use PDF, Word, JPG or PNG.`,
          { position: "top-right", autoClose: 3000, theme: "colored" },
        );
        return;
      }
      if (file.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" — exceeds ${MAX_DOC_SIZE_MB}MB limit.`, {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });
        return;
      }
      setPendingFiles((prev) =>
        prev.find((f) => f.name === file.name && f.size === file.size)
          ? prev
          : [...prev, file],
      );
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (currentStep === 1) {
      const missingRequiredDataCapture = resolvedDataCaptureFields.find(
        (field) =>
          field.required &&
          String(dataCaptureValues[field.key] ?? "").trim().length === 0,
      );

      if (missingRequiredDataCapture) {
        toast.error(`${missingRequiredDataCapture.label} is required`, {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });
        return;
      }
    }

    const isValid = await validateStep(
      currentStep,
      form,
      isCouple,
      pendingFiles.length > 0,
    );
    if (!isValid) return;
    if (currentStep === 3) {
      await submitForm();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  // ── Build Payload ──────────────────────────────────────────────────────────
  const buildPayload = (): LeadPayload => {
    const shouldBookAppointment =
      form.wantAppointment === "yes" &&
      Boolean(form.appointmentDate && form.slot);

    const selectedDepartmentId = intOrNull(form.department);
    const departmentId = selectedDepartmentId ?? departments[0]?.id ?? 0;

    const normalizedGender = (form.gender ?? "").toLowerCase().trim();
    const genderValue =
      normalizedGender === "male" || normalizedGender === "female"
        ? (normalizedGender as "male" | "female")
        : null;

    const maritalValue =
      (form.marital ?? "").trim() !== ""
        ? (form.marital.toLowerCase() as "single" | "married")
        : null;

    const partnerGenderValue =
      (form.partnerGender ?? "").trim() !== ""
        ? (form.partnerGender.toLowerCase() as "male" | "female")
        : null;

    const referralDeptId = intOrNull(form.referralDepartment);

    const resolvedNextActionStatus: string | null =
      (form.nextStatus ?? "").trim() || null;
    const resolvedNextActionType: string | undefined =
      (form.nextType ?? "").trim() || undefined;
    const resolvedNextActionDescription =
      (form.nextDesc ?? "").trim() || undefined;

    return {
      clinic_id: clinicId,
      department_id: departmentId,
      stage_id: selectedNextActionStageId || null,
      full_name: form.full_name.trim() || "Unknown Lead",
      contact_no: form.contact.trim() || "",
      source: form.source || "Direct",
      sub_source: form.subSource || "",
      treatment_interest: form.treatments,
      appointment_date: shouldBookAppointment
        ? (form.appointmentDate ?? null)
        : null,
      slot: shouldBookAppointment ? (form.slot ?? "") : "",
      campaign_id: strOrNull(form.campaign),
      email: strOrNull(form.email || form.contactEmail) ?? null,
      language_preference: form.language ?? "",
      location: form.location ?? "",
      address: form.address ?? "",
      remark: form.remark ?? "",
      partner_full_name: form.partnerName ?? "",
      next_action_description: resolvedNextActionDescription,
      next_action_type: resolvedNextActionType,
      next_action_status: resolvedNextActionStatus,
      gender: IS_MEDICAL_APP ? genderValue : null,
      marital_status: IS_MEDICAL_APP ? maritalValue : null,
      partner_gender: IS_MEDICAL_APP ? partnerGenderValue : null,
      ...(form.leadStatus
        ? { lead_status: form.leadStatus as LeadPayload["lead_status"] }
        : {}),
      action_status: (form.taskStatus.trim().toLowerCase() as TaskStatusValue) || null,   // ← trim & normalize
      assigned_to_id: intOrNull(form.assignee) ?? null,
      assigned_to_name: assigneeName.trim() || null,
      personal_id: selectedAppointmentPersonnel?.id ?? null,
      personal_name: IS_CONTRACTS_APP
        ? selectedAppointmentPersonnel
          ? `${selectedAppointmentPersonnel.first_name ?? ""} ${selectedAppointmentPersonnel.last_name ?? ""}`.trim() ||
            selectedAppointmentPersonnel.username
          : null
        : null,
      age: IS_MEDICAL_APP ? (intOrNull(form.age) ?? null) : null,
      partner_age: IS_MEDICAL_APP ? (intOrNull(form.partnerAge) ?? null) : null,
      partner_inquiry: IS_MEDICAL_APP ? isCouple === "yes" : false,
      book_appointment: shouldBookAppointment,
      is_active: true,
      referral_department_id: referralDeptId ?? null,
      ...(IS_CONTRACTS_APP && {
        contact_full_name: form.contactFullName.trim() || null,
        contact_designation: form.designation.trim() || null,
        contact_phone: form.contactPhone.trim() || null,
        contact_email: strOrNull(form.contactEmail) ?? null,
      }),
    };
  };

  // FIX ERRORS 1 & 2: Accept string as a valid input (API may return string for legacy data)
  const getInterestNames = (
    interests: string | string[] | { id: string; name: string }[] | undefined | null,
  ): string => {
    if (!interests || (Array.isArray(interests) && interests.length === 0)) {
      return "-";
    }

    // Handle legacy string value returned from API
    if (typeof interests === "string") {
      return interests || "-";
    }

    if (typeof interests[0] === "string") {
      return (interests as string[]).join(", ");
    }

    return (interests as { id: string; name: string }[])
      .map((i) => i.name)
      .join(", ");
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submitForm = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const payload = buildPayload();

      const shouldSendAppointmentEmail =
        payload.book_appointment === true &&
        Boolean(payload.appointment_date && payload.slot);

      const referralSourceObject: ReferralSourceObject | undefined =
        IS_CONTRACTS_APP && selectedLeadGeneratedBy
          ? {
              first_name: selectedLeadGeneratedBy.first_name,
              last_name: selectedLeadGeneratedBy.last_name,
              email: selectedLeadGeneratedBy.email,
              role: selectedLeadGeneratedBy.role,
            }
          : undefined;

      const response =
        pendingFiles.length > 0
          ? await LeadAPI.createWithDocuments(payload, pendingFiles, referralSourceObject)
          : await LeadAPI.create(payload, referralSourceObject);

      if (shouldSendAppointmentEmail) {
        const postAppointmentStage =
          pipelineStageNames.find((s) => s.toLowerCase() === "appointment") ??
          pipelineStageNames[pipelineStageNames.length - 1] ??
          null;
        try {
          await LeadAPI.update(String(response.id), {
            clinic_id: response.clinic_id ?? payload.clinic_id,
            department_id: response.department_id ?? payload.department_id,
            full_name: response.full_name || payload.full_name,
            contact_no: response.contact_no || payload.contact_no,
            source: response.source || payload.source,
            treatment_interest: payload.treatment_interest,
            next_action_status: postAppointmentStage,
            book_appointment: true,
            appointment_date: payload.appointment_date,
            slot: payload.slot,
            partner_inquiry:
              response.partner_inquiry ?? payload.partner_inquiry,
            is_active: response.is_active !== false,
          });
        } catch {
          toast.warning("Lead was created, but appointment status update failed.", {
            position: "top-right",
            autoClose: 2500,
            theme: "colored",
          });
        }
      }

      const recipientEmail =
        response.email?.trim() ||
        payload.email?.trim() ||
        form.contactEmail.trim() ||
        "";

      if (recipientEmail) {
        const leadFirstName =
          (response.full_name || payload.full_name || "Patient")
            .trim()
            .split(/\s+/)[0] || "Patient";
        const appointmentDateText = payload.appointment_date || "-";
        const appointmentSlotText = payload.slot || "-";
        const clinicName = selectedClinic?.name || "Our Clinic";
        const senderName = `${clinicName} Team`;
        const senderEmail = selectedClinic?.email || "noreply@clinic.com";

        const subject = payload.book_appointment
          ? `Appointment Confirmed - ${appointmentDateText}`
          : `Your details have been registered with us`;

        const emailBody = payload.book_appointment
          ? [
              `Hi ${leadFirstName},`,
              "",
              `Your appointment with our clinic has been successfully scheduled.`,
              "",
              `Date: ${appointmentDateText}`,
              `Time: ${appointmentSlotText}`,
              "",
              `Details:`,
              `- Name: ${response.full_name || payload.full_name || "-"}`,
              `- Contact: ${response.contact_no || payload.contact_no || "-"}`,
              `- Treatment Interest: ${getInterestNames(
                // FIX ERRORS 1 & 2: Cast to any to accept string | string[] | {id,name}[]
                (response.treatment_interest || payload.treatment_interest) as any,
              )}`,
              "",
              `If you need to reschedule or have any questions, please contact us.`,
              "",
              `We look forward to assisting you.`,
              "",
              `Thank you,`,
              `${senderName}`,
            ].join("\n")
          : [
              `Hi ${leadFirstName},`,
              "",
              `Your details have been successfully registered with our clinic.`,
              "",
              `Here's a quick summary:`,
              `- Name: ${response.full_name || payload.full_name || "-"}`,
              `- Contact: ${response.contact_no || payload.contact_no || "-"}`,
              `- Email: ${recipientEmail}`,
              `- Location: ${response.location || payload.location || "-"}`,
              `- Treatment Interest: ${getInterestNames(
                // FIX ERRORS 1 & 2: Cast to any to accept string | string[] | {id,name}[]
                (response.treatment_interest || payload.treatment_interest) as any,
              )}`,
              "",
              `Our team will review your details and get in touch with you shortly.`,
              "",
              `If you have any questions, feel free to reach out to us anytime.`,
              "",
              `Thank you,`,
              `${senderName}`,
            ].join("\n");

        try {
          await LeadEmailAPI.sendNow({
            lead: response.id,
            subject,
            sender_email: senderEmail,
            email_body: emailBody,
          });
        } catch {
          toast.warning("Lead was created, but confirmation email could not be sent.", {
            position: "top-right",
            autoClose: 2500,
            theme: "colored",
          });
        }
      }

      toast.success("Lead saved successfully!", {
        position: "top-right",
        autoClose: 1500,
        theme: "colored",
      });

      if (payload.referral_department_id) {
        try {
          dispatch(loadReferralSources({ referral_department_id: payload.referral_department_id }));
          dispatch(loadDashboardCounts(clinicId));
        } catch (err) {
          console.warn("Failed to refresh referral data:", err);
        }
      }

      navigate("/leads", { replace: true });
    } catch (err) {
      const error = err as ApiError;
      const status = error?.response?.status;
      const serverDetails = toReadableError(error?.response?.data) || "";
      let msg = "Failed to save lead";
      if (status === 500) {
        msg = serverDetails || "Server error. Please try again later";
      } else if (status === 400) {
        msg = serverDetails || "Please fill all required fields correctly";
      } else {
        msg = serverDetails || error?.message || "Something went wrong";
      }
      console.error("CREATE ERROR:", {
        status,
        url: "/leads/",
        details: error?.response?.data,
      });
      toast.error(msg, {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step indicator ─────────────────────────────────────────────────────────
  const steps = [
    { label: ACTIVE_FLOW_COPY.detailsStep, step: 1 },
    { label: ACTIVE_FLOW_COPY.medicalStep, step: 2 },
    { label: ACTIVE_FLOW_COPY.step3, step: 3 },
  ];

  if (!authIsLoaded) return null;
  if (!canAddLeads) return <Navigate to="/leads" replace />;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Paper
      className="add-lead-page"
      sx={{
        overflow: "hidden",
        minHeight: "88vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box sx={{ bgcolor: "white", px: 1, py: 1 }}>
        <Typography variant="h6" fontWeight={700} color="#1E293B">
          Add New Lead
        </Typography>
      </Box>

      {/* Step Indicator */}
      <Box sx={{ bgcolor: "white", px: 1, pt: 1, pb: 3 }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            bgcolor: "#F8FAFC",
            px: 3,
            py: 1.5,
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
          }}
        >
          {steps.map(({ label, step }) => (
            <Box key={step} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  bgcolor:
                    currentStep > step
                      ? "#10B981"
                      : currentStep === step
                        ? step === 3
                          ? "#3B82F6"
                          : "#F97316"
                        : "#E2E8F0",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              >
                {currentStep > step ? "✓" : step}
              </Box>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  fontSize: "0.875rem",
                  color:
                    currentStep > step
                      ? "#10B981"
                      : currentStep === step
                        ? step === 3
                          ? "#3B82F6"
                          : "#F97316"
                        : "#94A3B8",
                }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Form Body */}
      <Box
        sx={{
          bgcolor: "white",
          p: 1,
          flex: 1,
          overflowY: "auto",
          "&::-webkit-scrollbar": { width: "8px" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#CBD5E1",
            borderRadius: "4px",
          },
        }}
      >
        {currentStep === 1 && (
          <Step1
            form={form}
            isCouple={isCouple}
            setIsCouple={setIsCouple}
            assigneeName={assigneeName}
            assigneeOptions={assigneeOptions}
            assigneeLoading={assigneeLoading}
            leadGeneratedByInput={
              selectedLeadGeneratedBy
                ? `${selectedLeadGeneratedBy.first_name} ${selectedLeadGeneratedBy.last_name}`
                : leadGeneratedBySearch
            }
            leadGeneratedByOptions={leadGeneratedByOptions}
            leadGeneratedByLoading={leadGeneratedByLoading}
            selectedLeadGeneratedBy={selectedLeadGeneratedBy}
            campaigns={campaigns}
            leadStatusOptions={leadStatusOptions}
            nextActionStatusOptions={filteredNextActionStatusOptions}
            nextActionTypeOptions={nextActionTypeOptions}
            handleChange={handleChange}
            handleSelectChange={handleSelectChange}
            handleAssigneeInputChange={(value) => {
              setAssigneeSearch(value);
              setAssigneeName(value);
              setForm((prev) => ({ ...prev, assignee: "" }));
            }}
            handleAssigneeChange={(value) => {
              setForm((prev) => ({
                ...prev,
                assignee: value ? String(value.id) : "",
              }));
              setAssigneeName(value ? assigneeLabel(value) : "");
            }}
            handleLeadGeneratedByInputChange={(value) => {
              setLeadGeneratedBySearch(value);
              if (selectedLeadGeneratedBy) setSelectedLeadGeneratedBy(null);
            }}
            handleLeadGeneratedByChange={(value) => {
              if (value) {
                const obj = toLeadGeneratedByObject(value);
                setSelectedLeadGeneratedBy(obj);
                setLeadGeneratedBySearch(assigneeLabel(value));
              } else {
                setSelectedLeadGeneratedBy(null);
                setLeadGeneratedBySearch("");
              }
            }}
            handleCampaignChange={handleCampaignChange}
            handleSourceChange={handleSourceChange}
            handleSubSourceChange={handleSubSourceChange}
            handleLeadStatusChange={handleLeadStatusChange}
            handleNextStatusChange={handleNextStatusChange}
            handleNextTypeChange={handleNextTypeChange}
            handleReferralDepartmentChange={handleReferralDepartmentChange}
            referralDepartments={referralDepartments}
            loadingReferralDepts={loadingReferralDepts}
            dataCaptureFields={resolvedDataCaptureFields}
            dataCaptureValues={dataCaptureValues}
            onDataCaptureChange={(fieldKey, value) => {
              setDataCaptureValues((prev) => ({
                ...prev,
                [fieldKey]: value,
              }));
            }}
          />
        )}
        {currentStep === 2 && (
          <Step2
            form={form}
            setForm={setForm}
            pendingFiles={pendingFiles}
            docDragOver={docDragOver}
            setDocDragOver={setDocDragOver}
            fileInputRef={fileInputRef}
            addFiles={addFiles}
            removeFile={removeFile}
            handleFileInputChange={handleFileInputChange}
            // FIX ERROR 3: Cast interests to the API type since leads.types.Interest
            // is a subset of leads.api.Interest (missing optional 'clinic' field).
            // The runtime data is the same; this is a type-definition divergence.
            interests={interests as unknown as ApiInterest[]}
            loadingInterests={loadingInterests}
          />
        )}
        {currentStep === 3 && (
          <Step3
            form={form}
            setForm={setForm}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            departments={departments}
            loadingDepartments={loadingDepartments}
            loadingEmployees={loadingEmployees}
            personnelInput={appointmentPersonnelInput}
            personnelOptions={appointmentPersonnelOptions}
            personnelLoading={appointmentPersonnelLoading}
            selectedPersonnel={selectedAppointmentPersonnel}
            handlePersonnelInputChange={(value) => {
              setAppointmentPersonnelInput(value);
              setForm((prev) => ({ ...prev, personnel: "" }));
            }}
            handlePersonnelChange={(value) => {
              setForm((prev) => ({
                ...prev,
                personnel: value ? String(value.id) : "",
              }));
              setAppointmentPersonnelInput(value ? personnelLabel(value) : "");
            }}
            handleChange={handleChange}
            handleDepartmentChange={handleDepartmentChange}
          />
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          bgcolor: "white",
          p: 3,
          display: "flex",
          justifyContent: "flex-end",
          gap: 2,
          borderTop: "1px solid #F1F5F9",
        }}
      >
        <Button
          onClick={() => navigate("/leads")}
          sx={{ textTransform: "none", color: "#64748B", fontWeight: 700, px: 3 }}
        >
          Cancel
        </Button>
        {currentStep > 1 && (
          <Button
            onClick={handleBack}
            variant="outlined"
            disabled={isSubmitting}
            sx={{
              textTransform: "none",
              borderColor: "#E2E8F0",
              color: "#1E293B",
              fontWeight: 700,
              px: 3,
              "&:hover": { borderColor: "#CBD5E1" },
            }}
          >
            Back
          </Button>
        )}
        {currentStep < 3 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{
              bgcolor: "#334155",
              textTransform: "none",
              fontWeight: 700,
              px: 4,
              "&:hover": { bgcolor: "#1E293B" },
            }}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={isSubmitting}
            sx={{
              bgcolor: "#334155",
              textTransform: "none",
              fontWeight: 700,
              px: 4,
              minWidth: "100px",
              "&:hover": { bgcolor: "#1E293B" },
            }}
          >
            {isSubmitting ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              "Save"
            )}
          </Button>
        )}
      </Box>
    </Paper>
  );
}