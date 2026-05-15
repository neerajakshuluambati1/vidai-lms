import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  IconButton,
  Box,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CloseIcon from "@mui/icons-material/Close";
import dayjs, { Dayjs } from "dayjs";

// import { DepartmentAPI, EmployeeAPI } from "../../services/leads.api";
// import type { Department, Employee } from "../../services/leads.api";
import {
  SOURCE_OPTIONS,
  SUB_SOURCE_OPTIONS,
  REFERRAL_DEPARTMENT_OPTIONS,
} from "./addNewLead.constants";
import type { FilterValues } from "../../types/leads.types";
import {
  pipelineApi,
  isActiveStageStatus,
  type Pipeline,
} from "../../services/pipeline.api";
import type { Lead } from "../../services/leads.api";

// ── Only pipeline/industry keys remain — filter keys are fully removed ────────
const STORAGE_KEY_SELECTED_INDUSTRY = "leads_selected_industry";
const STORAGE_KEY_SELECTED_PIPELINE = "leads_selected_pipeline_id";

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface FilterDialogProps {
  open: boolean;
  onClose: () => void;
  onApplyFilters?: (filters: FilterValues & { location?: string }) => void;
  leads?: Lead[];
}

// ── Component ─────────────────────────────────────────────────────────────────
const FilterDialog: React.FC<FilterDialogProps> = ({
  open,
  onClose,
  onApplyFilters,
  leads = [],
}) => {
  const [clinicId] = React.useState(
    Number(localStorage.getItem("clinic_id") ?? 1),
  );

  // const [departments, setDepartments] = React.useState<Department[]>([]);
  // const [employees, setEmployees] = React.useState<Employee[]>([]);
  // const [filteredEmployees, setFilteredEmployees] = React.useState<Employee[]>([]);

  // const setLoadingDepartments = React.useState(false)[1];
  // const [loadingEmployees, setLoadingEmployees] = React.useState(false);

  const [pipelineStageNames, setPipelineStageNames] = React.useState<string[]>([]);
  const [loadingPipeline, setLoadingPipeline] = React.useState(false);

  // ── All filter state starts empty — never read from localStorage ──────────
  const [filters, setFilters] = React.useState<FilterValues>(defaultFilters);
  const [dateFrom, setDateFrom] = React.useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = React.useState<Dayjs | null>(null);
  const [location, setLocation] = React.useState<string>("");

  // ── Unique locations derived from current leads ───────────────────────────
  const availableLocations = React.useMemo(() => {
    if (!leads || leads.length === 0) return [];
    const locationSet = new Set<string>();
    leads.forEach((lead) => {
      if (lead.location && lead.location.trim()) {
        locationSet.add(lead.location.trim());
      }
    });
    return Array.from(locationSet).sort();
  }, [leads]);

  const availableAssignees = React.useMemo(() => {
    const map = new Map();

    leads.forEach((lead) => {
      if (lead.assigned_to_id && lead.assigned_to_name) {
        map.set(lead.assigned_to_id, lead.assigned_to_name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [leads]);

  // ── Load pipeline stages when dialog opens ────────────────────────────────
  React.useEffect(() => {
    if (!open) return;

    const loadStages = async () => {
      try {
        setLoadingPipeline(true);
        const selectedIndustry =
          localStorage.getItem(STORAGE_KEY_SELECTED_INDUSTRY) ?? "";
        const selectedPipelineId =
          localStorage.getItem(STORAGE_KEY_SELECTED_PIPELINE) ?? "";

        const pipelines = await pipelineApi.list(clinicId);
        const byIndustry = selectedIndustry
          ? pipelines.filter((p) => p.industry_type === selectedIndustry)
          : pipelines;

        const selectedPipeline =
          pipelines.find((p) => p.id === selectedPipelineId) ??
          byIndustry.find((p) => p.is_active) ??
          byIndustry[0] ??
          pipelines.find((p) => p.is_active) ??
          pipelines[0] ??
          null;

        const activeStages = (selectedPipeline?.stages ?? [])
          .filter((s) => isActiveStageStatus(s.stage_status))
          .filter((s) => s.stage_name.trim())
          .sort((a, b) => {
            const aOrder = typeof a.stage_order === "number" ? a.stage_order : 0;
            const bOrder = typeof b.stage_order === "number" ? b.stage_order : 0;
            return aOrder - bOrder;
          })
          .map((s) => s.stage_name.trim());

        setPipelineStageNames(activeStages);
      } catch {
        setPipelineStageNames([]);
      } finally {
        setLoadingPipeline(false);
      }
    };

    void loadStages();
  }, [open, clinicId]);

  // ── Load departments when dialog opens ────────────────────────────────────
  // React.useEffect(() => {
  //   if (!open) return;
  //   const fetchDepartments = async () => {
  //     try {
  //       setLoadingDepartments(true);
  //       const data = await DepartmentAPI.listActiveByClinic(clinicId);
  //       setDepartments(data);
  //     } catch (err) {
  //       console.error("Failed to load departments:", err);
  //     } finally {
  //       setLoadingDepartments(false);
  //     }
  //   };
  //   void fetchDepartments();
  // }, [open, clinicId]);

  // ── Load employees when dialog opens ─────────────────────────────────────
  // React.useEffect(() => {
  //   if (!open) return;
  //   const fetchEmployees = async () => {
  //     try {
  //       setLoadingEmployees(true);
  //       const data = await EmployeeAPI.listByClinic(clinicId);
  //       setEmployees(Array.isArray(data) ? data : []);
  //     } catch (err) {
  //       console.error("Failed to load employees:", err);
  //       setEmployees([]);
  //     } finally {
  //       setLoadingEmployees(false);
  //     }
  //   };
  //   void fetchEmployees();
  // }, [open, clinicId]);

  // ── Filter employees by selected department ───────────────────────────────
  // React.useEffect(() => {
  //   if (!filters.department || employees.length === 0) {
  //     setFilteredEmployees(employees);
  //     return;
  //   }
  //   const selectedDept = departments.find(
  //     (d) => d.id === Number(filters.department),
  //   );
  //   if (!selectedDept) {
  //     setFilteredEmployees(employees);
  //     return;
  //   }
  //   const normalize = (s: string) => (s ?? "").trim().toLowerCase();
  //   setFilteredEmployees(
  //     employees.filter(
  //       (emp) => normalize(emp.department_name) === normalize(selectedDept.name),
  //     ),
  //   );
  // }, [filters.department, employees, departments]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFilterChange = (field: keyof FilterValues, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "department" ? { assignee: "" } : {}),
      ...(field === "source" ? { subSource: "" } : {}),
    }));
  };

  const handleDateFromChange = (newValue: Date | Dayjs | null) => {
    const parsed = newValue ? dayjs(newValue) : null;
    setDateFrom(parsed);
    setFilters((prev) => ({
      ...prev,
      dateFrom: parsed ? parsed.format("YYYY-MM-DD") : null,
    }));
  };

  const handleDateToChange = (newValue: Date | Dayjs | null) => {
    const parsed = newValue ? dayjs(newValue) : null;
    setDateTo(parsed);
    setFilters((prev) => ({
      ...prev,
      dateTo: parsed ? parsed.format("YYYY-MM-DD") : null,
    }));
  };

  const handleApply = () => {
    // Filters live in React state only — no localStorage write
    if (onApplyFilters) onApplyFilters({ ...filters, location });
    onClose();
  };

  const handleClearAll = () => {
    const emptyFilters = defaultFilters();

    // One-time cleanup of any stale keys left by the old implementation
    try {
      localStorage.removeItem("leads_filter_values");
      localStorage.removeItem("leads_filter_location");
    } catch {
      /* ignore */
    }

    setFilters(emptyFilters);
    setDateFrom(null);
    setDateTo(null);
    setLocation("");

    if (onApplyFilters) onApplyFilters({ ...emptyFilters, location: "" });
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const labelStyle = {
    fontSize: "11px",
    color: "#9CA3AF",
    fontWeight: 400,
    mb: 0.5,
    display: "block",
  };

  const inputStyle = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "6px",
      fontSize: "13px",
      backgroundColor: "#FFFFFF",
      height: "40px",
      "& fieldset": { borderColor: "#E5E7EB" },
      "&:hover fieldset": { borderColor: "#D1D5DB" },
      "&.Mui-focused fieldset": {
        borderColor: "#9CA3AF",
        borderWidth: "1px",
      },
    },
    "& .MuiInputBase-input": {
      padding: "9px 12px",
      fontSize: "13px",
      height: "40px",
      boxSizing: "border-box",
    },
    "& .MuiSelect-select": {
      padding: "9px 12px",
      height: "40px",
      display: "flex",
      alignItems: "center",
    },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "12px",
          width: { xs: "calc(100vw - 24px)", sm: "580px" },
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "90vh",
          m: { xs: 1.5, sm: 2 },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 3,
          py: 2,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ fontSize: "16px", color: "#111827" }}
        >
          Filter By
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: "#6B7280" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 0, pb: 2 }}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

            {/* Row 1: From Date & To Date */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Box>
                <Typography sx={labelStyle}>From Date</Typography>
                <DatePicker
                  value={dateFrom}
                  onChange={handleDateFromChange}
                  format="DD/MM/YYYY"
                  slotProps={{
                    textField: { size: "small", fullWidth: true, placeholder: "DD/MM/YYYY", sx: inputStyle },
                  }}
                />
              </Box>
              <Box>
                <Typography sx={labelStyle}>To Date</Typography>
                <DatePicker
                  value={dateTo}
                  onChange={handleDateToChange}
                  minDate={dateFrom || undefined}
                  format="DD/MM/YYYY"
                  slotProps={{
                    textField: { size: "small", fullWidth: true, placeholder: "DD/MM/YYYY", sx: inputStyle },
                  }}
                />
              </Box>
            </Box>

            {/* Row 2: Lead Quality & Status */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Box>
                <Typography sx={labelStyle}>Lead Quality</Typography>
                <TextField
                  select fullWidth size="small"
                  value={filters.quality}
                  onChange={(e) => handleFilterChange("quality", e.target.value)}
                  sx={inputStyle}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">Select Quality</MenuItem>
                  <MenuItem value="Hot">Hot</MenuItem>
                  <MenuItem value="Warm">Warm</MenuItem>
                  <MenuItem value="Cold">Cold</MenuItem>
                </TextField>
              </Box>
              <Box>
                <Typography sx={labelStyle}>Status</Typography>
                <TextField
                  select fullWidth size="small"
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  disabled={loadingPipeline}
                  sx={inputStyle}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">
                    {loadingPipeline ? "Loading…" : "Select Status"}
                  </MenuItem>
                  {pipelineStageNames.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>

            {/* Row 3: Location & Assignee */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Box>
                <Typography sx={labelStyle}>Location</Typography>
                <TextField
                  select fullWidth size="small"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  sx={inputStyle}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">Select Location</MenuItem>
                  {availableLocations.map((loc) => (
                    <MenuItem key={loc} value={loc}>{loc}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box>
                <Typography sx={labelStyle}>Assignee</Typography>
                <TextField
                  select fullWidth size="small"
                  value={filters.assignee}
                  onChange={(e) => handleFilterChange("assignee", e.target.value)}
                  // disabled={loadingEmployees}
                  sx={inputStyle}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">Select Assignee</MenuItem>
                  {availableAssignees.map((a) => (
                    <MenuItem key={a.id} value={a.id.toString()}>
                      {a.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>

            {/* Row 4: Source & Sub-Source */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Box>
                <Typography sx={labelStyle}>Source</Typography>
                <TextField
                  select fullWidth size="small"
                  value={filters.source}
                  onChange={(e) => handleFilterChange("source", e.target.value)}
                  sx={inputStyle}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">Select Source</MenuItem>
                  {SOURCE_OPTIONS.map((value) => (
                    <MenuItem key={value} value={value}>{value}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box>
                <Typography sx={labelStyle}>Sub-Source</Typography>
                <TextField
                  select fullWidth size="small"
                  value={filters.subSource}
                  onChange={(e) => handleFilterChange("subSource", e.target.value)}
                  disabled={!filters.source || filters.source === "Other"}
                  sx={inputStyle}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">Select Sub-Source</MenuItem>
                  {(() => {
                    if (!filters.source || filters.source === "Other") return null;
                    const availableSubSources =
                      filters.source === "Referral"
                        ? REFERRAL_DEPARTMENT_OPTIONS
                        : (SUB_SOURCE_OPTIONS[filters.source] ?? []);
                    return availableSubSources.length > 0
                      ? availableSubSources.map((value) => (
                          <MenuItem key={value} value={value}>{value}</MenuItem>
                        ))
                      : <MenuItem value="" disabled>No sub-sources available</MenuItem>;
                  })()}
                </TextField>
              </Box>
            </Box>

          </Box>
        </LocalizationProvider>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          pb: 3,
          pt: 1,
          gap: 2,
          flexDirection: { xs: "column-reverse", sm: "row" },
          alignItems: "stretch",
        }}
      >
        <Button
          onClick={handleClearAll}
          fullWidth
          variant="outlined"
          sx={{
            height: 40,
            borderRadius: "6px",
            textTransform: "none",
            fontWeight: 500,
            fontSize: "14px",
            color: "#374151",
            borderColor: "#E5E7EB",
            "&:hover": { borderColor: "#D1D5DB", bgcolor: "#F9FAFB" },
          }}
        >
          Clear All
        </Button>
        <Button
          onClick={handleApply}
          fullWidth
          variant="contained"
          sx={{
            height: 40,
            bgcolor: "#2C2C2C",
            borderRadius: "6px",
            textTransform: "none",
            fontWeight: 500,
            fontSize: "14px",
            boxShadow: "none",
            "&:hover": { bgcolor: "#1A1A1A", boxShadow: "none" },
          }}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilterDialog;