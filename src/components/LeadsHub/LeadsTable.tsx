import * as React from "react";
import {
  Alert,
  Avatar,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Button,
} from "@mui/material";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import PhoneIcon from "@mui/icons-material/Phone";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import Lead_Status_Edit from "../../assets/icons/Lead_Status_Edit.svg";

import {
  fetchLeads,
  selectLeads,
  selectLeadsLoading,
  selectLeadsError,
  // clearError,
} from "../../store/leadSlice";
import { selectClinic } from "../../store/clinicSlice";
import "../../styles/Leads/leads.css";
import { MenuButton, Dialogs } from "./LeadsMenuDialogs";
import BulkActionBar from "./BulkActionBar";
import { LeadAPI } from "../../services/leads.api";
import { pipelineApi } from "../../services/pipeline.api";
import CallDialog from "./CallDialog";

import type { RawLead, ProcessedLead, Props } from "./LeadsTable.types";
import {
  rowsPerPage,
  stickyContactStyle,
  stickyMenuStyle,
  stickyHeaderContactStyle,
  stickyHeaderMenuStyle,
} from "./LeadsTable.types";
import {
  extractErrorMessage,
  hasUsablePhone,
  normalizePhone,
  processLead,
} from "./LeadsTable.helpers";
import { getStatusChipSx, getTaskStatusChipSx } from "./LeadsTable.styles";
import { SMSDialog } from "./SmsDialogs";
import { EmailDialog } from "./EmailDialogs";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

// ── App-type config ───────────────────────────────────────────────────────────
import { IS_CONTRACTS_APP, ACTIVE_STATUS_OPTIONS } from "../../config/appType";
import type { LeadItem } from "./Leadsboardtypes";

// ── Shared toast options ──────────────────────────────────────────────────────
const toastOptions = {
  position: "top-right" as const,
  autoClose: 3000,
  theme: "colored" as const,
};

// Add this helper at the top of LeadsTable.tsx:
const BACKEND_TO_DISPLAY: Record<string, string> = {
  new: "New",
  appointment: "Appointment",
  "follow up": "Follow Up",
  follow_up: "Follow Up",
  negotiation: "Negotiation",
  "proposal sent": "Proposal Sent",
  "contract signed": "Contract Signed",
  converted: "Converted Lead",
  "converted lead": "Converted Lead",
  lost: "Lost Lead",
  "lost lead": "Lost Lead",
};

// ── Status chip color map (matches getStatusChipSx palette) ─────────────────
const STATUS_CHIP_STYLES: Record<
  string,
  { color: string; borderColor: string; bg: string }
> = {
  New: { color: "#7C3AED", borderColor: "#7C3AED", bg: "#F5F3FF" },
  Appointment: { color: "#6366F1", borderColor: "#6366F1", bg: "#EEF2FF" },
  "Follow Up": { color: "#F59E0B", borderColor: "#F59E0B", bg: "#FFFBEB" },
  Negotiation: { color: "#F97316", borderColor: "#F97316", bg: "#FFF7ED" },
  "Proposal Sent": { color: "#8B5CF6", borderColor: "#8B5CF6", bg: "#F5F3FF" },
  "Contract Signed": {
    color: "#0EA5E9",
    borderColor: "#0EA5E9",
    bg: "#F0F9FF",
  },
  "Converted Lead": { color: "#10B981", borderColor: "#10B981", bg: "#ECFDF5" },
  "Lost Lead": { color: "#EF4444", borderColor: "#EF4444", bg: "#FEF2F2" },
};

const getStatusOptionChipSx = (status: string) => {
  const s = STATUS_CHIP_STYLES[status] ?? {
    color: "#64748B",
    borderColor: "#64748B",
    bg: "#F8FAFC",
  };
  return {
    color: s.color,
    borderColor: s.borderColor,
    backgroundColor: s.bg,
    fontWeight: 500,
    fontSize: "12px",
    height: 26,
    borderRadius: "999px",
    border: "1.5px solid",
    cursor: "pointer",
    "& .MuiChip-label": { px: 1.5 },
    "&:hover": { opacity: 0.85 },
  };
};

const normalizeStatusKey = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[_\s-]+/g, "-");

const upsertStageMarker = (
  description: string | undefined,
  stageName: string,
): string => {
  const cleaned = (description ?? "")
    .replace(/(?:^|\|)\s*Stage:\s*[^|]+/i, "")
    .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
    .trim();

  return cleaned ? `Stage: ${stageName} | ${cleaned}` : `Stage: ${stageName}`;
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

// ── Edit Status Dialog ────────────────────────────────────────────────────────
interface EditStatusDialogProps {
  open: boolean;
  currentStatus: string;
  statusOptions: Array<{ id?: string; label: string }>;
  onClose: () => void;
  onSave: (selectedStatus: { id?: string; label: string }) => void;
}

const EditStatusDialog: React.FC<EditStatusDialogProps> = ({
  open,
  currentStatus,
  statusOptions,
  onClose,
  onSave,
}) => {
  const [selected, setSelected] = React.useState(currentStatus);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const hasStatusOptions = statusOptions.length > 0;
  const noStagesMessage =
    "This pipeline has no stages. Please select a different pipeline or create one stage.";
  const selectedOption =
    statusOptions.find((option) => option.label === selected) ??
    (selected ? { label: selected } : undefined);

  React.useEffect(() => {
    if (open) {
      setSelected(currentStatus);
      setDropdownOpen(false);
    }
  }, [open, currentStatus]);

  const selectedStyle = STATUS_CHIP_STYLES[selected] ?? {
    color: "#64748B",
    borderColor: "#64748B",
    bg: "#F8FAFC",
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 340,
          borderRadius: 3,
          p: 1,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 1,
          fontWeight: 700,
          fontSize: "1rem",
        }}
      >
        Edit Status
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0.5, pb: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 0.5, display: "block" }}
        >
          Status
        </Typography>

        {/* Custom trigger — shows selected chip + chevron */}
        <Tooltip
          title={hasStatusOptions ? "" : noStagesMessage}
          placement="top"
          arrow
          disableHoverListener={hasStatusOptions}
        >
          <Box
            onClick={() => {
              if (!hasStatusOptions) return;
              setDropdownOpen((v) => !v);
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: `2px solid ${dropdownOpen ? selectedStyle.borderColor : "#E2E8F0"}`,
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
              cursor: hasStatusOptions ? "pointer" : "not-allowed",
              opacity: hasStatusOptions ? 1 : 0.7,
              transition: "border-color 0.15s",
              "&:hover": { borderColor: selectedStyle.borderColor },
            }}
          >
            <Chip
              label={selected}
              size="small"
              sx={getStatusOptionChipSx(selected)}
            />
            <Box
              component="span"
              sx={{
                ml: 1,
                fontSize: 18,
                color: "#94A3B8",
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
                lineHeight: 1,
              }}
            >
              ▾
            </Box>
          </Box>
        </Tooltip>

        {/* Dropdown list */}
        {dropdownOpen && (
          <Box
            sx={{
              mt: 0.5,
              border: "1px solid #E2E8F0",
              borderRadius: 2,
              py: 1,
              px: 1,
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
              maxHeight: 280,
              overflowY: "auto",
              backgroundColor: "#fff",
            }}
          >
            {statusOptions.length === 0 ? (
              <Typography
                sx={{ fontSize: 12, color: "#667085", px: 1, py: 0.5 }}
              >
                No active stages available for selected pipeline.
              </Typography>
            ) : (
              statusOptions.map((opt) => (
                <Box
                  key={opt.id ?? opt.label}
                  onClick={() => {
                    setSelected(opt.label);
                    setDropdownOpen(false);
                  }}
                  sx={{ display: "inline-flex", pl: 0.5 }}
                >
                  <Chip
                    label={opt.label}
                    size="small"
                    sx={{
                      ...getStatusOptionChipSx(opt.label),
                      ...(opt.label === selected && {
                        boxShadow: `0 0 0 2px ${STATUS_CHIP_STYLES[opt.label]?.borderColor ?? "#64748B"}44`,
                      }),
                    }}
                  />
                </Box>
              ))
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            flex: 1,
            borderRadius: 1,
            color: "#232323",
            borderColor: "#232323",
          }}
        >
          Cancel
        </Button>
        <Tooltip
          title={hasStatusOptions ? "" : noStagesMessage}
          placement="top"
          arrow
          disableHoverListener={hasStatusOptions}
        >
          <span style={{ flex: 1 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => onSave(selectedOption ?? { label: selected })}
              disabled={!hasStatusOptions}
              sx={{
                borderRadius: 1,
                backgroundColor: "#505050",
                color: "#FFFFFF",
                "&:hover": { backgroundColor: "#232323" },
              }}
            >
              Save
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const LeadsTable: React.FC<Props> = ({
  search,
  tab,
  filters,
  importedLeads = [],
  canEditLeads = true,
  selectedIndustry = "",
  selectedPipelineId = "",
}) => {
  const theme = useTheme();
  const disableStickyActions = useMediaQuery(theme.breakpoints.down("md"));
  const contactCellStyle = disableStickyActions
    ? { bgcolor: "#FFFFFF" }
    : stickyContactStyle;
  const menuCellStyle = disableStickyActions
    ? { bgcolor: "#FFFFFF" }
    : stickyMenuStyle;
  const contactHeaderStyle = disableStickyActions
    ? { bgcolor: "#F8FAFC" }
    : stickyHeaderContactStyle;
  const menuHeaderStyle = disableStickyActions
    ? { bgcolor: "#F8FAFC" }
    : stickyHeaderMenuStyle;

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const leads = useSelector(selectLeads) as RawLead[] | null;
  const loading = useSelector(selectLeadsLoading) as boolean;
  const error = useSelector(selectLeadsError) as string | null;
  const clinic = useSelector(selectClinic);

  const [localLeads, setLocalLeads] = React.useState<ProcessedLead[]>([]);
  const [page, setPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [callLead, setCallLead] = React.useState<ProcessedLead | null>(null);
  const [smsLead, setSmsLead] = React.useState<ProcessedLead | null>(null);
  const [emailLead, setEmailLead] = React.useState<ProcessedLead | null>(null);

  // ── Edit Status state ──
  // Change state type to LeadItem which has all the raw fields:
  const [editStatusLead, setEditStatusLead] = React.useState<LeadItem | null>(
    null,
  );
  const [editStatusOptions, setEditStatusOptions] = React.useState<
    Array<{ id?: string; label: string }>
  >(ACTIVE_STATUS_OPTIONS.map((status) => ({ label: status })));

  const [sortCol, setSortCol] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  React.useEffect(() => {
    dispatch(fetchLeads() as unknown as Parameters<typeof dispatch>[0]);
  }, [dispatch]);

  React.useEffect(() => {
    const loadEditStatusOptions = async () => {
      const clinicIdFromStore = Number(clinic?.id ?? 0);
      const clinicIdFromLead = Number(
        editStatusLead?.clinic_id ?? (leads?.[0] as RawLead | undefined)?.clinic_id ?? 0,
      );
      const clinicId = clinicIdFromStore || clinicIdFromLead;
      const resolvedSelectedIndustry = selectedIndustry;
      const resolvedSelectedPipelineId = selectedPipelineId;
      const hasSelectionContext =
        Boolean(resolvedSelectedIndustry) ||
        Boolean(resolvedSelectedPipelineId);
      const fallbackStatusOptions = ACTIVE_STATUS_OPTIONS.map((status) => ({
        label: status,
      }));

      if (!clinicId) {
        setEditStatusOptions(hasSelectionContext ? [] : fallbackStatusOptions);
        return;
      }

      try {
        const pipelines = await pipelineApi.list(clinicId);
        const pipelinesByIndustry = resolvedSelectedIndustry
          ? pipelines.filter(
              (pipeline) =>
                pipeline.industry_type === resolvedSelectedIndustry,
            )
          : pipelines;

<<<<<<< Updated upstream
        if (resolvedSelectedPipelineId) {
          try {
            selectedPipeline = await pipelineApi.getById(
              resolvedSelectedPipelineId,
            );
          } catch {
            selectedPipeline = null;
          }
        }

        if (!selectedPipeline) {
          const pipelines = await pipelineApi.list(clinicId);
          const pipelinesByIndustry = resolvedSelectedIndustry
            ? pipelines.filter(
                (pipeline) =>
                  pipeline.industry_type === resolvedSelectedIndustry,
              )
            : pipelines;

          selectedPipeline =
            pipelines.find(
              (pipeline) => pipeline.id === resolvedSelectedPipelineId,
            ) ??
            pipelinesByIndustry[0] ??
            pipelines[0] ??
            null;
        }
=======
        const selectedPipeline =
          pipelines.find(
            (pipeline) => pipeline.id === resolvedSelectedPipelineId,
          ) ??
          pipelinesByIndustry.find((pipeline) => pipeline.is_active) ??
          pipelinesByIndustry[0] ??
          pipelines.find((pipeline) => pipeline.is_active) ??
          pipelines[0] ??
          null;
>>>>>>> Stashed changes

        if (!selectedPipeline || !Array.isArray(selectedPipeline.stages)) {
          setEditStatusOptions(
            hasSelectionContext ? [] : fallbackStatusOptions,
          );
          return;
        }

        const activeStageOptions = selectedPipeline.stages
          .filter(
            (stage) =>
              (stage.stage_status ?? "").toLowerCase().trim() !== "inactive",
          )
          .sort((left, right) => left.stage_order - right.stage_order)
          .map((stage) => ({
            id: stage.id,
            label: stage.stage_name.trim(),
          }))
          .filter((stage) => Boolean(stage.label));

        setEditStatusOptions(
          activeStageOptions.length > 0
            ? activeStageOptions
            : hasSelectionContext
              ? []
              : fallbackStatusOptions,
        );
      } catch {
        setEditStatusOptions(hasSelectionContext ? [] : fallbackStatusOptions);
      }
    };

    if (!editStatusLead) return;
    void loadEditStatusOptions();
  }, [clinic?.id, editStatusLead, leads, selectedIndustry, selectedPipelineId]);

  React.useEffect(() => {
    if (!leads) return;
    const importedLeadIds = new Set(importedLeads.map((lead) => lead.id));
    const mergedLeads = [
      ...leads.filter((lead) => !importedLeadIds.has(lead.id)),
      ...importedLeads,
    ];

    // Keep list ordered by lead date, so imports are placed correctly.
    const getLeadTimestamp = (lead: RawLead): number => {
      const primary = lead.created_at;
      const secondary = (lead as RawLead & { appointment_date?: string })
        .appointment_date;
      const parsed = Date.parse(primary || secondary || "");
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const sortedMergedLeads = [...mergedLeads].sort(
      (a, b) => getLeadTimestamp(b) - getLeadTimestamp(a),
    );

    setLocalLeads(sortedMergedLeads.map(processLead));
  }, [leads, importedLeads]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const isSelected = (id: string) => selectedIds.includes(id);

  // ✅ FIXED: handleCallOpen now just opens CallDialog with lead data
  // CallDialog itself handles the Twilio browser call — no more TwilioAPI.makeCall here
  const handleCallOpen = (e: React.MouseEvent, lead: ProcessedLead) => {
    e.stopPropagation();
    const phone = normalizePhone(lead.contact_no);
    if (!phone) {
      toast.error("No contact number for this lead.", toastOptions);
      return;
    }
    if (!lead.id) {
      toast.error("Lead ID is missing. Cannot initiate call.", toastOptions);
      return;
    }
    setCallLead(lead);
  };

  const handleSMSOpen = (e: React.MouseEvent, lead: ProcessedLead) => {
    e.stopPropagation();
    setSmsLead(lead);
  };

  // ── Handle Edit Status open ──
  // In handleEditStatusOpen, cast the lead back to RawLead:
  // handleEditStatusOpen — cast ProcessedLead to LeadItem:
  const handleEditStatusOpen = (e: React.MouseEvent, lead: ProcessedLead) => {
    e.stopPropagation();
    if (!canEditLeads) return;
    setEditStatusLead(lead as unknown as LeadItem);
  };

  // ── Handle Edit Status save ──
  const STATUS_API_MAP: Record<string, string> = {
    New: "new",
    Appointment: "appointment",
    "Follow Up": "follow up",
    Negotiation: "negotiation",
    "Proposal Sent": "proposal sent",
    "Contract Signed": "contract signed",
    "Converted Lead": "converted",
    "Lost Lead": "lost",
  };

  // handleEditStatusSave — all fields now available:
  const handleEditStatusSave = async (selectedStatus: {
    id?: string;
    label: string;
  }) => {
    if (!editStatusLead) return;
    const nextStatusLabel = selectedStatus.label;
    const apiStatus = STATUS_API_MAP[nextStatusLabel];
    const stageAwareDescription = upsertStageMarker(
      editStatusLead.next_action_description as string | undefined,
      nextStatusLabel,
    );

    
    try {
      const latestLead = await LeadAPI.getById(editStatusLead.id);
      const treatmentInterest =
        latestLead.treatment_interest ?? editStatusLead.treatment_interest;

      const resolvedClinicId =
        latestLead.clinic_id ?? editStatusLead.clinic_id ?? clinic?.id;
      const resolvedDepartmentId =
        latestLead.department_id ?? editStatusLead.department_id;

      const resolvedContactNo =
        latestLead.contact_no || editStatusLead.contact_no;

      const updatePayload = {
        ...(resolvedClinicId ? { clinic_id: resolvedClinicId } : {}),
        ...(resolvedDepartmentId
          ? { department_id: resolvedDepartmentId }
          : {}),
        full_name:
          latestLead.full_name ||
          editStatusLead.full_name ||
          editStatusLead.name ||
          "",
        ...(resolvedContactNo ? { contact_no: resolvedContactNo } : {}),
        source: latestLead.source || editStatusLead.source || "",
        treatment_interest: Array.isArray(treatmentInterest)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? treatmentInterest.map((item: any) =>
              typeof item === "object" ? item.id : item,
            )
          : [],
        book_appointment:
          latestLead.book_appointment ??
          editStatusLead.book_appointment ??
          false,
        appointment_date:
          latestLead.appointment_date ??
          editStatusLead.appointment_date ??
          null,
        slot: latestLead.slot || editStatusLead.slot || "",
        is_active: latestLead.is_active !== false,
        partner_inquiry:
          latestLead.partner_inquiry ?? editStatusLead.partner_inquiry ?? false,
        next_action_description: stageAwareDescription,
        ...(selectedStatus.id ? { stage_id: selectedStatus.id } : {}),
        ...(apiStatus ? { lead_status: apiStatus as "new" | "contacted" } : {}),
      };

      await LeadAPI.update(editStatusLead.id, updatePayload);
      setLocalLeads((prev) =>
        prev.map((l) =>
          l.id === editStatusLead.id
            ? {
                ...l,
                status: nextStatusLabel,
                lead_status: nextStatusLabel,
                next_action_description: stageAwareDescription,
              }
            : l,
        ),
      );
      dispatch(fetchLeads() as unknown as Parameters<typeof dispatch>[0]);
      toast.success(`Status updated to "${nextStatusLabel}".`, toastOptions);
    } catch (err: unknown) {
      toast.error(
        extractErrorMessage(err, "Failed to update status."),
        toastOptions,
      );
    } finally {
      setEditStatusLead(null);
    }
  };

  const filteredLeads = React.useMemo(() => {
    const result = localLeads.filter((lead: ProcessedLead) => {
      const searchStr =
        `${lead.full_name || lead.name || ""} ${lead.displayId || ""}`.toLowerCase();
      const matchSearch = searchStr.includes(search.toLowerCase());
      const matchTab =
        tab === "archived"
          ? lead.is_active === false
          : lead.is_active !== false;
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
            const f = new Date(filters.dateFrom);
            f.setHours(0, 0, 0, 0);
            if (leadDate < f) return false;
          }
          if (filters.dateTo) {
            const t = new Date(filters.dateTo);
            t.setHours(23, 59, 59, 999);
            if (leadDate > t) return false;
          }
        }
      }
      return matchSearch && matchTab;
    });

    return result;
  }, [localLeads, search, tab, filters]);

  const sortedLeads = React.useMemo(() => {
    if (!sortCol) return filteredLeads;
    return [...filteredLeads].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortCol) {
        case "name":
          aVal = a.full_name || "";
          bVal = b.full_name || "";
          break;
        case "date":
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
        case "location":
          aVal = a.location || "";
          bVal = b.location || "";
          break;
        case "source":
          aVal = a.source || "";
          bVal = b.source || "";
          break;
        case "status":
          aVal = a.lead_status || a.status || "";
          bVal = b.lead_status || b.status || "";
          break;
        case "quality":
          aVal = a.quality || "";
          bVal = b.quality || "";
          break;
        case "assigned":
          aVal = a.assigned || a.assigned_to_name || "";
          bVal = b.assigned || b.assigned_to_name || "";
          break;
        case "taskType":
          aVal = a.taskType || "";
          bVal = b.taskType || "";
          break;
        case "taskStatus":
          aVal = a.taskStatus || "";
          bVal = b.taskStatus || "";
          break;
        case "activity":
          aVal = a.activity || "";
          bVal = b.activity || "";
          break;
        default:
          return 0;
      }
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredLeads, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  React.useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [search, tab, filters]);

  const totalEntries = sortedLeads.length;
  const totalPages = Math.ceil(totalEntries / rowsPerPage);
  React.useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
  }, [totalPages, page]);

  const currentLeads = sortedLeads.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );
  const startEntry = totalEntries === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endEntry = Math.min(page * rowsPerPage, totalEntries);

  const handleBulkDelete = () => {
    setLocalLeads((p) => p.filter((l) => !selectedIds.includes(l.id)));
    setSelectedIds([]);
  };
  const handleBulkArchive = (archive: boolean) => {
    setLocalLeads((p) =>
      p.map((l) =>
        selectedIds.includes(l.id) ? { ...l, is_active: !archive } : l,
      ),
    );
    setSelectedIds([]);
  };

  const exportLeadsToCsv = (
    leadsToExport: ProcessedLead[],
    filePrefix: string,
    successMessage: string,
    emptyMessage: string,
  ) => {
    if (leadsToExport.length === 0) {
      toast.info(emptyMessage, toastOptions);
      return;
    }

    const headers = [
      "Lead ID",
      "Name",
      "Phone",
      "Email",
      "Status",
      "Source",
      "Location",
      "Assigned To",
      "Created At",
    ];

    const escapeCsv = (value: unknown): string => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    };

    const rows = leadsToExport.map((lead) => [
      lead.id,
      lead.full_name || lead.name || "",
      lead.contact_no || "",
      lead.email || "",
      lead.status || lead.lead_status || "",
      lead.source || "",
      lead.location || "",
      lead.assigned || lead.assigned_to_name || "",
      lead.created_at || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `${filePrefix}_${stamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success(successMessage, toastOptions);
  };

  const handleBulkExport = () => {
    const selectedLeads = localLeads.filter((lead) =>
      selectedIds.includes(lead.id),
    );
    exportLeadsToCsv(
      selectedLeads,
      "selected_leads_export",
      "Selected leads exported successfully.",
      "No selected leads to export.",
    );
  };

  const handleExportAllLeads = () => {
    exportLeadsToCsv(
      sortedLeads,
      "all_leads_export",
      "All leads exported successfully.",
      "No leads available to export.",
    );
  };

  // ── Loading / Error / Empty states ──────────────────────────────────────────
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
          <Typography color="text.secondary">
            Hold Tight!! Leads are Loading....
          </Typography>
        </Stack>
      </Box>
    );

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
          onClick={() => {
            window.location.reload();
          }
          }
        >
          Try again
        </Typography>
      </Alert>
    );

  if (localLeads.length === 0)
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
          <Typography variant="h6" color="text.secondary">
            No leads found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tab === "archived"
              ? "No archived leads yet"
              : "Create your first lead to get started"}
          </Typography>
        </Stack>
      </Box>
    );

  if (filteredLeads.length === 0)
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
          <Typography variant="h6" color="text.secondary">
            No {tab === "archived" ? "archived" : "active"} leads found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {search
              ? `No results for "${search}"`
              : filters &&
                  Object.values(filters).some((v) => v !== "" && v !== null)
                ? "No leads match the selected filters"
                : tab === "archived"
                  ? "No archived leads yet"
                  : "No active leads"}
          </Typography>
        </Stack>
      </Box>
    );

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 1.5 }}
      >
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {totalEntries} lead{totalEntries !== 1 ? "s" : ""} found
        </Typography>
      </Stack>

      <TableContainer
        component={Paper}
        elevation={0}
        className="leads-table"
        sx={{ overflowX: "auto" }}
      >
        <Table stickyHeader sx={{ minWidth: 1200 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" className="checkbox-cell">
                <Checkbox
                  indeterminate={
                    currentLeads.some((l) => selectedIds.includes(l.id)) &&
                    !currentLeads.every((l) => selectedIds.includes(l.id))
                  }
                  checked={
                    currentLeads.length > 0 &&
                    currentLeads.every((l) => selectedIds.includes(l.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedIds(currentLeads.map((l) => l.id));
                    else setSelectedIds([]);
                  }}
                />
              </TableCell>
              <TableCell
                onClick={() => handleSort("name")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "name" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Lead Name | No
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "name" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "name" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell
                onClick={() => handleSort("date")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "date" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Date | Time
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "date" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "date" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell
                onClick={() => handleSort("location")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "location" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Location
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "location" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "location" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell
                onClick={() => handleSort("source")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "source" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Source
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "source" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "source" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell
                onClick={() => handleSort("status")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "status" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Lead Status
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "status" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "status" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell
                onClick={() => handleSort("quality")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "quality" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Quality
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "quality" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "quality" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              {/* AI Score — hidden for contracts app */}
              {!IS_CONTRACTS_APP && <TableCell>AI Score</TableCell>}
              <TableCell
                onClick={() => handleSort("assigned")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "assigned" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Assigned To
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "assigned" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "assigned" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell
                onClick={() => handleSort("taskType")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "taskType" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Task Type
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "taskType" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "taskType" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell
                onClick={() => handleSort("taskStatus")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "taskStatus" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Task Status
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "taskStatus" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "taskStatus" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell
                onClick={() => handleSort("activity")}
                sx={{
                  cursor: "pointer",
                  userSelect: "none",
                  "& .col-sort-icon": {
                    opacity: sortCol === "activity" ? 1 : 0,
                    transition: "opacity 0.15s",
                  },
                  "&:hover .col-sort-icon": { opacity: 1 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Activity
                  <Box
                    className="col-sort-icon"
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 14,
                      color: sortCol === "activity" ? "#E17E61" : "inherit",
                    }}
                  >
                    {sortCol === "activity" ? (
                      sortDir === "asc" ? (
                        <ArrowUpwardIcon fontSize="inherit" />
                      ) : (
                        <ArrowDownwardIcon fontSize="inherit" />
                      )
                    ) : (
                      <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell align="center" sx={contactHeaderStyle}>
                Contact Option
              </TableCell>
              <TableCell align="center" sx={menuHeaderStyle} />
            </TableRow>
          </TableHead>

          <TableBody>
            {currentLeads.map((lead: ProcessedLead) => (
              <TableRow
                key={lead.id}
                sx={{ cursor: "pointer" }}
                onClick={() =>
                  navigate(
                    `/leads/${encodeURIComponent(lead.id.replace(/^#/, ""))}`,
                  )
                }
                className={isSelected(lead.id) ? "row-selected" : ""}
              >
                <TableCell
                  padding="checkbox"
                  className="checkbox-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                  />
                </TableCell>

                <TableCell>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar className="lead-avatar">
                      {lead.initials ||
                        lead.full_name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography className="lead-name-text">
                        {lead.full_name}
                      </Typography>
                      <Typography className="lead-id-text">
                        {lead.displayId}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Typography className="lead-date">
                    {lead.created_at
                      ? new Date(lead.created_at).toLocaleDateString("en-GB")
                      : "N/A"}
                  </Typography>
                  <Typography className="lead-time">
                    {lead.created_at
                      ? new Date(lead.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"}
                  </Typography>
                </TableCell>

                <TableCell>{lead.location || "N/A"}</TableCell>
                <TableCell>{lead.source || "N/A"}</TableCell>

                {/* ── Lead Status cell with inline edit icon ── */}
                <TableCell>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Chip
                      label={lead.status}
                      size="small"
                      sx={getStatusChipSx(lead.status ?? "")}
                    />
                    <Tooltip title="Edit status">
                      <IconButton
                        size="small"
                        onClick={(e) => handleEditStatusOpen(e, lead)}
                        disabled={!canEditLeads}
                        sx={{
                          p: 0.25,
                          color: "text.secondary",
                          "&:hover": { color: "primary.main" },
                        }}
                      >
                        <Box
                          component="img"
                          src={Lead_Status_Edit}
                          alt="Edit status"
                          sx={{ width: 14, height: 14 }}
                        />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Chip
                    label={lead.quality}
                    size="small"
                    className={`lead-chip quality-${lead.quality?.toLowerCase()}`}
                  />
                </TableCell>

                {/* AI Score — hidden for contracts app */}
                {!IS_CONTRACTS_APP && (
                  <TableCell className="score">
                    {String(lead.score || 0).includes("%")
                      ? lead.score
                      : `${lead.score || 0}%`}
                  </TableCell>
                )}

                <TableCell>{lead.assigned}</TableCell>

                <TableCell>
                  <Typography
                    sx={{
                      fontSize: "13px",
                      color: lead.taskType ? "#1E293B" : "#94A3B8",
                      fontWeight: lead.taskType ? 500 : 400,
                    }}
                  >
                    {lead.taskType
                      ? lead.taskType.charAt(0).toUpperCase() +
                        lead.taskType.slice(1)
                      : "—"}
                  </Typography>
                </TableCell>

                <TableCell>
                  {lead.taskStatus ? (
                    <Chip
                      label={lead.taskStatus}
                      size="small"
                      sx={getTaskStatusChipSx(lead.taskStatus)}
                    />
                  ) : (
                    <Typography sx={{ fontSize: "13px", color: "#94A3B8" }}>
                      —
                    </Typography>
                  )}
                </TableCell>

                <TableCell
                  sx={{ color: "primary.main", fontWeight: 700 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/leads/activity", { state: { lead } });
                  }}
                >
                  {lead.activity || "View Activity"}
                </TableCell>

                <TableCell
                  align="center"
                  sx={contactCellStyle}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const hasPhone = hasUsablePhone(lead.contact_no);
                    return (
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="center"
                      >
                        <Tooltip
                          title={
                            hasPhone
                              ? `Call ${lead.contact_no || "N/A"}`
                              : "No contact number"
                          }
                        >
                          <span>
                            <IconButton
                              className="action-btn"
                              size="small"
                              disabled={!hasPhone}
                              onClick={(e) => handleCallOpen(e, lead)}
                            >
                              <PhoneIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            hasPhone
                              ? `SMS ${lead.contact_no || "N/A"}`
                              : "No contact number"
                          }
                        >
                          <span>
                            <IconButton
                              className="action-btn"
                              size="small"
                              disabled={!hasPhone}
                              onClick={(e) => handleSMSOpen(e, lead)}
                            >
                              <ChatBubbleOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            lead.email ? `Email ${lead.email}` : "No email"
                          }
                        >
                          <span>
                            <IconButton
                              className="action-btn"
                              size="small"
                              disabled={!lead.email}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEmailLead(lead);
                              }}
                            >
                              <EmailOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    );
                  })()}
                </TableCell>

                <TableCell
                  align="center"
                  sx={menuCellStyle}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MenuButton
                    lead={lead}
                    setLeads={setLocalLeads}
                    tab={tab}
                    canEditLeads={canEditLeads}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Pagination */}
      <Stack
        direction="row"
        justifyContent="space-between"
        sx={{ mt: 2, px: 2 }}
      >
        <Typography color="text.secondary">
          Showing {startEntry} to {endEntry} of {totalEntries}
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeftIcon />
          </IconButton>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Box
              key={p}
              onClick={() => setPage(p)}
              className={`page-number ${page === p ? "active" : ""}`}
            >
              {p}
            </Box>
          ))}
          <IconButton
            disabled={page === totalPages || totalPages === 0}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      </Stack>
      <BulkActionBar
        selectedIds={selectedIds}
        tab={tab}
        onDelete={handleBulkDelete}
        onArchive={handleBulkArchive}
        onExport={handleBulkExport}
        onExportAll={handleExportAllLeads}
      />
      <Dialogs />

      {/* ✅ FIXED: CallDialog now receives toNumber and leadUuid for real Twilio browser call */}
      <CallDialog
        open={Boolean(callLead)}
        name={callLead?.full_name || callLead?.name || "Unknown"}
        toNumber={normalizePhone(callLead?.contact_no)}
        leadUuid={callLead?.id || ""}
        agentIdentity="agent"
        onClose={() => setCallLead(null)}
      />

      <SMSDialog
        open={Boolean(smsLead)}
        lead={smsLead}
        onClose={() => setSmsLead(null)}
      />
      <EmailDialog
        open={Boolean(emailLead)}
        lead={emailLead}
        onClose={() => setEmailLead(null)}
      />

      {/* ── Edit Status Dialog ── */}
      <EditStatusDialog
        open={Boolean(editStatusLead)}
        currentStatus={
          editStatusLead?.status ??
          BACKEND_TO_DISPLAY[
            editStatusLead?.lead_status?.toLowerCase() ?? ""
          ] ??
          editStatusLead?.lead_status ??
          "New"
        }
        statusOptions={editStatusOptions}
        onClose={() => setEditStatusLead(null)}
        onSave={handleEditStatusSave}
      />
    </>
  );
};

export default LeadsTable;