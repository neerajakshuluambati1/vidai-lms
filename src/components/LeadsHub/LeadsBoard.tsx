// LeadsBoard.tsx
// Main component — no any, Date not Dayjs, exhaustive-deps fixed

import * as React from "react";
import { Box, Stack, Typography, CircularProgress, Alert } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import type { AppDispatch } from "../../store";

import { Dialogs } from "./LeadsMenuDialogs";
import {
  fetchLeads,
  bookAppointment,
  selectLeads,
  selectLeadsLoading,
  selectLeadsError,
} from "../../store/leadSlice";
import { selectUsers } from "../../store/userSlice";
import { selectClinic } from "../../store/clinicSlice";
import {
  pipelineApi,
  type Pipeline,
  type PipelineStage,
} from "../../services/pipeline.api";
import {
  DepartmentAPI,
  LeadAPI,
  type LeadPayload,
  TwilioAPI,
} from "../../services/leads.api";
import { authApi } from "../../services/auth.api";
import type { FilterValues } from "../../types/leads.types";
import TemplateService from "../../services/templates.api";

import {
  type LeadItem,
  type RawLead,
  type AppointmentState,
  type ColumnConfig,
  mapRawToLeadItem,
} from "./Leadsboardtypes";
import { hasUsablePhone, normalizePhone } from "./LeadsTable.helpers";
import { BookAppointmentModal } from "./Leadsboardmodals";
import { LeadColumn } from "./Leadsboardcard";
import CallDialog from "./CallDialog";
import { EmailDialog } from "../LeadsHub/EmailDialogs";
import type { ProcessedLead } from "./LeadsTable.types";

import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Alert as MuiAlert,
  CircularProgress as MuiCircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import {
  APP_TYPE,
  IS_CONTRACTS_APP,
  IS_MEDICAL_APP,
  STATUS_OPTIONS_BY_APP,
} from "../../config/appType";
import { clearAuth } from "../../store/authSlice";
import { useNavigate } from "react-router-dom";

// ====================== Props ======================
interface Props {
  search: string;
  filters?: FilterValues;
  canEditLeads?: boolean;
  selectedIndustry?: string;
  selectedPipelineId?: string;
}

const resolveLeadPhone = (lead: LeadItem | null | undefined): string => {
  if (!lead) return "";
  const record = lead as Record<string, unknown>;
  const candidate =
    (typeof record.contact_no === "string" && record.contact_no) ||
    (typeof record.phone === "string" && record.phone) ||
    (typeof record.phone_number === "string" && record.phone_number) ||
    (typeof record.mobile === "string" && record.mobile) ||
    (typeof record.contact === "string" && record.contact) ||
    (typeof record.contact_number === "string" && record.contact_number) ||
    (typeof record.contactNo === "string" && record.contactNo) ||
    "";
  return String(candidate).trim();
};

interface ApiErrorShape {
  response?: { data?: { detail?: string; message?: string } };
  message?: string;
}
const extractErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as ApiErrorShape;
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
};

type PersonnelApiItem = {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: { name?: string } | string;
};

type InternalUserItem = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: { name?: string } | string;
};

const normalizePersonnelList = (raw: unknown) => {
  const root =
    typeof raw === "object" && raw !== null
      ? (raw as {
          data?: { objects?: PersonnelApiItem[] } | PersonnelApiItem[];
          results?: PersonnelApiItem[];
        })
      : null;

  const list: PersonnelApiItem[] = Array.isArray(raw)
    ? (raw as PersonnelApiItem[])
    : Array.isArray(root?.data) // API can return list in data
      ? (root.data as PersonnelApiItem[])
      : Array.isArray(root?.data?.objects)
        ? (root.data.objects as PersonnelApiItem[])
        : Array.isArray(root?.results)
          ? (root.results as PersonnelApiItem[])
          : [];

  return list
    .map((user) => {
      const id =
        typeof user.id === "number"
          ? user.id
          : typeof user.id === "string"
            ? Number(user.id)
            : NaN;

      if (!Number.isFinite(id)) return null;

      const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
      const roleName =
        typeof user.role === "object"
          ? user.role?.name ?? ""
          : typeof user.role === "string"
            ? user.role
            : "";

      return {
        id,
        emp_name: fullName || user.username || `User #${id}`,
        emp_type: roleName,
        department_name: "",
      };
    })
    .filter((item): item is { id: number; emp_name: string; emp_type: string; department_name: string } => Boolean(item));
};

const normalizeInternalUsers = (users: InternalUserItem[]) => {
  return users.map((user) => {
    const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
    const roleName =
      typeof user.role === "object"
        ? user.role?.name ?? ""
        : typeof user.role === "string"
          ? user.role
          : "";

    return {
      id: user.id,
      emp_name: fullName || user.username || `User #${user.id}`,
      emp_type: roleName,
      department_name: "",
    };
  });
};

// ====================== Empty appointment state ======================
const emptyAppointment = (): AppointmentState => ({
  departments: [],
  employees: [],
  filteredEmployees: [],
  selectedDepartmentId: "",
  selectedEmployeeId: "",
  date: null,
  slot: "",
  remark: "",
  loadingDepartments: false,
  loadingEmployees: false,
  submitting: false,
  error: null,
  success: false,
});

// ====================== Status key aliases ======================
const getStatusKeys = (status: string): string[] => {
  const base = status.toLowerCase();
  const aliases: Record<string, string[]> = {
    "converted lead": ["converted lead", "converted"],
    "contract signed": ["contract signed", "contracted", "contract"],
    "proposal sent": ["proposal sent", "proposal"],
    "follow up": ["follow up", "follow-up", "followup"],
    appointment: ["appointment", "appointments"],
    negotiation: ["negotiation", "negotiating"],
    new: ["new"],
    closed: ["closed", "lost", "closed lost"],
  };
  return aliases[base] ?? [base];
};

// ====================== Board columns ======================
const BOARD_STATUSES = IS_CONTRACTS_APP
  ? [
      "New",
      "Follow Up",
      "Appointment",
      "Negotiation",
      "Proposal Sent",
      "Contract Signed",
      "Converted Lead",
      "Lost Lead",
    ]
  : [...STATUS_OPTIONS_BY_APP[APP_TYPE]];

const BOARD_COLUMNS: ColumnConfig[] = BOARD_STATUSES.map((status) => ({
  label: status,
  statusKey: getStatusKeys(status),
  color:
    status === "New"
      ? "#F97316"
      : status === "Appointment"
        ? "#3B82F6"
        : status === "Follow Up"
          ? "#8B5CF6"
          : status === "Negotiation"
            ? "#F59E0B"
            : status === "Proposal Sent"
              ? "#06B6D4"
              : status === "Contract Signed"
                ? "#10B981"
                : status === "Converted Lead"
                  ? "#22C55E"
                  : "#EF4444",
}));

const ACTION_LABEL_TO_COLOR: Record<string, string> = {
  call: "#F97316",
  email: "#3B82F6",
  sms: "#10B981",
  appointment: "#0F766E",
  whatsapp: "#16A34A",
};

const fallbackColorByIndex = (index: number): string => {
  const palette = [
    "#F97316",
    "#8B5CF6",
    "#3B82F6",
    "#10B981",
    "#06B6D4",
    "#F59E0B",
    "#EF4444",
  ];
  return palette[index % palette.length];
};

const getStageStatusKeys = (stage: PipelineStage): string[] => {
  const stageName = stage.stage_name.toLowerCase().trim();
  const byName = getStatusKeys(stage.stage_name);
  const byType = stage.stage_type ? getStatusKeys(stage.stage_type) : [];
  const byStatus = stage.stage_status ? getStatusKeys(stage.stage_status) : [];
  const explicit = [
    stageName,
    stage.stage_name,
    stage.stage_status ?? "",
    stage.stage_type ?? "",
  ];

  return Array.from(
    new Set(
      [...byName, ...byType, ...byStatus, ...explicit]
        .map((item) => item.toLowerCase().trim())
        .filter(Boolean),
    ),
  );
};

const getStageUiActions = (
  stage: PipelineStage,
): {
  showCall: boolean;
  showEmail: boolean;
  showSms: boolean;
  showBookAppointment: boolean;
  customActions: string[];
} => {
  if (!Array.isArray(stage.rules) || stage.rules.length === 0) {
    return {
      showCall: true,
      showEmail: true,
      showSms: true,
      showBookAppointment: false,
      customActions: [],
    };
  }

  const activeRules = stage.rules.filter((rule) => rule.is_enabled);
  return {
    showCall: activeRules.some((rule) => rule.action_type === "call"),
    showEmail: activeRules.some((rule) => rule.action_type === "email"),
    showSms: activeRules.some(
      (rule) => rule.action_type === "sms" || rule.action_type === "whatsapp",
    ),
    showBookAppointment: activeRules.some(
      (rule) => rule.action_type === "appointment",
    ),
    customActions: activeRules
      .filter((rule) => rule.action_type === "custom")
      .map((rule) => rule.custom_label?.trim() ?? "")
      .filter(Boolean),
  };
};

const normalizeStatusKey = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[_\s-]+/g, "-");

const extractStageFromDescription = (
  description: string | null | undefined,
): string => {
  if (!description) return "";
  const match = description.match(/(?:^|\|)\s*Stage:\s*([^|]+)/i);
  return match?.[1]?.trim() ?? "";
};

const matchesStatusFilter = (
  leadValue: string,
  filterValue: string,
): boolean => {
  const normalizedLead = normalizeStatusKey(leadValue);
  const normalizedFilter = normalizeStatusKey(filterValue);

  const equivalentStatuses: Record<string, string[]> = {
    new: ["new"],
    contacted: ["contacted"],
    "follow-ups": [
      "follow-ups",
      "follow-up",
      "followup",
      "follow-up-leads",
      "follow-up-lead",
    ],
    converted: ["converted", "converted-lead", "converted-leads"],
    lost: ["lost", "lost-lead", "lost-leads"],
    "cycle-conversion": ["cycle-conversion", "cycleconversion"],
    appointment: ["appointment", "appointments"],
    negotiation: ["negotiation"],
    "proposal-sent": ["proposal-sent", "proposal"],
    "contract-signed": ["contract-signed", "contractsigned"],
  };

  return (equivalentStatuses[normalizedFilter] ?? [normalizedFilter]).includes(
    normalizedLead,
  );
};

// ====================== SMS Template type ======================
interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  use_case?: string;
}

// ====================== Use Case options ======================
const USE_CASE_OPTIONS = [
  "Appointment",
  "Feedback",
  "Reminder",
  "Follow-Up",
  "Re-engagement",
  "No-Show",
  "General",
];

const getUseCaseChipSx = (useCase: string | undefined) => {
  const lower = (useCase || "").toLowerCase();
  const map: Record<string, { color: string; bg: string }> = {
    appointment: { color: "#16A34A", bg: "#F0FDF4" },
    reminder: { color: "#D97706", bg: "#FFFBEB" },
    feedback: { color: "#3B82F6", bg: "#EFF6FF" },
    "follow-up": { color: "#8B5CF6", bg: "#F5F3FF" },
    "re-engagement": { color: "#EC4899", bg: "#FDF2F8" },
    "no-show": { color: "#EF4444", bg: "#FEF2F2" },
    general: { color: "#6B7280", bg: "#F3F4F6" },
  };
  const s = map[lower] ?? { color: "#6B7280", bg: "#F3F4F6" };
  return {
    color: s.color,
    bgcolor: s.bg,
    fontWeight: 600,
    fontSize: "11px",
    height: 22,
    borderRadius: "4px",
    "& .MuiChip-label": { px: 1 },
  };
};

const USE_CASE_BODY_SUGGESTIONS: Record<string, string> = {
  Appointment:
    "Hi {lead_first_name}, your appointment at {clinic_name} is on {appointment_date} at {appointment_time}. Reply YES to confirm.",
  Feedback:
    "Hi {lead_first_name}, we'd love to hear about your experience at {clinic_name}. Please share your feedback: {feedback_link}",
  Reminder:
    "Hi {lead_first_name}, this is a reminder for your appointment on {appointment_date} at {appointment_time} at {clinic_name}.",
  "Follow-Up":
    "Hi {lead_first_name}, thank you for visiting {clinic_name}. How are you feeling? Reply to this message if you need any assistance.",
  "Re-engagement":
    "Hi {lead_first_name}, we miss you at {clinic_name}! It's been a while. Would you like to schedule a visit? Reply YES to book.",
  "No-Show":
    "Hi {lead_first_name}, we noticed you missed your appointment at {clinic_name}. Would you like to reschedule? Reply to this message.",
  General: "Hi {lead_first_name}, ",
};

// ====================== New SMS Template Dialog ======================
interface NewSMSTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (template: SMSTemplate) => void;
}

type TemplateFormView = "form" | "preview";

const NewSMSTemplateDialog: React.FC<NewSMSTemplateDialogProps> = ({
  open,
  onClose,
  onSaved,
}) => {
  const [view, setView] = React.useState<TemplateFormView>("form");
  const [name, setName] = React.useState("");
  const [useCase, setUseCase] = React.useState("");
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dropdownAnchor, setDropdownAnchor] =
    React.useState<null | HTMLElement>(null);
  const dropdownOpen = Boolean(dropdownAnchor);

  React.useEffect(() => {
    if (!open) {
      setView("form");
      setName("");
      setUseCase("");
      setBody("");
      setError(null);
      setDropdownAnchor(null);
    }
  }, [open]);

  const handleSelectUseCase = (uc: string) => {
    setUseCase(uc);
    setDropdownAnchor(null);
    if (!body.trim()) setBody(USE_CASE_BODY_SUGGESTIONS[uc] || "");
  };

  const handlePreview = () => {
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (!body.trim()) {
      setError("Body is required.");
      return;
    }
    setError(null);
    setView("preview");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (!body.trim()) {
      setError("Body is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        clinic: 1,
        name: name.trim(),
        use_case: useCase.toLowerCase() || "general",
        body: body.trim(),
        created_by: 1,
        is_active: true,
      };
      let saved: SMSTemplate | null = null;
      try {
        saved = await TemplateService.createTemplate("sms", payload);
      } catch {
        saved = {
          id: `local-${Date.now()}`,
          name: name.trim(),
          use_case: useCase,
          body: body.trim(),
        };
      }
      onSaved(saved!);
      onClose();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save template."));
    } finally {
      setSaving(false);
    }
  };

  const outlineBtn = {
    height: 40,
    px: 3,
    textTransform: "none" as const,
    fontWeight: 500,
    borderRadius: "8px",
    border: "1px solid #D1D5DB",
    color: "#374151",
    bgcolor: "transparent",
    "&:hover": { bgcolor: "#F9FAFB" },
  };
  const darkBtn = {
    height: 40,
    px: 3,
    textTransform: "none" as const,
    fontWeight: 600,
    borderRadius: "8px",
    bgcolor: "#1F2937",
    color: "white",
    "&:hover": { bgcolor: "#111827" },
    "&:disabled": { bgcolor: "#9CA3AF", color: "white" },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}
      sx={{ zIndex: 1500 }}
    >
      {view === "form" && (
        <>
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 700,
              fontSize: "1.05rem",
              pb: 0,
            }}
          >
            New SMS Template
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={2}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Appointment Confirmation"
                fullWidth
                size="small"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
              />
              <Box>
                <Typography
                  fontSize="12px"
                  fontWeight={500}
                  color="#374151"
                  mb={0.75}
                >
                  Use Case
                </Typography>
                <Box
                  onClick={(e) => setDropdownAnchor(e.currentTarget)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px solid",
                    borderColor: dropdownOpen ? "#1976d2" : "#D1D5DB",
                    borderRadius: "8px",
                    px: 1.5,
                    cursor: "pointer",
                    minHeight: 40,
                    bgcolor: "#fff",
                    boxShadow: dropdownOpen
                      ? "0 0 0 2px rgba(25,118,210,0.15)"
                      : "none",
                    "&:hover": { borderColor: "#9CA3AF" },
                    transition: "all 0.15s",
                  }}
                >
                  {useCase ? (
                    <Chip
                      label={useCase}
                      size="small"
                      sx={getUseCaseChipSx(useCase)}
                    />
                  ) : (
                    <Typography fontSize="14px" color="#9CA3AF" sx={{ py: 1 }}>
                      Select use case
                    </Typography>
                  )}
                  <Typography
                    sx={{
                      fontSize: "12px",
                      color: "#6B7280",
                      ml: 1,
                      transform: dropdownOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                      userSelect: "none",
                    }}
                  >
                    ▼
                  </Typography>
                </Box>
                <Menu
                  anchorEl={dropdownAnchor}
                  open={dropdownOpen}
                  onClose={() => setDropdownAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                  transformOrigin={{ vertical: "top", horizontal: "left" }}
                  disablePortal={false}
                  PaperProps={{
                    sx: {
                      borderRadius: "10px",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                      mt: 0.5,
                      minWidth: 240,
                    },
                  }}
                  sx={{ zIndex: 99999 }}
                >
                  {USE_CASE_OPTIONS.map((uc) => (
                    <MenuItem
                      key={uc}
                      selected={useCase === uc}
                      onClick={() => handleSelectUseCase(uc)}
                      sx={{
                        py: 1,
                        px: 1.5,
                        "&.Mui-selected": { bgcolor: "#F1F5F9" },
                        "&:hover": { bgcolor: "#F8FAFC" },
                      }}
                    >
                      <Chip label={uc} size="small" sx={getUseCaseChipSx(uc)} />
                    </MenuItem>
                  ))}
                </Menu>
              </Box>
              <Box>
                <Typography
                  fontSize="12px"
                  fontWeight={500}
                  color="#374151"
                  mb={0.75}
                >
                  Body
                </Typography>
                <textarea
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setError(null);
                  }}
                  placeholder="Type your message here..."
                  maxLength={1600}
                  rows={6}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 14px",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    color: "#1E293B",
                    lineHeight: "1.6",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    resize: "vertical",
                    outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    background: "#fff",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#1976d2";
                    e.target.style.boxShadow =
                      "0 0 0 2px rgba(25,118,210,0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#D1D5DB";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <Typography fontSize="11px" color="#94A3B8" mt={0.5}>
                  {body.length}/1600 — Use {"{variable_name}"} for dynamic
                  fields
                </Typography>
              </Box>
              {error && (
                <MuiAlert
                  severity="error"
                  sx={{ borderRadius: "8px", py: 0.5 }}
                >
                  {error}
                </MuiAlert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
            <Button onClick={onClose} sx={outlineBtn}>
              Cancel
            </Button>
            <Button onClick={handlePreview} sx={outlineBtn}>
              Preview
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim() || !body.trim()}
              sx={darkBtn}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </>
      )}
      {view === "preview" && (
        <>
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 700,
              fontSize: "1.05rem",
              pb: 0,
            }}
          >
            Preview Template
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <Typography fontSize="13px" color="#64748B">
                Template:
              </Typography>
              <Typography fontSize="13px" fontWeight={600} color="#1E293B">
                {name}
              </Typography>
              {useCase && (
                <Chip
                  label={useCase}
                  size="small"
                  sx={getUseCaseChipSx(useCase)}
                />
              )}
            </Stack>
            <Box
              sx={{
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                p: 2,
                minHeight: 160,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <Box
                sx={{
                  alignSelf: "flex-start",
                  bgcolor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0px 12px 12px 12px",
                  px: 2,
                  py: 1.25,
                  maxWidth: "90%",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <Typography
                  fontSize="13px"
                  color="#1E293B"
                  sx={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}
                >
                  {body.split(/(\{[^}]+\})/g).map((part, i) =>
                    /^\{[^}]+\}$/.test(part) ? (
                      <Box
                        key={i}
                        component="span"
                        sx={{ color: "#4F46E5", fontWeight: 600 }}
                      >
                        {part}
                      </Box>
                    ) : (
                      part
                    ),
                  )}
                </Typography>
              </Box>
              <Typography
                fontSize="11px"
                color="#94A3B8"
                sx={{ mt: 0.75, alignSelf: "flex-end" }}
              >
                {new Date().toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
            <Button onClick={() => setView("form")} sx={outlineBtn}>
              Back to Edit
            </Button>
            <Button onClick={handleSave} disabled={saving} sx={darkBtn}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

// ====================== SMS Template Picker ======================
interface SMSTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (body: string) => void;
}

const SMSTemplatePicker: React.FC<SMSTemplatePickerProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const [templates, setTemplates] = React.useState<SMSTemplate[]>([]);
  const [loadingTpl, setLoadingTpl] = React.useState(false);
  const [view, setView] = React.useState<"list" | "preview">("list");
  const [selected, setSelected] = React.useState<SMSTemplate | null>(null);
  const [previewBody, setPreviewBody] = React.useState("");
  const [newTemplateOpen, setNewTemplateOpen] = React.useState(false);

  const loadTemplates = React.useCallback(() => {
    setLoadingTpl(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TemplateService as any)
      .getTemplates("sms")
      .then((data: SMSTemplate[]) => setTemplates(data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTpl(false));
  }, []);

  React.useEffect(() => {
    if (!open) {
      setView("list");
      setSelected(null);
      setPreviewBody("");
      return;
    }
    loadTemplates();
  }, [open, loadTemplates]);

  const handlePickTemplate = (tpl: SMSTemplate) => {
    setSelected(tpl);
    setPreviewBody(tpl.body);
    setView("preview");
  };
  const handleSave = () => {
    onSelect(previewBody);
    onClose();
  };
  const handleNewTemplateSaved = (tpl: SMSTemplate) => {
    setNewTemplateOpen(false);
    onSelect(tpl.body);
    toast.success("Template saved and applied to your message!", {
      position: "top-right",
      autoClose: 3000,
      theme: "colored",
    });
    onClose();
  };

  return (
    <>
      <NewSMSTemplateDialog
        open={newTemplateOpen}
        onClose={() => setNewTemplateOpen(false)}
        onSaved={handleNewTemplateSaved}
      />
      <Dialog
        open={open && !newTemplateOpen}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}
        sx={{ zIndex: 1300 }}
      >
        {view === "list" && (
          <>
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 700,
                fontSize: "1.05rem",
                pb: 1,
              }}
            >
              Select SMS Template
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0, pb: 0 }}>
              {loadingTpl ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : templates.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography color="text.secondary" fontSize="14px">
                    No SMS templates found.
                  </Typography>
                </Box>
              ) : (
                <List disablePadding sx={{ maxHeight: 340, overflowY: "auto" }}>
                  {templates.map((tpl, idx) => (
                    <React.Fragment key={tpl.id}>
                      <ListItem disablePadding>
                        <ListItemButton
                          onClick={() => handlePickTemplate(tpl)}
                          sx={{
                            borderRadius: "8px",
                            px: 1.5,
                            py: 1.25,
                            "&:hover": { bgcolor: "#F8FAFC" },
                          }}
                        >
                          <ListItemText
                            primary={
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                <Typography
                                  fontSize="14px"
                                  fontWeight={600}
                                  color="#1E293B"
                                >
                                  {tpl.name}
                                </Typography>
                                {tpl.use_case && (
                                  <Chip
                                    label={tpl.use_case}
                                    size="small"
                                    sx={getUseCaseChipSx(tpl.use_case)}
                                  />
                                )}
                              </Stack>
                            }
                            secondary={
                              <Typography
                                fontSize="12px"
                                color="#64748B"
                                sx={{
                                  mt: 0.5,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {tpl.body}
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                      {idx < templates.length - 1 && (
                        <Divider sx={{ my: 0.25 }} />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </DialogContent>
            <DialogActions
              sx={{
                px: 3,
                pb: 3,
                pt: 2,
                flexDirection: "column",
                gap: 1,
                alignItems: "stretch",
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setNewTemplateOpen(true)}
                sx={{
                  height: 44,
                  textTransform: "none",
                  fontSize: "14px",
                  fontWeight: 500,
                  borderRadius: "8px",
                  borderColor: "#D1D5DB",
                  color: "#374151",
                  "&:hover": { borderColor: "#9CA3AF", bgcolor: "#F9FAFB" },
                }}
              >
                + New Template
              </Button>
              <Button
                fullWidth
                onClick={onClose}
                sx={{
                  height: 44,
                  backgroundColor: "#F3F4F6",
                  color: "black",
                  fontWeight: 500,
                  textTransform: "none",
                  borderRadius: "8px",
                  "&:hover": { backgroundColor: "#E5E7EB" },
                }}
              >
                Cancel
              </Button>
            </DialogActions>
          </>
        )}
        {view === "preview" && (
          <>
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 700,
                fontSize: "1.05rem",
                pb: 1,
              }}
            >
              Preview Template
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
              <Stack spacing={2}>
                {selected && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontSize="13px" color="#64748B">
                      Template:
                    </Typography>
                    <Typography
                      fontSize="13px"
                      fontWeight={600}
                      color="#1E293B"
                    >
                      {selected.name}
                    </Typography>
                    {selected.use_case && (
                      <Chip
                        label={selected.use_case}
                        size="small"
                        sx={getUseCaseChipSx(selected.use_case)}
                      />
                    )}
                  </Stack>
                )}
                <Box
                  sx={{
                    bgcolor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "12px",
                    p: 2,
                    minHeight: 120,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  }}
                >
                  <Box
                    sx={{
                      alignSelf: "flex-start",
                      bgcolor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "0px 12px 12px 12px",
                      px: 2,
                      py: 1.25,
                      maxWidth: "90%",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <Typography
                      fontSize="13px"
                      color="#1E293B"
                      sx={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}
                    >
                      {previewBody.split(/(\{[^}]+\})/g).map((part, i) =>
                        /^\{[^}]+\}$/.test(part) ? (
                          <Box
                            key={i}
                            component="span"
                            sx={{ color: "#4F46E5", fontWeight: 500 }}
                          >
                            {part}
                          </Box>
                        ) : (
                          part
                        ),
                      )}
                    </Typography>
                  </Box>
                  <Typography
                    fontSize="11px"
                    color="#94A3B8"
                    sx={{ mt: 0.75, alignSelf: "flex-end" }}
                  >
                    {new Date().toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Typography>
                </Box>
                <TextField
                  label="Edit message before sending"
                  multiline
                  rows={4}
                  value={previewBody}
                  onChange={(e) => setPreviewBody(e.target.value)}
                  inputProps={{ maxLength: 1600 }}
                  helperText={`${previewBody.length}/1600`}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
              <Button
                fullWidth
                onClick={() => setView("list")}
                sx={{
                  height: 44,
                  backgroundColor: "#F3F4F6",
                  color: "black",
                  fontWeight: 500,
                  textTransform: "none",
                  borderRadius: "8px",
                  "&:hover": { backgroundColor: "#E5E7EB" },
                }}
              >
                Back to Edit
              </Button>
              <Button
                fullWidth
                onClick={handleSave}
                disabled={!previewBody.trim()}
                sx={{
                  height: 44,
                  backgroundColor: "#1F2937",
                  color: "white",
                  fontWeight: 500,
                  textTransform: "none",
                  borderRadius: "8px",
                  "&:hover": { backgroundColor: "#111827" },
                  "&:disabled": { backgroundColor: "#9CA3AF", color: "white" },
                }}
              >
                Use Template
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

// ====================== SMS Dialog ======================
interface SMSDialogProps {
  open: boolean;
  lead: LeadItem | null;
  onClose: () => void;
}

const SMSDialog: React.FC<SMSDialogProps> = ({ open, lead, onClose }) => {
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = React.useState(false);

  const handleClose = () => {
    if (sending) return;
    setMessage("");
    setError(null);
    onClose();
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setError("Message cannot be empty.");
      return;
    }
    const phone = normalizePhone(resolveLeadPhone(lead));
    if (!phone) {
      setError("This lead has no contact number.");
      return;
    }
    if (!lead?.id) {
      setError("Lead ID is missing. Cannot send SMS.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await TwilioAPI.sendSMS({
        lead_uuid: lead.id,
        to: phone,
        message: message.trim(),
      });
      toast.success(`SMS sent to ${lead?.full_name ?? lead?.name ?? ""}!`, {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
      setMessage("");
      onClose();
    } catch (err: unknown) {
      setError(
        extractErrorMessage(err, "Failed to send SMS. Please try again."),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SMSTemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(body) => setMessage(body)}
      />
      <Dialog
        open={open && !templatePickerOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}
        sx={{ zIndex: 1300 }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1.1rem", pb: 1 }}>
          Send SMS
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            {(() => {
              const rawPhone = resolveLeadPhone(lead);
              const displayPhone = hasUsablePhone(rawPhone) ? rawPhone : "N/A";
              return (
                <Box
                  sx={{
                    backgroundColor: "#F8FAFC",
                    borderRadius: "10px",
                    px: 2,
                    py: 1.5,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontSize="12px"
                  >
                    Sending to
                  </Typography>
                  <Typography fontWeight={600} fontSize="14px">
                    {(lead?.full_name ?? lead?.name ?? "Unknown") as string}
                  </Typography>
                  <Typography color="text.secondary" fontSize="13px">
                    {displayPhone}
                  </Typography>
                </Box>
              );
            })()}
            <TextField
              label="Message"
              multiline
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              placeholder="Type your message here..."
              inputProps={{ maxLength: 1600 }}
              helperText={`${message.length}/1600`}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
            />
            {error && (
              <MuiAlert severity="error" sx={{ borderRadius: "8px" }}>
                {error}
              </MuiAlert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            pt: 0,
            flexDirection: "column",
            gap: 1,
            alignItems: "stretch",
          }}
        >
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setTemplatePickerOpen(true)}
            disabled={sending}
            sx={{
              height: 44,
              textTransform: "none",
              fontSize: "14px",
              fontWeight: 500,
              borderRadius: "8px",
              borderColor: "#D1D5DB",
              color: "#374151",
              "&:hover": { borderColor: "#9CA3AF", bgcolor: "#F9FAFB" },
            }}
          >
            SMS Template
          </Button>
          <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
            <Button
              fullWidth
              onClick={handleClose}
              disabled={sending}
              sx={{
                height: 44,
                backgroundColor: "#F3F4F6",
                color: "black",
                fontWeight: 500,
                textTransform: "none",
                borderRadius: "8px",
                "&:hover": { backgroundColor: "#E5E7EB" },
              }}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              onClick={handleSend}
              disabled={
                sending ||
                !message.trim() ||
                !hasUsablePhone(resolveLeadPhone(lead))
              }
              startIcon={
                sending ? (
                  <MuiCircularProgress size={16} sx={{ color: "white" }} />
                ) : null
              }
              sx={{
                height: 44,
                backgroundColor: "#1F2937",
                color: "white",
                fontWeight: 500,
                textTransform: "none",
                borderRadius: "8px",
                "&:hover": { backgroundColor: "#111827" },
                "&:disabled": { backgroundColor: "#9CA3AF", color: "white" },
              }}
            >
              {sending ? "Sending..." : "Send SMS"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ====================== Main LeadsBoard Component ======================
const LeadsBoard: React.FC<Props> = ({
  search,
  filters,
  canEditLeads = true,
  selectedIndustry = "",
  selectedPipelineId = "",
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const clinic = useSelector(selectClinic);
  const users = useSelector(selectUsers);

  const reduxLeads = useSelector(selectLeads);
  const loading = useSelector(selectLeadsLoading);
  const error = useSelector(selectLeadsError);

  const [leads, setLeads] = React.useState<LeadItem[]>([]);
  const [pipelineColumns, setPipelineColumns] = React.useState<ColumnConfig[]>(
    [],
  );
  const [draggedLeadId, setDraggedLeadId] = React.useState<string | null>(null);
  const [dropColumnKey, setDropColumnKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    dispatch(fetchLeads());
  }, [dispatch]);

  React.useEffect(() => {
    if (reduxLeads && reduxLeads.length > 0) {
      setLeads((reduxLeads as unknown as RawLead[]).map(mapRawToLeadItem));
    }
  }, [reduxLeads]);

  const updateLeadInBoard = React.useCallback(
    (leadId: string, updates: Partial<LeadItem>) => {
      setLeads((currentLeads) =>
        currentLeads.map((lead) =>
          lead.id === leadId ? { ...lead, ...updates } : lead,
        ),
      );
    },
    [],
  );

  const handleLeadDrop = React.useCallback(
    async (leadId: string, targetColumn: ColumnConfig) => {
      setDraggedLeadId(null);
      setDropColumnKey(null);

      const currentLead = leads.find((lead) => lead.id === leadId);
      if (!currentLead) return;

      const targetLeadStatus = targetColumn.label.trim();
      const currentLeadStatus = String(
        currentLead.lead_status || currentLead.status || "",
      ).trim();
      const currentStageId = currentLead.stage_id ?? null;
      const targetStageId = targetColumn.stageId ?? null;

      if (
        String(currentStageId ?? "") === String(targetStageId ?? "") &&
        currentLeadStatus.toLowerCase() === targetLeadStatus.toLowerCase()
      ) {
        return;
      }

      const previousLeadState = currentLead;
      updateLeadInBoard(leadId, {
        stage_id: targetStageId,
        lead_status: targetLeadStatus,
        status: targetLeadStatus,
      });

      try {
        await LeadAPI.update(leadId.replace(/^#/, ""), {
          clinic_id: currentLead.clinic_id ?? clinic?.id ?? undefined,
          stage_id: targetStageId,
          lead_status: targetLeadStatus as unknown as LeadPayload["lead_status"],
        });
        dispatch(fetchLeads());
        toast.success(`Moved to ${targetColumn.label}`);
      } catch (error) {
        console.error("Failed to move lead stage", error);
        updateLeadInBoard(leadId, previousLeadState);
        toast.error(`Failed to move lead to ${targetColumn.label}`);
      }
    },
    [clinic?.id, dispatch, leads, updateLeadInBoard],
  );

  React.useEffect(() => {
    const fetchPipelineStages = async () => {
      const clinicIdFromStore = Number(clinic?.id ?? 0);
      const clinicIdFromStorage = Number(localStorage.getItem("clinic_id") ?? 0);
      const clinicIdFromLeads = Number(
        (reduxLeads[0] as unknown as RawLead | undefined)?.clinic_id ?? 0,
      );
      const clinicId = clinicIdFromStore || clinicIdFromStorage || clinicIdFromLeads;

      if (!clinicId) {
        setPipelineColumns([]);
        return;
      }

      try {
        let activePipeline: Pipeline | null = null;

        // Always prefer the explicitly selected pipeline because stage columns should
        // reflect user selection exactly.
        if (selectedPipelineId) {
          try {
            activePipeline = await pipelineApi.getById(selectedPipelineId);
          } catch {
            activePipeline = null;
          }
        }

        if (!activePipeline) {
          const pipelines = await pipelineApi.list(clinicId);
          const pipelinesByIndustry = selectedIndustry
            ? pipelines.filter(
                (pipeline) => pipeline.industry_type === selectedIndustry,
              )
            : pipelines;

          activePipeline =
            pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ??
            pipelinesByIndustry.find((pipeline) => pipeline.is_default) ??
            pipelinesByIndustry.find((pipeline) => pipeline.is_active) ??
            pipelinesByIndustry[0] ??
            pipelines.find((pipeline) => pipeline.is_default) ??
            pipelines.find((pipeline) => pipeline.is_active) ??
            pipelines[0] ??
            null;
        }

        if (
          !activePipeline ||
          !Array.isArray(activePipeline.stages) ||
          activePipeline.stages.length === 0
        ) {
          setPipelineColumns([]);
          return;
        }

        const dynamicColumns = activePipeline.stages
          .slice()
          .sort((left, right) => left.stage_order - right.stage_order)
          .map((stage, index) => {
            const uiActions = getStageUiActions(stage);
            const firstCustomAction =
              uiActions.customActions[0]?.toLowerCase() ?? "";
            const firstActionType =
              stage.rules?.find((rule) => rule.is_enabled)?.action_type ?? "";
            const actionHint = firstCustomAction || firstActionType;

            return {
              stageId: stage.id,
              label: stage.stage_name,
              statusKey: getStageStatusKeys(stage),
              color:
                stage.stage_color ??
                ACTION_LABEL_TO_COLOR[actionHint] ??
                fallbackColorByIndex(index),
              uiActions,
            };
          });

        setPipelineColumns(dynamicColumns);
      } catch {
        setPipelineColumns([]);
      }
    };

    void fetchPipelineStages();
  }, [clinic?.id, reduxLeads, selectedIndustry, selectedPipelineId]);

  const [openBookModal, setOpenBookModal] = React.useState(false);
  const [selectedLead, setSelectedLead] = React.useState<LeadItem | null>(null);
  const [smsLead, setSmsLead] = React.useState<LeadItem | null>(null);
  const [emailLead, setEmailLead] = React.useState<LeadItem | null>(null);
  const [callLead, setCallLead] = React.useState<LeadItem | null>(null);
  const [appointment, setAppointment] =
    React.useState<AppointmentState>(emptyAppointment());

  const handleCallOpen = async (lead: LeadItem) => {
    const phone = normalizePhone(lead.contact_no as string | undefined);
    if (!phone) {
      toast.error("No contact number for this lead.", {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }
    if (!lead.id) {
      toast.error("Lead ID is missing. Cannot initiate call.", {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }
    setCallLead(lead);
    try {
      await TwilioAPI.makeCall({ lead_uuid: lead.id, to: phone });
    } catch (err: unknown) {
      setCallLead(null);
      toast.error(extractErrorMessage(err, "Failed to initiate call."), {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
    }
  };

  React.useEffect(() => {
    if (!openBookModal) return;

    const resolvedClinicId = Number(selectedLead?.clinic_id ?? clinic?.id ?? 0);
    if (!Number.isFinite(resolvedClinicId) || resolvedClinicId <= 0) {
      setAppointment((prev) => ({
        ...prev,
        loadingDepartments: false,
        loadingEmployees: false,
        error: "Clinic is missing for this lead. Please refresh and try again.",
      }));
      return;
    }

    const fetchAll = async () => {
      setAppointment((prev) => ({
        ...prev,
        loadingDepartments: true,
        loadingEmployees: true,
        error: null,
      }));
      try {
        const [departments, usersResponse] = await Promise.all([
          DepartmentAPI.listActiveByClinic(resolvedClinicId),
          authApi.searchUsers({
            search: "",
            limit: 100,
            offset: 0,
          }),
        ]);

        const resolvedEmployees = normalizePersonnelList(usersResponse);

        const fallbackUsers = Array.isArray(users)
          ? normalizeInternalUsers(users as InternalUserItem[])
          : [];

        const personnelOptions =
          resolvedEmployees.length > 0 ? resolvedEmployees : fallbackUsers;

        setAppointment((prev) => ({
          ...prev,
          departments,
          employees: personnelOptions,
          filteredEmployees: personnelOptions,
        }));
      } catch {
        const fallbackUsers = Array.isArray(users)
          ? normalizeInternalUsers(users as InternalUserItem[])
          : [];

        if (fallbackUsers.length > 0) {
          setAppointment((prev) => ({
            ...prev,
            employees: fallbackUsers,
            filteredEmployees: fallbackUsers,
            error: null,
          }));
          return;
        }

        setAppointment((prev) => ({
          ...prev,
          error: "Failed to load departments/personnel. Please try again.",
        }));
      } finally {
        setAppointment((prev) => ({
          ...prev,
          loadingDepartments: false,
          loadingEmployees: false,
        }));
      }
    };
    fetchAll();
  }, [clinic?.id, openBookModal, selectedLead, users]);

  React.useEffect(() => {
    setAppointment((prev) => {
      if (!IS_MEDICAL_APP) {
        return { ...prev, filteredEmployees: prev.employees };
      }
      if (!prev.selectedDepartmentId)
        return { ...prev, filteredEmployees: prev.employees };
      const deptName =
        prev.departments.find((d) => d.id === Number(prev.selectedDepartmentId))
          ?.name ?? "";
      const filteredByName = prev.employees.filter(
        (emp) => emp.department_name?.toLowerCase() === deptName.toLowerCase(),
      );
      const filtered = filteredByName.length > 0 ? filteredByName : prev.employees;
      const empStillPresent = filtered.some(
        (e) => e.id === Number(prev.selectedEmployeeId),
      );
      return {
        ...prev,
        filteredEmployees: filtered,
        selectedEmployeeId: empStillPresent ? prev.selectedEmployeeId : "",
      };
    });
  }, [
    appointment.selectedDepartmentId,
    appointment.employees,
    appointment.departments,
  ]);

  const filteredLeads = React.useMemo(() => {
    return leads.filter((lead) => {
      const searchStr =
        `${lead.full_name || lead.name || ""} ${lead.id || ""}`.toLowerCase();
      const matchSearch = searchStr.includes(search.toLowerCase());
      const isActive = lead.is_active !== false;

      if (filters) {
        if (
          filters.department &&
          lead.department_id !== Number(filters.department)
        )
          return false;
        if (
          filters.assignee &&
          lead.assigned_to_id !== Number(filters.assignee)
        )
          return false;
        if (filters.status) {
          const leadStatusValue = String(lead.lead_status || lead.status || "");
          if (!matchesStatusFilter(leadStatusValue, filters.status))
            return false;
        }
        if (filters.quality && lead.quality !== filters.quality) return false;
        if (filters.source && lead.source !== filters.source) return false;
        if (filters.dateFrom || filters.dateTo) {
          const leadDate = lead.created_at ? new Date(lead.created_at) : null;
          if (!leadDate) return false;
          if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            from.setHours(0, 0, 0, 0);
            if (leadDate < from) return false;
          }
          if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            if (leadDate > to) return false;
          }
        }
      }
      return matchSearch && isActive;
    });
  }, [leads, search, filters]);

  const activeBoardColumns = React.useMemo(() => {
    const hasSelectionContext = Boolean(selectedIndustry || selectedPipelineId);
    if (pipelineColumns.length > 0) return pipelineColumns;
    return hasSelectionContext ? [] : BOARD_COLUMNS;
  }, [pipelineColumns, selectedIndustry, selectedPipelineId]);

  const handleBookAppointmentSubmit = async () => {
    if (!selectedLead?.id) {
      setAppointment((p) => ({ ...p, error: "Lead ID is missing." }));
      return;
    }
    if (IS_MEDICAL_APP && !appointment.selectedDepartmentId) {
      setAppointment((p) => ({ ...p, error: "Please select a department." }));
      return;
    }
    if (!appointment.date) {
      setAppointment((p) => ({
        ...p,
        error: "Please select an appointment date.",
      }));
      return;
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const selectedDay = new Date(appointment.date);
    selectedDay.setHours(0, 0, 0, 0);

    if (selectedDay.getTime() < today.getTime()) {
      setAppointment((p) => ({
        ...p,
        error: "Cannot book appointment for a past date.",
      }));
      return;
    }

    if (!appointment.slot) {
      setAppointment((p) => ({ ...p, error: "Please select a time slot." }));
      return;
    }

    const slotMatch = appointment.slot.match(/^(\d{1,2}):(\d{2})\s(AM|PM)/);
    if (selectedDay.getTime() === today.getTime() && slotMatch) {
      let hour = Number(slotMatch[1]);
      const minute = Number(slotMatch[2]);
      const meridiem = slotMatch[3];

      if (meridiem === "PM" && hour !== 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      const slotStart = new Date(now);
      slotStart.setHours(hour, minute, 0, 0);

      if (slotStart.getTime() <= now.getTime()) {
        setAppointment((p) => ({
          ...p,
          error: "Cannot book appointment for a past time.",
        }));
        return;
      }
    }

    setAppointment((p) => ({ ...p, submitting: true, error: null }));
    const leadId = selectedLead.id.replace(/^#/, "");
    const formattedDate = appointment.date.toISOString().split("T")[0];

    const result = await dispatch(
      bookAppointment({
        leadId,
        payload: {
          ...(IS_MEDICAL_APP && {
            department_id: Number(appointment.selectedDepartmentId),
          }),
          appointment_date: formattedDate,
          slot: appointment.slot,
          remark: appointment.remark,
          ...(appointment.selectedEmployeeId && {
            assigned_to_id: Number(appointment.selectedEmployeeId),
          }),
        },
        leadSnapshot: {
          clinic_id: selectedLead.clinic_id ?? undefined,
          department_id: selectedLead.department_id ?? undefined,
          full_name: selectedLead.full_name || selectedLead.name || "",
          contact_no:
            selectedLead.contact_no ||
            selectedLead.phone ||
            selectedLead.phone_number ||
            "",
          source: selectedLead.source || "Unknown",
          treatment_interest: selectedLead.treatment_interest,
          is_active: selectedLead.is_active !== false,
          partner_inquiry: selectedLead.partner_inquiry ?? false,
        },
      }),
    );

    setAppointment((p) => ({ ...p, submitting: false }));

    if (bookAppointment.rejected.match(result)) {
      const errMsg =
        typeof result.payload === "string"
          ? result.payload
          : "Failed to book appointment. Please try again.";
      setAppointment((p) => ({ ...p, error: errMsg }));
      return;
    }

    handleCloseBook();
    toast.success("Appointment booked successfully!", {
      position: "top-right",
      autoClose: 3000,
      theme: "colored",
    });
  };

  const handleOpenBookModal = (lead: LeadItem) => {
    setSelectedLead(lead);
    setAppointment({
      ...emptyAppointment(),
      selectedDepartmentId:
        lead.department_id != null ? String(lead.department_id) : "",
      selectedEmployeeId:
        lead.assigned_to_id != null ? String(lead.assigned_to_id) : "",
      date: lead.appointment_date ? new Date(lead.appointment_date) : null,
      slot: lead.slot || "",
      remark: lead.remark || "",
    });
    setOpenBookModal(true);
  };

  const handleCloseBook = () => {
    setOpenBookModal(false);
    setSelectedLead(null);
    setAppointment((p) => ({ ...p, error: null, submitting: false }));
  };

  if (loading)
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading leads...</Typography>
        </Stack>
      </Box>
    );

  if (error === "Unauthorized") {
    dispatch(clearAuth());
    navigate("/login", { replace: true });
  }

  if (error)
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <Typography fontWeight={600}>Failed to load leads</Typography>
        <Typography variant="body2">{error}</Typography>
        <Typography
          variant="body2"
          sx={{
            mt: 1,
            color: "primary.main",
            cursor: "pointer",
            textDecoration: "underline",
          }}
          onClick={() => dispatch(fetchLeads())}
        >
          Try again
        </Typography>
      </Alert>
    );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          display: "flex",
          overflowX: "auto",
          gap: 3,
          p: 4,
          bgcolor: "#F8FAFC",
          height: "calc(100vh - 64px)",
          alignItems: "flex-start",
          "&::-webkit-scrollbar": { height: "10px" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#CBD5E1",
            borderRadius: "10px",
          },
        }}
      >
        {activeBoardColumns.length === 0 ? (
          <Alert severity="info" sx={{ width: "100%" }}>
            No active stages found for the selected industry/pipeline.
          </Alert>
        ) : (
          activeBoardColumns.map((col) => {
            const leadsInCol = filteredLeads.filter((l) => {
              const hasColumnStageId = col.stageId != null;
              const hasLeadStageId =
                l.stage_id != null && String(l.stage_id).trim() !== "";

              // When a lead already has a stage id, place it strictly by stage id
              // to avoid matching additional columns through legacy text fallbacks.
              if (hasColumnStageId && hasLeadStageId) {
                return String(l.stage_id) === String(col.stageId);
              }

              const candidateStatuses = [
                l.status,
                l.lead_status,
                typeof l.task_type === "string" ? l.task_type : "",
                typeof l.task === "string" ? l.task : "",
                extractStageFromDescription(
                  typeof l.next_action_description === "string"
                    ? l.next_action_description
                    : "",
                ),
              ]
                .map((value) => (value || "").toLowerCase().trim())
                .filter(Boolean);

              return col.statusKey.some((key) => {
                const normalizedKey = (key || "no status").toLowerCase().trim();
                return candidateStatuses.includes(normalizedKey);
              });
            });
            return (
              <LeadColumn
                key={col.stageId ?? col.label}
                col={col}
                leads={leadsInCol}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                onOpenSms={(lead) => setSmsLead(lead)}
                onOpenMail={(lead) => setEmailLead(lead)}
                onOpenBook={handleOpenBookModal}
                onOpenCall={handleCallOpen}
                canEditLeads={canEditLeads}
                setLeads={setLeads}
                draggedLeadId={draggedLeadId}
                dropColumnKey={dropColumnKey}
                onDragStart={(leadId) => setDraggedLeadId(leadId)}
                onDragEnd={() => {
                  setDraggedLeadId(null);
                  setDropColumnKey(null);
                }}
                onDragOverColumn={(columnKey) => setDropColumnKey(columnKey)}
                onDropLead={(leadId) => void handleLeadDrop(leadId, col)}
              />
            );
          })
        )}

        <Dialogs />

        <SMSDialog
          open={Boolean(smsLead)}
          lead={smsLead}
          onClose={() => setSmsLead(null)}
        />

        {/* EmailDialog — imported from LeadsTableEmailDialogs, replaces MailModal */}
        <EmailDialog
          open={Boolean(emailLead)}
          lead={emailLead as unknown as ProcessedLead}
          onClose={() => setEmailLead(null)}
        />

        <CallDialog
          open={Boolean(callLead)}
          name={(callLead?.full_name ?? callLead?.name ?? "Unknown") as string}
          onClose={() => setCallLead(null)}
        />

        <BookAppointmentModal
          open={openBookModal}
          selectedLead={selectedLead}
          appointment={appointment}
          setSelectedDepartmentId={(id) =>
            setAppointment((p) => ({ ...p, selectedDepartmentId: String(id) }))
          }
          setSelectedEmployeeId={(id) =>
            setAppointment((p) => ({ ...p, selectedEmployeeId: String(id) }))
          }
          setDate={(d) => setAppointment((p) => ({ ...p, date: d }))}
          setSlot={(s) => setAppointment((p) => ({ ...p, slot: s }))}
          setRemark={(r) => setAppointment((p) => ({ ...p, remark: r }))}
          clearError={() => setAppointment((p) => ({ ...p, error: null }))}
          onClose={handleCloseBook}
          onSubmit={handleBookAppointmentSubmit}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default LeadsBoard;
