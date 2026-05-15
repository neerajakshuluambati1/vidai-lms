import * as React from "react";
import {
  Box,
  Alert,
  Stack,
  Typography,
  IconButton,
  Button,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import ExcelJS from "exceljs";

import Filter_Leads from "../assets/icons/Filter_Leads.svg";
import Leads_Gridview from "../assets/icons/Leads_Gridview.svg";
import Leads_Tableview_icon from "../assets/icons/Leads_Tableview_icon.svg";

import type { FilterValues } from "../types/leads.types";
import { api, DepartmentAPI, LeadAPI } from "../services/leads.api";
import type { Department, Lead, LeadPayload } from "../services/leads.api";
import { pipelineApi, type Pipeline } from "../services/pipeline.api";

import { fetchLeads, selectLeads } from "../store/leadSlice";
import {
  fetchClinic,
  selectClinic,
  selectClinicLoading,
} from "../store/clinicSlice";
import { selectAuthed, selectUser } from "../store/authSlice";
import type { AppDispatch } from "../store";
import {
  hasAnySubcategoryActionPermission,
  resolveUserRole,
} from "../utils/roleAccess";
import "../styles/Leads/leads.css";

// ── Storage keys — filters intentionally excluded ─────────────────────────────
// STORAGE_KEY_FILTERS removed: filters must not survive a page refresh
const STORAGE_KEY_TAB = "leads_active_tab";
const STORAGE_KEY_VIEW = "leads_view_mode";

interface HeaderMatch {
  tableHeader: string;
  importedHeader: string;
  payloadKey:
    | keyof LeadPayload
    | "assigned_to_name"
    | "department_name"
    | "import_note";
}

interface ImportedRow {
  rowNumber: number;
  values: Record<string, string>;
}

const IMPORT_FIELD_CONFIGS: Array<{
  payloadKey:
    | keyof LeadPayload
    | "assigned_to_name"
    | "department_name"
    | "import_note";
  tableHeader: string;
  aliases: string[];
}> = [
  {
    payloadKey: "full_name",
    tableHeader: "Lead Name | No",
    aliases: ["lead name", "full name", "name", "lead_name", "full_name"],
  },
  {
    payloadKey: "contact_no",
    tableHeader: "Lead Name | No",
    aliases: [
      "lead no",
      "lead number",
      "contact no",
      "contact number",
      "phone",
      "phone number",
      "mobile",
      "mobile number",
      "contact_no",
    ],
  },
  {
    payloadKey: "location",
    tableHeader: "Location",
    aliases: ["location", "city", "area"],
  },
  {
    payloadKey: "source",
    tableHeader: "Source",
    aliases: ["source", "lead source"],
  },
  {
    payloadKey: "lead_status",
    tableHeader: "Lead Status",
    aliases: ["lead status", "status", "lead_status"],
  },
  {
    payloadKey: "assigned_to_name",
    tableHeader: "Assigned To",
    aliases: ["assigned to", "assignee", "owner", "assigned_to"],
  },
  {
    payloadKey: "department_name",
    tableHeader: "Department",
    aliases: ["department", "department name", "department_name"],
  },
  {
    payloadKey: "email",
    tableHeader: "Email",
    aliases: ["email", "mail", "email address"],
  },
  {
    payloadKey: "treatment_interest",
    tableHeader: "Treatment Interest",
    aliases: ["treatment interest", "treatment", "service", "interest"],
  },
  {
    payloadKey: "appointment_date",
    tableHeader: "Date | Time",
    aliases: [
      "appointment date",
      "date",
      "date time",
      "created at",
      "created_at",
    ],
  },
  {
    payloadKey: "slot",
    tableHeader: "Date | Time",
    aliases: ["slot", "time", "appointment time"],
  },
  {
    payloadKey: "remark",
    tableHeader: "Activity",
    aliases: ["remark", "remarks", "activity"],
  },
  {
    payloadKey: "import_note",
    tableHeader: "Notes",
    aliases: ["note", "notes", "lead note", "lead notes"],
  },
  { payloadKey: "address", tableHeader: "Address", aliases: ["address"] },
];

const parseCsvRow = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
};

const normalizeHeader = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\|/g, " ")
    .replace(/_/g, " ")
    .replace(/\//g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLeadStatus = (value: string): "new" | "contacted" => {
  const normalized = value.toLowerCase().trim();
  if (
    normalized.includes("contact") ||
    normalized.includes("follow") ||
    normalized.includes("appoint") ||
    normalized.includes("convert") ||
    normalized.includes("lost")
  ) {
    return "contacted";
  }
  return "new";
};

const normalizeStatusFilterValue = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[_\s-]+/g, "-");

const sanitizeImportedEmail = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(normalized) ? normalized : null;
};

const formatDateParts = (
  year: number,
  month: number,
  day: number,
): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const normalizeImportedDate = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  if (/^\d{5}(?:\.\d+)?$/.test(normalized)) {
    const serial = Number(normalized);
    if (!Number.isNaN(serial)) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const date = new Date(
        excelEpoch + Math.round(serial) * 24 * 60 * 60 * 1000,
      );
      return Number.isNaN(date.getTime())
        ? null
        : date.toISOString().slice(0, 10);
    }
  }

  const dateOnly = normalized.split("T")[0].split(" ")[0].trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return formatDateParts(year, month, day);
  }

  const slashOrDashMatch = dateOnly.match(
    /^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/,
  );
  if (slashOrDashMatch) {
    const first = Number(slashOrDashMatch[1]);
    const second = Number(slashOrDashMatch[2]);
    const third = Number(slashOrDashMatch[3]);

    if (slashOrDashMatch[1].length === 4) {
      return formatDateParts(first, second, third);
    }

    if (slashOrDashMatch[3].length === 4) {
      return formatDateParts(third, second, first);
    }
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
};

const LeadsTable = React.lazy(
  () => import("../components/LeadsHub/LeadsTable"),
);
const LeadsBoard = React.lazy(
  () => import("../components/LeadsHub/LeadsBoard"),
);
const LeadsConversation = React.lazy(
  () => import("../components/LeadsHub/LeadsConversation"),
);
const Activity = React.lazy(() => import("../components/LeadsHub/Activity"));
const FilterDialog = React.lazy(
  () => import("../components/LeadsHub/FilterDialog"),
);
const LeadsFollowUp = React.lazy(
  () => import("../components/LeadsHub/LeadsFollowUp"),
);
const LeadsCalendar = React.lazy(
  () => import("../components/LeadsHub/LeadsCalendar"),
);
const LeadsImportButton = React.lazy(
  () => import("../components/LeadsHub/LeadsImportButton"),
);
const LeadsBulkImportModal = React.lazy(
  () => import("../components/LeadsHub/LeadsBulkImportModal"),
);

// ── Empty filter default — always the starting point after refresh ────────────
const defaultFilters = (): FilterValues => ({
  department: "",
  assignee: "",
  status: "",
  quality: "",
  source: "",
  subSource: "",
  dateFrom: null,
  dateTo: null,
});

const loadSavedTab = (): number => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TAB);
    if (saved) return parseInt(saved, 10);
  } catch (error) {
    console.error("Failed to load saved tab:", error);
  }
  return 0;
};

const loadSavedViewMode = (): "table" | "board" => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW);
    if (saved === "board" || saved === "table") return saved;
  } catch (error) {
    console.error("Failed to load saved view mode:", error);
  }
  return "table";
};

const Leads: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const leads = useSelector(selectLeads);
  const clinic = useSelector(selectClinic);
  const clinicLoading = useSelector(selectClinicLoading);
  const user = useSelector(selectUser);
  const authed = useSelector(selectAuthed);
  const authUser = user as unknown as Record<string, unknown> | null;
  const nestedAuthUser =
    authUser?.user && typeof authUser.user === "object"
      ? (authUser.user as Record<string, unknown>)
      : null;
  const role = resolveUserRole(authUser);
  const permissions = authUser?.permissions ?? nestedAuthUser?.permissions;
  const leadAliases = React.useMemo(() => ["leads hub"], []);
  const canViewLeads =
    role === "super_admin" ||
    hasAnySubcategoryActionPermission(permissions, leadAliases, "view") ||
    hasAnySubcategoryActionPermission(permissions, leadAliases, "print");
  const canAddLeads =
    role === "super_admin" ||
    hasAnySubcategoryActionPermission(permissions, leadAliases, "add");
  const canEditLeads =
    role === "super_admin" ||
    hasAnySubcategoryActionPermission(permissions, leadAliases, "edit");

  React.useEffect(() => {
    if (canViewLeads) return;

    console.warn("Leads permission debug", {
      role,
      hasTopLevelPermissions: Boolean(authUser?.permissions),
      hasNestedPermissions: Boolean(nestedAuthUser?.permissions),
      aliases: leadAliases,
      canViewLeads,
      canAddLeads,
      canEditLeads,
      permissions,
    });
  }, [
    canViewLeads,
    role,
    authUser?.permissions,
    nestedAuthUser?.permissions,
    leadAliases,
    canAddLeads,
    canEditLeads,
    permissions,
  ]);

  const [tab, setTab] = React.useState(loadSavedTab());
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"table" | "board">(
    loadSavedViewMode(),
  );

  // ── Filters: always start empty on every page load / refresh ─────────────
  const [activeFilters, setActiveFilters] = React.useState<FilterValues>(defaultFilters);

  const [counts, setCounts] = React.useState({
    all: 0,
    followUps: 0,
    archived: 0,
  });
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [importedLeads, setImportedLeads] = React.useState<Lead[]>([]);
  const [isSavingImport, setIsSavingImport] = React.useState(false);
  const [availablePipelines, setAvailablePipelines] = React.useState<
    Pipeline[]
  >([]);
<<<<<<< Updated upstream
  const [selectedIndustry, setSelectedIndustry] = React.useState<string>(
    localStorage.getItem(STORAGE_KEY_SELECTED_INDUSTRY) ?? "",
  );
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string>(
    localStorage.getItem(STORAGE_KEY_SELECTED_PIPELINE) ?? "",
  );
=======
  const [selectedPipelineOverrideId, setSelectedPipelineOverrideId] =
    React.useState("");
>>>>>>> Stashed changes
  const attemptedClinicHydrationRef = React.useRef<Set<number>>(new Set());
  const tabScrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateTabScrollState = React.useCallback(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  React.useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    updateTabScrollState();
    el.addEventListener("scroll", updateTabScrollState);
    const ro = new ResizeObserver(updateTabScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateTabScrollState);
      ro.disconnect();
    };
  }, [updateTabScrollState]);

  const scrollTabs = React.useCallback((dir: "left" | "right") => {
    const el = tabScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });
  }, []);

  const activePipeline = React.useMemo(
<<<<<<< Updated upstream
    () => {
      const persistedPipelineId =
        localStorage.getItem(STORAGE_KEY_DEFAULT_PIPELINE) ??
        localStorage.getItem(STORAGE_KEY_SELECTED_PIPELINE) ??
        "";

      return (
        availablePipelines.find((pipeline) => pipeline.id === persistedPipelineId) ??
        availablePipelines.find((pipeline) => pipeline.is_active) ??
        availablePipelines[0] ??
        null
      );
    },
    [availablePipelines],
  );

  const resolvedPipelineId = activePipeline?.id ?? selectedPipelineId;
=======
    () =>
      availablePipelines.find((pipeline) => pipeline.is_active) ??
      availablePipelines[0] ??
      null,
    [availablePipelines],
  );

  const selectedPipeline = React.useMemo(() => {
    if (availablePipelines.length === 0) return null;

    if (selectedPipelineOverrideId) {
      return (
        availablePipelines.find(
          (pipeline) => pipeline.id === selectedPipelineOverrideId,
        ) ?? activePipeline
      );
    }

    return activePipeline;
  }, [activePipeline, availablePipelines, selectedPipelineOverrideId]);

  const selectedPipelineId = selectedPipeline?.id ?? "";

  React.useEffect(() => {
    if (availablePipelines.length === 0) {
      if (selectedPipelineOverrideId) {
        setSelectedPipelineOverrideId("");
      }
      return;
    }

    const hasSelectedPipeline = availablePipelines.some(
      (pipeline) => pipeline.id === selectedPipelineOverrideId,
    );

    if (selectedPipelineOverrideId && hasSelectedPipeline) {
      return;
    }

    const nextPipelineId =
      availablePipelines.find((pipeline) => pipeline.is_active)?.id ??
      availablePipelines[0]?.id ??
      "";

    if (nextPipelineId !== selectedPipelineOverrideId) {
      setSelectedPipelineOverrideId(nextPipelineId);
    }
  }, [availablePipelines, selectedPipelineOverrideId]);
>>>>>>> Stashed changes

  const applyFilters = React.useCallback(
    (leadsToFilter: Array<Lead & { status?: string }>) => {
      return leadsToFilter.filter((lead) => {
        if (
          activeFilters.department &&
          lead.department_id !== Number(activeFilters.department)
        )
          return false;
        if (
          activeFilters.assignee &&
          lead.assigned_to_id !== Number(activeFilters.assignee)
        )
          return false;
        if (activeFilters.status) {
          const leadStatus = normalizeStatusFilterValue(
            lead.lead_status || lead.status || "",
          );
          const filterStatus = normalizeStatusFilterValue(activeFilters.status);
          const equivalentStatuses: Record<string, string[]> = {
            new: ["new"],
            contacted: ["contacted"],
            "follow-ups": [
              "follow-ups",
              "follow-up",
              "followup",
              "follow-up-leads",
              "follow-up-lead",
              "follow-up",
            ],
            converted: ["converted", "converted-lead", "converted-leads"],
            lost: ["lost", "lost-lead", "lost-leads"],
            "cycle-conversion": ["cycle-conversion", "cycleconversion"],
            appointment: ["appointment", "appointments"],
          };
          const allowed = equivalentStatuses[filterStatus] ?? [filterStatus];
          if (!allowed.includes(leadStatus)) return false;
        }
        if (activeFilters.quality) {
          const hasAssignee = Boolean(
            lead.assigned_to_id || lead.assigned_to_name,
          );
          const hasNextAction = Boolean(
            lead.next_action_description &&
            lead.next_action_description.trim() !== "",
          );
          const nextActionPending = lead.next_action_status === "pending";
          let leadQuality = "Cold";
          if (hasAssignee && hasNextAction && nextActionPending)
            leadQuality = "Hot";
          else if (hasAssignee || hasNextAction) leadQuality = "Warm";
          if (leadQuality !== activeFilters.quality) return false;
        }
        if (activeFilters.source && lead.source !== activeFilters.source)
          return false;
        if (activeFilters.dateFrom || activeFilters.dateTo) {
          const leadDate = lead.created_at ? new Date(lead.created_at) : null;
          if (!leadDate) return false;
          if (activeFilters.dateFrom) {
            const fromDate = new Date(activeFilters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (leadDate < fromDate) return false;
          }
          if (activeFilters.dateTo) {
            const toDate = new Date(activeFilters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (leadDate > toDate) return false;
          }
        }
        return true;
      });
    },
    [activeFilters],
  );

  // ── Removed: useEffect that wrote activeFilters to localStorage ───────────
  // Filters are session-only; they must not persist across page refreshes.

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TAB, tab.toString());
    } catch (error) {
      console.error("Failed to save tab:", error);
    }
  }, [tab]);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, viewMode);
    } catch (error) {
      console.error("Failed to save view mode:", error);
    }
  }, [viewMode]);

  const clinicIdsToHydrate = React.useMemo(() => {
    const clinics = user?.clinics ?? [];
    const defaultId = clinics.find(
      (clinicItem) => clinicItem.is_default,
    )?.clinic_id;
    const storedClinicId = Number(localStorage.getItem("clinic_id") || 0) || null;
    const ordered = [
      clinic?.id,
      storedClinicId,
      defaultId,
      ...clinics.map((clinicItem) => clinicItem.clinic_id),
    ].filter((id): id is number => typeof id === "number" && id > 0);

    const unique = Array.from(new Set(ordered));
    return unique;
  }, [clinic?.id, user]);

  React.useEffect(() => {
    if (
      !authed ||
      !user ||
      clinic ||
      clinicLoading ||
      clinicIdsToHydrate.length === 0
    )
      return;

    let cancelled = false;

    const hydrateClinic = async () => {
      for (const clinicId of clinicIdsToHydrate) {
        if (cancelled || attemptedClinicHydrationRef.current.has(clinicId))
          continue;

        attemptedClinicHydrationRef.current.add(clinicId);
        const action = await dispatch(fetchClinic(clinicId));

        if (fetchClinic.fulfilled.match(action)) {
          return;
        }
      }
    };

    void hydrateClinic();

    return () => {
      cancelled = true;
    };
  }, [authed, user, clinic, clinicLoading, clinicIdsToHydrate, dispatch]);

  React.useEffect(() => {
    if (!canViewLeads) return;
    dispatch(fetchLeads());
  }, [canViewLeads, dispatch, clinic?.id, user?.id]);

  React.useEffect(() => {
    const fetchPipelinesForLeads = async () => {
      const clinicId = Number(
        clinic?.id ?? localStorage.getItem("clinic_id") ?? 0,
      );
      if (!clinicId || !canViewLeads) {
        setAvailablePipelines([]);
        return;
      }
      try {
        const pipelines = await pipelineApi.list(clinicId);
        setAvailablePipelines(pipelines);
      } catch {
        setAvailablePipelines([]);
      }
    };
    void fetchPipelinesForLeads();
  }, [canViewLeads, clinic?.id]);

  React.useEffect(() => {
<<<<<<< Updated upstream
    localStorage.setItem(STORAGE_KEY_SELECTED_INDUSTRY, selectedIndustry);
  }, [selectedIndustry]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SELECTED_PIPELINE, selectedPipelineId);
  }, [selectedPipelineId]);

  React.useEffect(() => {
    const persistedSelectedPipelineId =
      localStorage.getItem(STORAGE_KEY_DEFAULT_PIPELINE) ??
      localStorage.getItem(STORAGE_KEY_SELECTED_PIPELINE) ??
      "";

    const persistedPipeline = persistedSelectedPipelineId
      ? availablePipelines.find(
          (pipeline) => pipeline.id === persistedSelectedPipelineId,
        ) ?? null
      : null;

    const resolvedPipeline = persistedPipeline ?? activePipeline;

    if (!resolvedPipeline) {
      if (selectedPipelineId) {
        setSelectedPipelineId("");
      }
      if (selectedIndustry) {
        setSelectedIndustry("");
      }
      return;
    }

    if (selectedPipelineId !== resolvedPipeline.id) {
      setSelectedPipelineId(resolvedPipeline.id);
    }
    if (selectedIndustry !== resolvedPipeline.industry_type) {
      setSelectedIndustry(resolvedPipeline.industry_type);
    }
  }, [activePipeline, availablePipelines, selectedIndustry, selectedPipelineId]);

  React.useEffect(() => {
=======
>>>>>>> Stashed changes
    void import("../components/LeadsHub/LeadsCalendar");
  }, []);

  const waitingForContext = React.useMemo(() => {
    if (!authed) return false;
    if (!user) return true;
    if (clinicLoading) return true;
    return false;
  }, [authed, user, clinicLoading]);

  React.useEffect(() => {
    if (leads && leads.length > 0) {
      const followUpStatuses = ["new", "lost", "cycle conversion", "follow up", "follow-up", "followup", "follow ups", "follow-ups"];
      const filteredLeads = applyFilters(leads);
      const allCount = filteredLeads.filter(
        (l) => l.is_active !== false,
      ).length;
      const followUpCount = filteredLeads.filter((l) => {
        const status = (l.lead_status || l.status || "").toLowerCase().trim();
        return l.is_active !== false && followUpStatuses.includes(status);
      }).length;
      const archivedCount = filteredLeads.filter(
        (l) => l.is_active === false,
      ).length;
      setCounts({
        all: allCount,
        followUps: followUpCount,
        archived: archivedCount,
      });
      console.log("📊 Counts updated:", {
        all: allCount,
        followUps: followUpCount,
        archived: archivedCount,
        total: filteredLeads.length,
      });
    } else {
      setCounts({ all: 0, followUps: 0, archived: 0 });
    }
  }, [leads, applyFilters]);

  const handleApplyFilters = (filters: FilterValues) => {
    console.log("🔍 Applying filters to leads:", filters);
    setActiveFilters(filters);
  };

  const activeFilterCount = React.useMemo(() => {
    return Object.values(activeFilters).filter((v) => v !== "" && v !== null)
      .length;
  }, [activeFilters]);

  const tabs = [
    { label: "All Leads", count: counts.all },
    { label: "Follow-Ups", count: counts.followUps },
    { label: "Archived Leads", count: counts.archived },
    { label: "Leads Conversation", count: null },
    { label: "Activity", count: null },
    { label: "Calendar", count: null },
  ];

  const saveImportedRowsToDb = React.useCallback(
    async (rows: ImportedRow[], headerMatches: HeaderMatch[]) => {
      if (headerMatches.length === 0 || rows.length === 0) {
        return {
          createdLeads: [] as Lead[],
          failedCount: 0,
          noteFailedCount: 0,
        };
      }

      const clinicId =
        clinic?.id ??
        (Number(localStorage.getItem("clinic_id") || 0) ||
          leads[0]?.clinic_id ||
          1);

      let departments: Department[] = [];
      try {
        departments = await DepartmentAPI.listActiveByClinic(clinicId);
      } catch {
        departments = [];
      }

      const defaultDepartmentId =
        departments[0]?.id ?? leads[0]?.department_id ?? 1;
      const departmentByName = new Map(
        departments.map((department) => [
          normalizeHeader(department.name),
          department.id,
        ]),
      );
      const sourceHeaderByPayloadKey = new Map(
        headerMatches.map((match) => [match.payloadKey, match.importedHeader]),
      );
      const getValue = (
        row: ImportedRow,
        payloadKey: HeaderMatch["payloadKey"],
      ): string => {
        const sourceHeader = sourceHeaderByPayloadKey.get(payloadKey);
        return sourceHeader
          ? String(row.values[sourceHeader] ?? "").trim()
          : "";
      };

      const createdLeads: Lead[] = [];
      let failedCount = 0;
      let noteFailedCount = 0;

      for (const row of rows) {
        const departmentName = getValue(row, "department_name");
        const resolvedDepartmentId =
          departmentByName.get(normalizeHeader(departmentName)) ??
          defaultDepartmentId;
        const appointmentDate = normalizeImportedDate(
          getValue(row, "appointment_date"),
        );
        const slot = getValue(row, "slot");
        const importedNote = getValue(row, "import_note");
        const hasAppointmentDetails = Boolean(appointmentDate && slot);
        const sanitizedEmail = sanitizeImportedEmail(getValue(row, "email"));

        const payload: LeadPayload = {
          clinic_id: clinicId,
          department_id: resolvedDepartmentId,
          full_name: getValue(row, "full_name") || "Unknown Lead",
          contact_no: getValue(row, "contact_no") || "0000000000",
          email: sanitizedEmail,
          location: getValue(row, "location") || "",
          address: getValue(row, "address") || "",
          source: getValue(row, "source") || "Direct",
          treatment_interest: getValue(row, "treatment_interest") || "General",
          appointment_date: appointmentDate || null,
          slot: slot || "",
          remark: getValue(row, "remark") || "",
          partner_inquiry: false,
          book_appointment: hasAppointmentDetails,
          is_active: true,
          lead_status: normalizeLeadStatus(getValue(row, "lead_status")),
          assigned_to_id: null,
          personal_id: null,
          campaign_id: null,
          age: null,
          marital_status: null,
          next_action_status: null,
        };

        try {
          const createdLead = await LeadAPI.create(payload);
          if (importedNote) {
            try {
              await api.post("/leads/notes/", {
                title: "Imported Note",
                note: importedNote,
                lead: createdLead.id,
                is_active: true,
                is_deleted: false,
              });
            } catch {
              noteFailedCount += 1;
            }
          }

          createdLeads.push({
            ...createdLead,
            created_at: appointmentDate || createdLead.created_at,
          });
        } catch {
          failedCount += 1;
        }
      }

      return { createdLeads, failedCount, noteFailedCount };
    },
    [clinic?.id, leads],
  );

  const importSingleFile = React.useCallback(
    async (file: File) => {
      const isExcelFile = /\.(xlsx|xls)$/i.test(file.name);
      const isCsvFile = /\.csv$/i.test(file.name);
      if (!isExcelFile && !isCsvFile) {
        toast.error("Please select a valid file (.xlsx, .xls, or .csv).");
        return {
          createdLeads: [] as Lead[],
          failedCount: 0,
          noteFailedCount: 0,
        };
      }

      try {
        let sourceHeaders: string[] = [];
        let parsedRows: ImportedRow[] = [];

        if (isCsvFile) {
          const text = await file.text();
          const lines = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          sourceHeaders = parseCsvRow(lines[0] ?? "")
            .map((value: string) => value.trim().replace(/^"|"$/g, ""))
            .filter((value: string) => value.length > 0);

          parsedRows = lines.slice(1).map((line: string, index: number) => {
            const columns = parseCsvRow(line).map((value: string) =>
              value.trim().replace(/^"|"$/g, ""),
            );

            const values = sourceHeaders.reduce<Record<string, string>>(
              (accumulator, header, headerIndex) => {
                accumulator[header] = String(columns[headerIndex] ?? "").trim();
                return accumulator;
              },
              {},
            );

            return {
              rowNumber: index + 2,
              values,
            };
          });
        } else {
          if (/\.xls$/i.test(file.name)) {
            toast.error(
              "Old .xls files are not supported here. Please use .xlsx or .csv.",
            );
            return {
              createdLeads: [] as Lead[],
              failedCount: 0,
              noteFailedCount: 0,
            };
          }

          const buffer = await file.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);

          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            toast.error("No worksheet found in the selected file.");
            return {
              createdLeads: [] as Lead[],
              failedCount: 0,
              noteFailedCount: 0,
            };
          }

          const firstRow = worksheet.getRow(1);
          const rowValues = Array.isArray(firstRow.values)
            ? firstRow.values
            : [];
          sourceHeaders = rowValues
            .slice(1)
            .map((value: unknown) => String(value ?? "").trim())
            .filter((value: string) => value.length > 0);

          parsedRows = [];
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            const rowRecord = sourceHeaders.reduce<Record<string, string>>(
              (accumulator, header, index) => {
                accumulator[header] = String(values[index] ?? "").trim();
                return accumulator;
              },
              {},
            );

            const hasData = Object.values(rowRecord).some(
              (value) => value.length > 0,
            );
            if (hasData) {
              parsedRows.push({ rowNumber, values: rowRecord });
            }
          });
        }

        const normalizedSourceHeaders = new Map(
          sourceHeaders.map((header) => [normalizeHeader(header), header]),
        );
        const matched = IMPORT_FIELD_CONFIGS.map((config) => {
          const matchedSourceHeader = config.aliases
            .map((alias) => normalizedSourceHeaders.get(normalizeHeader(alias)))
            .find((value) => Boolean(value));

          if (!matchedSourceHeader) return null;

          return {
            tableHeader: config.tableHeader,
            importedHeader: matchedSourceHeader,
            payloadKey: config.payloadKey,
          } satisfies HeaderMatch;
        }).filter((value): value is HeaderMatch => value !== null);

        if (matched.length > 0) {
          return await saveImportedRowsToDb(parsedRows, matched);
        }

        toast.info(`No matching headers found for ${file.name}.`);
        return {
          createdLeads: [] as Lead[],
          failedCount: 0,
          noteFailedCount: 0,
        };
      } catch {
        toast.error(`Failed to read imported file: ${file.name}`);
        return {
          createdLeads: [] as Lead[],
          failedCount: 0,
          noteFailedCount: 0,
        };
      }
    },
    [saveImportedRowsToDb],
  );

  const handleImportFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsSavingImport(true);

      const allCreatedLeads: Lead[] = [];
      let totalFailed = 0;
      let totalNoteFailed = 0;

      for (const file of files) {
        const { createdLeads, failedCount, noteFailedCount } =
          await importSingleFile(file);
        allCreatedLeads.push(...createdLeads);
        totalFailed += failedCount;
        totalNoteFailed += noteFailedCount;
      }

      if (allCreatedLeads.length > 0) {
        setImportedLeads((current) => [...allCreatedLeads, ...current]);
        await dispatch(fetchLeads());
      }

      if (
        allCreatedLeads.length > 0 &&
        totalFailed === 0 &&
        totalNoteFailed === 0
      ) {
        toast.success(
          `${allCreatedLeads.length} leads imported and saved to DB.`,
        );
      } else if (
        allCreatedLeads.length > 0 &&
        totalFailed === 0 &&
        totalNoteFailed > 0
      ) {
        toast.warning(
          `${allCreatedLeads.length} leads saved, but ${totalNoteFailed} imported notes could not be saved.`,
        );
      } else if (allCreatedLeads.length > 0) {
        toast.warning(
          `${allCreatedLeads.length} leads saved, ${totalFailed} failed.`,
        );
      } else {
        toast.error("No imported rows could be saved.");
      }

      setIsSavingImport(false);
    },
    [dispatch, importSingleFile],
  );

  return (
    <Box className="leads-page">
      {!canViewLeads && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You do not have permission to view leads.
        </Alert>
      )}
      {/* HEADER */}
      <Stack
        className="leads-header"
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
        sx={{
          mb: 3,
          flexWrap: "wrap",
          minWidth: 0,
          width: "100%",
          gap: 2,
        }}
      >
        <Typography className="leads-title" sx={{ flexShrink: 0, minWidth: 0 }}>
          Leads Hub
        </Typography>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            flexShrink: 1,
            flexWrap: "wrap",
            width: { xs: "100%", lg: "auto" },
            rowGap: 1.25,
            columnGap: 1.25,
          }}
        >
          {/* Search */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              width: { xs: "100%", sm: 320, lg: 300 },
              minWidth: { xs: 0, sm: 200 },
              height: 40,
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              backgroundColor: "#FFFFFF",
              paddingLeft: "10px",
              paddingRight: "10px",
              gap: "6px",
              flex: { xs: "1 1 100%", sm: "1 1 240px", lg: "0 1 auto" },
              "&:hover": { border: "1px solid #D1D5DB" },
              "&:focus-within": { border: "1px solid #9CA3AF" },
            }}
          >
            <SearchIcon
              sx={{ color: "#9CA3AF", width: 18, height: 18, flexShrink: 0 }}
            />
            <input
              type="text"
              placeholder="Search by Lead name / Lead No"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "13px",
                fontFamily: "Nunito, sans-serif",
                color: "#111827",
                width: "100%",
                height: "100%",
              }}
            />
          </Box>

          {/* View Mode Toggle */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              overflow: "hidden",
              bgcolor: "#F9FAFB",
            }}
          >
            <IconButton
              onClick={() => setViewMode("table")}
              title="Table view"
              sx={{
                borderRadius: 0,
                width: 38,
                height: 38,
                bgcolor: viewMode === "table" ? "#E5E7EB" : "transparent",
                "&:hover": {
                  bgcolor: viewMode === "table" ? "#D1D5DB" : "#F3F4F6",
                },
                transition: "background-color 0.15s ease",
              }}
            >
              <img
                src={Leads_Tableview_icon}
                style={{ width: 18, height: 18 }}
                alt="Table view"
              />
            </IconButton>

            <Box sx={{ width: "1px", height: 20, bgcolor: "#E5E7EB", flexShrink: 0 }} />

            <IconButton
              onClick={() => setViewMode("board")}
              title="Board view"
              sx={{
                borderRadius: 0,
                width: 38,
                height: 38,
                bgcolor: viewMode === "board" ? "#E5E7EB" : "transparent",
                "&:hover": {
                  bgcolor: viewMode === "board" ? "#D1D5DB" : "#F3F4F6",
                },
                transition: "background-color 0.15s ease",
              }}
            >
              <img
                src={Leads_Gridview}
                style={{ width: 22, height: 22 }}
                alt="Board view"
              />
            </IconButton>
          </Box>

          {/* Filter Button */}
          <Box sx={{ position: "relative", flexShrink: 0 }}>
            <IconButton
              className="filter-icon-btn"
              onClick={() => setFilterOpen(true)}
              title="Open filters"
            >
              <img src={Filter_Leads} alt="Filter" />
            </IconButton>
            {activeFilterCount > 0 && (
              <Box className="filter-badge">{activeFilterCount}</Box>
            )}
          </Box>

          <React.Suspense fallback={null}>
            <LeadsImportButton
              onClick={() => setIsImportModalOpen(true)}
              disabled={isSavingImport || !canAddLeads}
            />
          </React.Suspense>

          {/* Add New Lead */}
          <Button
            className="add-lead-btn"
            onClick={() => {
              navigate("/leads/add");
            }}
            disabled={!canAddLeads}
            sx={{
              flexShrink: 0,
              width: { xs: "100%", sm: "auto" },
              ml: { xs: 0, sm: "auto", lg: 0 },
            }}
          >
            + Add New Lead
          </Button>
        </Stack>
      </Stack>

      {/* PILL TABS */}
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1}
        sx={{
          mb: 1,
          justifyContent: "space-between",
          alignItems: { xs: "stretch", lg: "center" },
          minHeight: 40,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            minWidth: 0,
            position: "relative",
          }}
        >
          <Box
            className="tab-scroll-arrow tab-scroll-arrow-left"
            onClick={() => scrollTabs("left")}
            sx={{
              display: { xs: canScrollLeft ? "flex" : "none", lg: "none" },
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 28,
              flexShrink: 0,
              cursor: "pointer",
              color: "#6B7280",
              "&:hover": { color: "#EA580C" },
            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </Box>

          <Box
            ref={tabScrollRef}
            className="pill-tabs-scroll"
            sx={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              overflowX: "auto",
              flex: 1,
              minWidth: 0,
              alignItems: "center",
              pb: { xs: "3px", lg: 0 },
            }}
          >
            {tabs.map((tabItem, index) => (
              <Button
                key={tabItem.label}
                className={`pill-tab ${tab === index ? "active" : ""}`}
                onClick={() => setTab(index)}
                sx={{ flexShrink: 0 }}
              >
                {tabItem.label}
                {typeof tabItem.count === "number" ? ` (${tabItem.count})` : ""}
              </Button>
            ))}
          </Box>

          <Box
            className="tab-scroll-arrow tab-scroll-arrow-right"
            onClick={() => scrollTabs("right")}
            sx={{
              display: { xs: canScrollRight ? "flex" : "none", lg: "none" },
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 28,
              flexShrink: 0,
              cursor: "pointer",
              color: "#6B7280",
              "&:hover": { color: "#EA580C" },
            }}
          >
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>

        {/* PIPELINE STATUS */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{
            justifyContent: { sm: "flex-end" },
            minWidth: { lg: 292 },
            flexShrink: 1,
            width: { xs: "100%", lg: "auto" },
            alignItems: { xs: "stretch", sm: "center" },
            position: "relative",
            zIndex: 5,
            flexWrap: { xs: "wrap", lg: "nowrap" },
          }}
        >
          <Box
            sx={{
              width: { xs: "100%", sm: "auto" },
              minHeight: 34,
              px: 1.25,
              display: "flex",
              alignItems: "center",
              border: "1px solid #D0D5DD",
              borderRadius: 1,
              backgroundColor: "#fff",
              color: "#344054",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
<<<<<<< Updated upstream
            Default Pipeline: {activePipeline?.pipeline_name ?? "Not configured"}
=======
            Pipeline in use: {selectedPipeline?.pipeline_name ?? "Not configured"}
          </Box>

          <Box
            sx={{
              width: { xs: "100%", sm: "auto" },
              minWidth: { sm: 220 },
              minHeight: 34,
              px: 1,
              display: "flex",
              alignItems: "center",
              border: "1px solid #D0D5DD",
              borderRadius: 1,
              backgroundColor: "#fff",
            }}
          >
            <select
              value={selectedPipelineId}
              onChange={(event) => {
                setSelectedPipelineOverrideId(event.target.value);
              }}
              disabled={availablePipelines.length <= 1}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                fontSize: "13px",
                fontWeight: 600,
                color: "#344054",
                cursor: availablePipelines.length <= 1 ? "not-allowed" : "pointer",
              }}
            >
              {availablePipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.pipeline_name}
                  {pipeline.is_active ? " (Active)" : ""}
                </option>
              ))}
            </select>
>>>>>>> Stashed changes
          </Box>
        </Stack>
      </Stack>

      {/* CONTENT */}
      {!canViewLeads ? null : waitingForContext ? (
        <Box
          sx={{
            minHeight: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <CircularProgress size={22} />
          <Typography variant="body2" color="text.secondary">
            Loading clinic and leads context...
          </Typography>
        </Box>
      ) : (
        <React.Suspense
          fallback={
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary">
                Loading...
              </Typography>
            </Box>
          }
        >
          {tab === 1 && (
            <LeadsFollowUp
              search={search}
              filters={activeFilters}
              canEditLeads={canEditLeads}
            />
          )}
          {tab === 3 && <LeadsConversation />}
          {tab === 4 && <Activity />}
          {tab === 5 && (
            <LeadsCalendar
              leads={leads}
              search={search}
              filters={activeFilters}
            />
          )}
          {tab !== 1 &&
            tab !== 3 &&
            tab !== 4 &&
            tab !== 5 &&
            (viewMode === "table" ? (
              <LeadsTable
                search={search}
                tab={tab === 2 ? "archived" : "active"}
                filters={activeFilters}
                importedLeads={tab === 0 ? importedLeads : []}
                canEditLeads={canEditLeads}
<<<<<<< Updated upstream
                selectedIndustry={selectedIndustry}
                selectedPipelineId={resolvedPipelineId}
=======
                selectedPipelineId={selectedPipelineId}
>>>>>>> Stashed changes
              />
            ) : (
              <LeadsBoard
                search={search}
                filters={activeFilters}
                canEditLeads={canEditLeads}
<<<<<<< Updated upstream
                selectedIndustry={selectedIndustry}
                selectedPipelineId={resolvedPipelineId}
=======
                selectedPipelineId={selectedPipelineId}
>>>>>>> Stashed changes
              />
            ))}
        </React.Suspense>
      )}

      {filterOpen && (
        <React.Suspense fallback={null}>
          <FilterDialog
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            onApplyFilters={handleApplyFilters}
            leads={leads || []}
          />
        </React.Suspense>
      )}

      <React.Suspense fallback={null}>
        <LeadsBulkImportModal
          open={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportFiles}
          importing={isSavingImport}
        />
      </React.Suspense>
    </Box>
  );
};

export default Leads;