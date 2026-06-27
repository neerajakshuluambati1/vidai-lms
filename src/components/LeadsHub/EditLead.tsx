// ============================================================
// EditLead.tsx  –  Pure JSX / render layer
// All state & logic lives in useEditLead.ts
// ============================================================
import * as React from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  MenuItem,
  Stack,
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Autocomplete,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CloseIcon from "@mui/icons-material/Close";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { toast } from "react-toastify";

import {
  SOURCE_OPTIONS,
  SUB_SOURCE_OPTIONS,
} from "../LeadsHub/addNewLead.constants";
import {
  useEditLead,
  formatLeadId,
  formatBytes,
  getFileTypeLabel,
  TIME_SLOTS,
  STEPS,
  TOTAL_STEPS,
  inputStyle,
  readOnlyStyle,
  labelStyle,
  sectionLabelStyle,
  TASK_STATUS_OPTIONS,
} from "./UseEditLead";
import { sanitizeNameInput } from "../../utils/nameValidation";
import { capitalizeFirst } from "../../utils/nameValidation";
import {
  sanitizePhoneInput,
  sanitizeEmailFieldInput,
  sanitizeLocationInput,
  sanitizeAddressInput,
} from "../../utils/leadFieldValidation";

const INPUT_TOAST_OPTIONS = { position: "top-right" as const, autoClose: 1400 };

const showInputToast = (toastId: string, message: string) => {
  if (!toast.isActive(toastId)) {
    toast.error(message, { ...INPUT_TOAST_OPTIONS, toastId });
  }
};

const inputStyleWithError = (hasError: boolean) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    fontSize: "0.875rem",
    "& fieldset": { borderColor: hasError ? "#EF4444" : "#E2E8F0" },
    "&:hover fieldset": { borderColor: hasError ? "#EF4444" : "#CBD5E1" },
    "&.Mui-focused fieldset": {
      borderColor: hasError ? "#EF4444" : "#6366F1",
    },
  },
});

// ── Capitalize first letter of each word (for action type labels) ─────────────
const capitalizeWords = (str: string): string =>
  str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const SLOT_MENU_PROPS = {
  anchorOrigin: { vertical: "bottom" as const, horizontal: "left" as const },
  transformOrigin: { vertical: "top" as const, horizontal: "left" as const },
  PaperProps: {
    sx: {
      "& .MuiMenu-list": {
        maxHeight: "200px",
        overflowY: "auto",
        scrollbarWidth: "thin",
        "&::-webkit-scrollbar": { width: "4px" },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "#CBD5E1",
          borderRadius: "4px",
        },
      },
      "& .MuiMenuItem-root": {
        justifyContent: "flex-start",
        fontSize: "0.875rem",
        whiteSpace: "nowrap",
      },
    },
  },
};

// ── ALL BCP-47 language codes to iterate over ────────────────────────────────
const ALL_LANGUAGE_CODES: string[] = [
  "ab","aa","af","ak","sq","am","ar","an","hy","as","av","ae","ay","az",
  "bm","ba","eu","be","bn","bh","bi","bs","br","bg","my","ca","ch","ce",
  "ny","zh","cv","kw","co","cr","hr","cs","da","dv","nl","dz","en","eo",
  "et","ee","fo","fj","fi","fr","ff","gl","ka","de","el","gn","gu","ht",
  "ha","he","hz","hi","ho","hu","ia","id","ie","ga","ig","ik","io","is",
  "it","iu","ja","jv","kl","kn","kr","ks","kk","km","ki","rw","ky","kv",
  "kg","ko","ku","kj","la","lb","lg","li","ln","lo","lt","lu","lv","gv",
  "mk","mg","ms","ml","mt","mi","mr","mh","mn","na","nv","nd","ne","ng",
  "nb","nn","no","ii","nr","oc","oj","cu","om","or","os","pa","pi","fa",
  "pl","ps","pt","qu","rm","rn","ro","ru","sa","sc","sd","se","sm","sg",
  "sr","gd","sn","si","sk","sl","so","st","es","su","sw","ss","sv","ta",
  "te","tg","th","ti","bo","tk","tl","tn","to","tr","ts","tt","tw","ty",
  "ug","uk","ur","uz","ve","vi","vo","wa","cy","wo","fy","xh","yi","yo",
  "za","zu",
  "fil","haw","hmn","ilo","jw","ceb","war","min","bug","ban","ace","mad",
  "mak","gor","sas","nds","pms","scn","lmo","vec","fur","lij","nap","szl",
  "csb","hsb","dsb","rue",
  "zh-Hans","zh-Hant","pt-BR","pt-PT","es-419",
  "sr-Latn","sr-Cyrl","uz-Latn","uz-Cyrl","az-Latn","az-Cyrl",
  "bs-Latn","bs-Cyrl",
];

function getLanguagesFromBrowser(): string[] {
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    const seen = new Set<string>();
    const result: string[] = [];

    for (const code of ALL_LANGUAGE_CODES) {
      try {
        const name = displayNames.of(code);
        if (name && name !== code && !seen.has(name)) {
          seen.add(name);
          result.push(name);
        }
      } catch {
        // skip invalid codes
      }
    }

    return result.sort((a, b) => a.localeCompare(b));
  } catch {
    return [
      "Afrikaans","Albanian","Amharic","Arabic","Armenian","Azerbaijani",
      "Basque","Belarusian","Bengali","Bosnian","Bulgarian","Burmese",
      "Catalan","Chinese","Croatian","Czech","Danish","Dutch","English",
      "Esperanto","Estonian","Finnish","French","Galician","Georgian",
      "German","Greek","Gujarati","Haitian Creole","Hausa","Hebrew",
      "Hindi","Hungarian","Icelandic","Igbo","Indonesian","Irish",
      "Italian","Japanese","Javanese","Kannada","Kazakh","Khmer","Korean",
      "Kurdish","Kyrgyz","Lao","Latin","Latvian","Lithuanian","Macedonian",
      "Malagasy","Malay","Malayalam","Maltese","Maori","Marathi","Mongolian",
      "Nepali","Norwegian","Odia","Pashto","Persian","Polish","Portuguese",
      "Punjabi","Romanian","Russian","Sanskrit","Serbian","Sinhala","Slovak",
      "Slovenian","Somali","Spanish","Sundanese","Swahili","Swedish","Tagalog",
      "Tajik","Tamil","Telugu","Thai","Tibetan","Turkish","Turkmen","Ukrainian",
      "Urdu","Uzbek","Vietnamese","Welsh","Xhosa","Yoruba","Zulu",
    ].sort();
  }
}

// ── Hook: all languages from browser Intl API — no network, no API key ───────
function useAllLanguages() {
  const [languages, setLanguages] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setLanguages(getLanguagesFromBrowser());
      setLoading(false);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return { languages, loading };
}

export default function EditLead() {
  // ── Language hook (replaces hardcoded 3-item list) ────────────────────────
  const { languages: allLanguages, loading: languagesLoading } = useAllLanguages();
  const [invalidFields, setInvalidFields] = React.useState<Record<string, boolean>>({});

  const {
    navigate,
    currentStep,
    setCurrentStep,
    loading,
    error,
    setError,
    saving,
    canEditLeads,
  
    filteredCampaigns,
    departments,
    loadingDepartments,
    loadingEmployees,
    employeeError,
    setEmployeeError,
    leadData,
    // ── Pipeline / stage ──
    leadStatusOptions,
    filteredNextActionStatusOptions,
    nextActionTypeOptions,
    leadStatus,
    handleLeadStatusChange,
    handleNextStatusChange,
    handleSourceChange,
    handleSubSourceChange,
    referralDepartments,
    loadingReferralDepts,
    referralDepartment,
    resolvedDataCaptureFields,
    dataCaptureValues,
    setDataCaptureValues,
    // ── Shared fields ──
    fullName,
    setFullName,
    contactNo,
    setContactNo,
    email,
    setEmail,
    location,
    setLocation,
    address,
    setAddress,
    source,
    subSource,
    campaign,
    handleCampaignChange,
    assignee,
    setAssignee,
    assigneeName,
    setAssigneeName,
    setAssigneeSearch,
    assigneeOptions,
    assigneeLoading,
    nextType,
    nextStatus,
    nextDesc,
    setNextDesc,
    handleNextTypeChange,
    // ── Task Status ── NEW
    taskStatus,
    setTaskStatus,
    // ── Medical-only fields ──
    gender,
    setGender,
    age,
    setAge,
    marital,
    setMarital,
    language,
    setLanguage,
    isCouple,
    setIsCouple,
    partnerName,
    setPartnerName,
    partnerAge,
    setPartnerAge,
    partnerGender,
    setPartnerGender,
    // ── Contracts-only fields ──
    contactPersonName,
    setContactPersonName,
    designation,
    setDesignation,
    contactPersonPhone,
    setContactPersonPhone,
    contactPersonEmail,
    setContactPersonEmail,
    // ── Step 2 ──
    treatmentInterest,
    setTreatmentInterest,
    treatments,
    setTreatments,
    documents,
    handleFileChange,
    handleRemoveDocument,
    existingDocuments,
    docsLoading,
    handleRemoveExistingDocument,
    // ── Step 3 ──
    wantAppointment,
    department,
    setDepartment,
    setAppointmentPersonnel,
    appointmentPersonnelSearch,
    setAppointmentPersonnelSearch,
    appointmentPersonnelOptions,
    appointmentPersonnelLoading,
    selectedAppointmentPersonnel,
    personnelOptionLabel,
    selectedDate,
    handleDateChange,
    slot,
    setSlot,
    remark,
    setRemark,
    handleSave,
    handleWantAppointmentChange,
    // ── App-type flags ──
    IS_MEDICAL_APP,
    IS_CONTRACTS_APP,
    ACTIVE_FLOW_COPY,
    interests,
  } = useEditLead();

  const clearInvalidField = React.useCallback((field: string) => {
    setInvalidFields((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const hasError = (field: string): boolean => Boolean(invalidFields[field]);

  React.useEffect(() => {
    if (department) clearInvalidField("department");
    if (selectedDate) clearInvalidField("appointmentDate");
    if (slot) clearInvalidField("slot");
  }, [clearInvalidField, department, selectedDate, slot]);

  // ====================== Loading / Error states ======================
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading lead...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error && !leadData) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography fontWeight={600}>Failed to load lead</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
        <Button onClick={() => navigate("/leads")}>Back to Leads</Button>
      </Box>
    );
  }

  if (!leadData) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Lead not found</Typography>
        <Button onClick={() => navigate("/leads")}>Back to Leads</Button>
      </Box>
    );
  }

  const leadLabel = leadData.id ? formatLeadId(leadData.id.toString()) : "";

  // ── Campaign disabled when source is Referral OR Direct + non-Gmail ────────
  const isCampaignDisabled =
    source === "Referral" ||
    (source === "Direct" && subSource !== "Gmail");

  // ── Sub-source options — referral dept names when source is "Referral" ─────
  const subSourceOptions: string[] =
    source === "Referral"
      ? referralDepartments.map((d) => d.name)
      : (SUB_SOURCE_OPTIONS[source] ?? []);
  const referralDepartmentDisplay =
    referralDepartments.find((d) => String(d.id) === referralDepartment)?.name ||
    leadData.referral_department_name ||
    referralDepartment ||
    "N/A";

  const handleValidatedSave = () => {
    const nextInvalidFields: Record<string, boolean> = {};
    const bookingActive =
      wantAppointment === "yes" ||
      Boolean((selectedDate || leadData?.appointment_date) && slot) ||
      Boolean(leadData?.book_appointment);

    if (bookingActive) {
      if (IS_MEDICAL_APP && !department) nextInvalidFields.department = true;
      if (!selectedDate && !leadData?.appointment_date) {
        nextInvalidFields.appointmentDate = true;
      }
      if (!slot) nextInvalidFields.slot = true;
    }

    setInvalidFields(nextInvalidFields);
    handleSave();
  };

  // ── Input sanitizers ───────────────────────────────────────────────────────
  const handleFullNameChange = (value: string) => {
    const sanitized = sanitizeNameInput(value);
    if (sanitized !== value)
      showInputToast(
        "edit-lead-name-invalid",
        "Only letters, numbers and spaces allowed",
      );
    setFullName(capitalizeFirst(sanitized));
  };

  const handlePartnerNameChange = (value: string) => {
    const sanitized = sanitizeNameInput(value);
    if (sanitized !== value)
      showInputToast(
        "edit-lead-name-invalid",
        "Only letters, numbers and spaces allowed",
      );
    setPartnerName(capitalizeFirst(sanitized));
  };

  const handleContactPersonNameChange = (value: string) => {
    const sanitized = sanitizeNameInput(value);
    if (sanitized !== value)
      showInputToast(
        "edit-lead-name-invalid",
        "Only letters, numbers and spaces allowed",
      );
    setContactPersonName(capitalizeFirst(sanitized));
  };

  const handleContactChange = (value: string) => {
    const { value: sanitized, error } = sanitizePhoneInput(value);
    if (error) showInputToast("edit-lead-contact-invalid", error);
    setContactNo(sanitized);
  };

  const handleEmailChange = (value: string) => {
    const { value: sanitized, error } = sanitizeEmailFieldInput(value);
    if (error) showInputToast("edit-lead-email-invalid", error);
    setEmail(sanitized);
  };

  const handleLocationChange = (value: string) => {
    const { value: sanitized, error } = sanitizeLocationInput(value);
    if (error) showInputToast("edit-lead-location-invalid", error);
    setLocation(sanitized);
  };

  const handleAddressChange = (value: string) => {
    const { value: sanitized, error } = sanitizeAddressInput(value);
    if (error) showInputToast("edit-lead-address-invalid", error);
    setAddress(sanitized);
  };

  const handleContactPersonPhoneChange = (value: string) => {
    const { value: sanitized, error } = sanitizePhoneInput(value);
    if (error) showInputToast("edit-lead-contact-person-phone-invalid", error);
    setContactPersonPhone(sanitized);
  };

  const handleContactPersonEmailChange = (value: string) => {
    const { value: sanitized, error } = sanitizeEmailFieldInput(value);
    if (error) showInputToast("edit-lead-contact-person-email-invalid", error);
    setContactPersonEmail(sanitized);
  };

  const assigneeOptionLabel = (option: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    role?: string;
    designation?: string;
  }): string => {
    const fullNameStr =
      `${option.first_name ?? ""} ${option.last_name ?? ""}`.trim();
    const primary = fullNameStr || option.username || `User ${option.id}`;
    return primary;
  };

  return (
    <Box>
      {!canEditLeads && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have view-only access. Lead edit is disabled for your role.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {employeeError && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => setEmployeeError(null)}
        >
          Could not load employees: <strong>{employeeError}</strong>
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          borderRadius: "12px",
          overflow: "hidden",
          height: "calc(100vh - 112px)",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ── */}
        <Box sx={{ bgcolor: "#FFFFFF", px: 1, py: 1 }}>
          <Typography fontSize="18px" fontWeight={700} color="#0F172A">
            Edit Lead Details{" "}
            <Typography
              component="span"
              fontSize="14px"
              fontWeight={400}
              color="#64748B"
            >
              ({leadLabel})
            </Typography>
          </Typography>
        </Box>

        {/* ── Stepper ── */}
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
            {STEPS.map((label, index) => {
              const step = index + 1;
              const completed = currentStep > step;
              const active = currentStep === step;
              return (
                <Box
                  key={step}
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      bgcolor: completed
                        ? "#10B981"
                        : active
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
                    {completed ? "✓" : step}
                  </Box>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{
                      fontSize: "0.875rem",
                      color: completed
                        ? "#10B981"
                        : active
                          ? step === 3
                            ? "#3B82F6"
                            : "#F97316"
                          : "#94A3B8",
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ── Scrollable Form Body ── */}
        <Box
          sx={{
            bgcolor: "white",
            p: 1,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            "&::-webkit-scrollbar": { width: "8px" },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "#CBD5E1",
              borderRadius: "4px",
            },
          }}
        >
          {/* ===== STEP 1 ===== */}
          {currentStep === 1 && (
            <Box>
              {/* ── SECTION: Lead Information ── */}
              <Typography sx={sectionLabelStyle}>LEAD INFORMATION</Typography>

              {/* Row 1: Full Name · Contact · Email · Location  (+ Address for CONTRACTS) */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: IS_CONTRACTS_APP
                    ? "repeat(5, 1fr)"
                    : "repeat(4, 1fr)",
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box>
                  <Typography sx={labelStyle}>Lab Name *</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={fullName}
                    onChange={(e) => handleFullNameChange(e.target.value)}
                    sx={inputStyle}
                  />
                </Box>
                <Box>
                  <Typography sx={labelStyle}>Contact No. *</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={contactNo}
                    onChange={(e) => handleContactChange(e.target.value)}
                    sx={inputStyle}
                  />
                </Box>
                <Box>
                  <Typography sx={labelStyle}>Email</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    sx={inputStyle}
                  />
                </Box>
                <Box>
                  <Typography sx={labelStyle}>Location</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={location}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    sx={inputStyle}
                  />
                </Box>
                {IS_CONTRACTS_APP && (
                  <Box>
                    <Typography sx={labelStyle}>Address</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      sx={inputStyle}
                    />
                  </Box>
                )}
              </Box>

              {/* MEDICAL — Row 2: Gender · Age · Marital Status · Address */}
              {IS_MEDICAL_APP && (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Box>
                    <Typography sx={labelStyle}>Gender *</Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      sx={inputStyle}
                    >
                      <MenuItem value="">-- Select --</MenuItem>
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </TextField>
                  </Box>
                  <Box>
                    <Typography sx={labelStyle}>Age *</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      sx={inputStyle}
                    />
                  </Box>
                  <Box>
                    <Typography sx={labelStyle}>Marital Status</Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={marital}
                      onChange={(e) => setMarital(e.target.value)}
                      sx={inputStyle}
                    >
                      <MenuItem value="">-- Select --</MenuItem>
                      <MenuItem value="Married">Married</MenuItem>
                      <MenuItem value="Single">Single</MenuItem>
                    </TextField>
                  </Box>
                  <Box>
                    <Typography sx={labelStyle}>Address</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      sx={inputStyle}
                    />
                  </Box>
                </Box>
              )}

              {/* ── Language Preference — dynamic via Intl.DisplayNames ── */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box>
                  <Typography sx={labelStyle}>Language Preference</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={languagesLoading}
                    sx={inputStyle}
                    InputProps={{
                      endAdornment: languagesLoading ? (
                        <CircularProgress size={16} sx={{ mr: 3 }} />
                      ) : null,
                    }}
                  >
                    <MenuItem value="">
                      {languagesLoading ? "Loading languages…" : "-- Select --"}
                    </MenuItem>
                    {allLanguages.map((lang) => (
                      <MenuItem key={lang} value={lang}>
                        {lang}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Box>

              {/* MEDICAL — Partner Information */}
              {IS_MEDICAL_APP && (
                <>
                  <Typography sx={sectionLabelStyle}>
                    PARTNER INFORMATION
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ ...labelStyle, mb: 0.5 }}>
                      Is This Inquiry For A Couple?
                    </Typography>
                    <RadioGroup
                      row
                      value={isCouple}
                      onChange={(e) =>
                        setIsCouple(e.target.value as "yes" | "no")
                      }
                    >
                      <FormControlLabel
                        value="yes"
                        control={<Radio size="small" />}
                        label="Yes"
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio size="small" />}
                        label="No"
                      />
                    </RadioGroup>
                  </Box>
                  {isCouple === "yes" && (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 2,
                        mb: 3,
                      }}
                    >
                      <Box>
                        <Typography sx={labelStyle}>Full Name</Typography>
                        <TextField
                          fullWidth
                          size="small"
                          value={partnerName}
                          onChange={(e) =>
                            handlePartnerNameChange(e.target.value)
                          }
                          sx={inputStyle}
                        />
                      </Box>
                      <Box>
                        <Typography sx={labelStyle}>Age</Typography>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={partnerAge}
                          onChange={(e) => setPartnerAge(e.target.value)}
                          sx={inputStyle}
                        />
                      </Box>
                      <Box>
                        <Typography sx={labelStyle}>Gender</Typography>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={partnerGender}
                          onChange={(e) => setPartnerGender(e.target.value)}
                          sx={inputStyle}
                        >
                          <MenuItem value="">-- Select --</MenuItem>
                          <MenuItem value="Male">Male</MenuItem>
                          <MenuItem value="Female">Female</MenuItem>
                        </TextField>
                      </Box>
                    </Box>
                  )}
                </>
              )}

              {/* CONTRACTS — Contact Person Information */}
              {IS_CONTRACTS_APP && (
                <>
                  <Typography sx={sectionLabelStyle}>
                    {ACTIVE_FLOW_COPY.contactSectionLabel}
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 2,
                      mb: 3,
                    }}
                  >
                    <Box>
                      <Typography sx={labelStyle}>Full Name</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={contactPersonName}
                        onChange={(e) =>
                          handleContactPersonNameChange(e.target.value)
                        }
                        sx={inputStyle}
                      />
                    </Box>
                    <Box>
                      <Typography sx={labelStyle}>Designation</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        sx={inputStyle}
                      />
                    </Box>
                    <Box>
                      <Typography sx={labelStyle}>Contact No.</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={contactPersonPhone}
                        onChange={(e) =>
                          handleContactPersonPhoneChange(e.target.value)
                        }
                        sx={inputStyle}
                      />
                    </Box>
                    <Box>
                      <Typography sx={labelStyle}>Email</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={contactPersonEmail}
                        onChange={(e) =>
                          handleContactPersonEmailChange(e.target.value)
                        }
                        sx={inputStyle}
                      />
                    </Box>
                  </Box>
                </>
              )}

              {/* ── SECTION: Source & Campaign ── */}
              <Typography sx={sectionLabelStyle}>
                SOURCE & CAMPAIGN DETAILS
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: isCampaignDisabled
                    ? "repeat(2, 1fr)"
                    : "repeat(3, 1fr)",
                  gap: 2,
                  mb: 3,
                }}
              >
                {/* ── Source ── */}
                <Box>
                  <Typography sx={labelStyle}>Source</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={source}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    sx={inputStyle}
                  >
                    <MenuItem value="">-- Select Source --</MenuItem>
                    {SOURCE_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                {/* ── Sub-Source ── */}
                {source !== "Other" && (
                  <Box>
                    <Typography sx={labelStyle}>Sub-Source</Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={subSource}
                      onChange={(e) => handleSubSourceChange(e.target.value)}
                      disabled={
                        !source ||
                        (source === "Referral" && loadingReferralDepts)
                      }
                      sx={inputStyle}
                      InputProps={{
                        endAdornment:
                          source === "Referral" && loadingReferralDepts ? (
                            <CircularProgress size={16} sx={{ mr: 3 }} />
                          ) : null,
                      }}
                    >
                      <MenuItem value="">-- Select Sub-Source --</MenuItem>
                      {source === "Referral" && loadingReferralDepts ? (
                        <MenuItem value="" disabled>
                          Loading departments...
                        </MenuItem>
                      ) : source === "Referral" &&
                        subSourceOptions.length === 0 ? (
                        <MenuItem value="" disabled>
                          No departments available
                        </MenuItem>
                      ) : (
                        subSourceOptions.map((s) => (
                          <MenuItem key={s} value={s}>
                            {s}
                          </MenuItem>
                        ))
                      )}
                      {!source && (
                        <MenuItem value="" disabled>
                          Select source first
                        </MenuItem>
                      )}
                    </TextField>
                  </Box>
                )}

                {/* ── Campaign Name ── */}
                {source !== "Other" && !isCampaignDisabled && (
                  <Box>
                    <Typography sx={labelStyle}>
                      Campaign Name
                      {subSource && (
                        <Typography
                          component="span"
                          sx={{
                            fontSize: "0.65rem",
                            color: "#94A3B8",
                            ml: 1,
                            fontWeight: 500,
                          }}
                        >
                          linked with {subSource}
                        </Typography>
                      )}
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={campaign}
                      onChange={handleCampaignChange}
                      disabled={!source && !subSource}
                      sx={inputStyle}
                    >
                      <MenuItem value="">-- None --</MenuItem>
                      {filteredCampaigns.length === 0 ? (
                        <MenuItem value="" disabled>
                          {source || subSource
                            ? "No campaigns match the selected source / sub-source"
                            : "No campaigns available"}
                        </MenuItem>
                      ) : (
                        filteredCampaigns.map((c) => (
                          <MenuItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </MenuItem>
                        ))
                      )}
                    </TextField>
                  </Box>
                )}
              </Box>

              {/* ── SECTION: Assignee & Next Action ── */}
              <Typography sx={sectionLabelStyle}>
                ASSIGNEE & NEXT ACTION DETAILS
              </Typography>

              {/* Row 1: Assigned To · Referral Dept (NON-CONTRACTS) · Lead Status · Next Action Status */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: IS_CONTRACTS_APP
                    ? "repeat(3, 1fr)"
                    : "repeat(4, 1fr)",
                  gap: 2,
                  mb: 3,
                }}
              >
                {/* Assigned To */}
                <Box>
                  <Typography sx={labelStyle}>Assigned To</Typography>
                  <Autocomplete
                    options={assigneeOptions}
                    loading={assigneeLoading}
                    clearOnBlur={false}
                    filterOptions={(options) => options}
                    value={
                      assigneeOptions.find((o) => String(o.id) === assignee) ||
                      (assignee
                        ? {
                            id: Number(assignee),
                            username: assigneeName,
                          }
                        : null)
                    }
                    inputValue={assigneeName}
                    onInputChange={(_, value, reason) => {
                      if (reason === "reset") return;
                      setAssigneeSearch(value);
                      setAssigneeName(value);
                      setAssignee("");
                    }}
                    onChange={(_, value) => {
                      setAssignee(value ? String(value.id) : "");
                      setAssigneeName(value ? assigneeOptionLabel(value) : "");
                    }}
                    getOptionLabel={assigneeOptionLabel}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    noOptionsText="Type to search assignee"
                    renderOption={(props, option) => (
                      <li {...props} key={option.id}>
                        {assigneeOptionLabel(option)}
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        size="small"
                        placeholder="Search assignee"
                        sx={inputStyle}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {assigneeLoading ? (
                                <CircularProgress size={14} sx={{ mr: 1 }} />
                              ) : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Box>

                {/* CONTRACTS: Referral Department is captured on add and kept read-only after creation. */}
                {IS_CONTRACTS_APP && (
                  <Box>
                    <Typography sx={labelStyle}>Referral Department</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={referralDepartmentDisplay}
                      disabled
                      sx={readOnlyStyle}
                    />
                  </Box>
                )}

                {/* Lead Status */}
                <Box>
                  <Typography sx={labelStyle}>Lead Status</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={leadStatus}
                    onChange={(e) => handleLeadStatusChange(e.target.value)}
                    sx={inputStyle}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {leadStatusOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                {/* Next Action Status */}
                <Box>
                  <Typography sx={labelStyle}>Next Action Status</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={nextStatus}
                    onChange={(e) => handleNextStatusChange(e.target.value)}
                    sx={inputStyle}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {filteredNextActionStatusOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Box>

              {/* Row 2: Next Action Type · Task Status · Next Action Description */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box>
                  <Typography sx={labelStyle}>Next Action Type</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={nextType}
                    onChange={handleNextTypeChange}
                    sx={inputStyle}
                    disabled={nextActionTypeOptions.length === 0}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {nextActionTypeOptions.length === 0 ? (
                      <MenuItem value="" disabled>
                        {leadStatus
                          ? "No actions configured for this stage"
                          : "Select a lead status first"}
                      </MenuItem>
                    ) : (
                      nextActionTypeOptions.map((t) => (
                        <MenuItem key={t} value={t}>
                          {capitalizeWords(t)}
                        </MenuItem>
                      ))
                    )}
                  </TextField>
                </Box>

                {/* ── Task Status ── NEW */}
                <Box>
                  <Typography sx={labelStyle}>Task Status</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value)}
                    sx={inputStyle}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {TASK_STATUS_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box>
                  <Typography sx={labelStyle}>
                    Next Action Description
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={nextDesc}
                    onChange={(e) => setNextDesc(e.target.value)}
                    sx={inputStyle}
                  />
                </Box>
              </Box>

              {resolvedDataCaptureFields.length > 0 && (
                <>
                  <Typography sx={sectionLabelStyle}>
                    STAGE DATA CAPTURE
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 2,
                      mb: 3,
                    }}
                  >
                    {resolvedDataCaptureFields.map((field) => (
                      <Box key={field.key}>
                        <Typography sx={labelStyle}>
                          {field.label}
                          {field.required && (
                            <Typography
                              component="span"
                              sx={{ color: "#EF4444", fontSize: "0.75rem" }}
                            >
                              {" "}*
                            </Typography>
                          )}
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          type={
                            field.type === "number"
                              ? "number"
                              : field.type === "date"
                                ? "date"
                                : "text"
                          }
                          value={dataCaptureValues[field.key] ?? ""}
                          onChange={(e) =>
                            setDataCaptureValues((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          sx={inputStyle}
                        />
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* ===== STEP 2 ===== */}
          {currentStep === 2 && (
            <Box>
              <Typography sx={sectionLabelStyle}>
                {ACTIVE_FLOW_COPY.medicalSection.toUpperCase()}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 2,
                  mb: 2,
                }}
              >
                <Box>
                  <Typography sx={labelStyle}>
                    {ACTIVE_FLOW_COPY.treatmentLabel} *
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={treatmentInterest}
                    onChange={(e) => {
                      const selectedId = String(e.target.value);

                      const selectedInterest = interests.find(
                        (interest) => String(interest.id) === selectedId,
                      );

                      if (!selectedInterest) return;

                      if (!treatments.includes(selectedId)) {
                        setTreatments((prev) => [...prev, selectedId]);
                      }

                      setTreatmentInterest((prev) => {
                        const names = prev
                          ? prev.split(",").map((x) => x.trim())
                          : [];

                        if (names.includes(selectedInterest.name)) {
                          return prev;
                        }

                        return [...names, selectedInterest.name].join(", ");
                      });
                    }}
                    sx={inputStyle}
                  >
                    <MenuItem value="" disabled>
                      Select
                    </MenuItem>
                    {interests.map((opt) => (
                      <MenuItem value={opt.id}>{opt.name}</MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Box>
              {treatments.length > 0 && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mb: 3, flexWrap: "wrap" }}
                >
                  {treatmentInterest
                    .split(",")
                    .filter(Boolean)
                    .map((t) => (
                      <Chip
                        key={t}
                        label={t}
                        size="small"
                        onDelete={() => {
                          const interestToRemove = interests.find(
                            (interest) => interest.name === t,
                          );

                          if (!interestToRemove) return;

                          setTreatments((prev) =>
                            prev.filter(
                              (id) => id !== String(interestToRemove.id),
                            ),
                          );

                          setTreatmentInterest((prev) =>
                            prev
                              .split(",")
                              .map((x) => x.trim())
                              .filter((name) => name !== t)
                              .join(", "),
                          );
                        }}
                        sx={{
                          bgcolor: "#FEE2E2",
                          color: "#B91C1C",
                          fontWeight: 600,
                          border: "1px solid #FCA5A5",
                          "& .MuiChip-deleteIcon": {
                            color: "#B91C1C",
                            "&:hover": { color: "#991B1B" },
                          },
                        }}
                      />
                    ))}
                </Stack>
              )}

              <Typography sx={sectionLabelStyle}>
                DOCUMENTS & REPORTS
              </Typography>

              {docsLoading && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <CircularProgress size={14} />
                  <Typography fontSize="0.78rem" color="text.secondary">
                    Loading saved documents…
                  </Typography>
                </Box>
              )}

              {!docsLoading && existingDocuments.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ ...sectionLabelStyle, mb: 1 }}>
                    PREVIOUSLY UPLOADED
                  </Typography>
                  <Stack spacing={1} sx={{ maxWidth: 470 }}>
                    {existingDocuments.map((doc, idx) => {
                      const isPdf = doc.name.toLowerCase().endsWith(".pdf");
                      const ext =
                        doc.name.split(".").pop()?.toUpperCase() ?? "FILE";
                      return (
                        <Box
                          key={`existing-${idx}`}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            px: 2,
                            py: 1.25,
                            border: "1px solid #E2E8F0",
                            borderRadius: "10px",
                            bgcolor: "#F8FAFC",
                          }}
                        >
                          {isPdf ? (
                            <PictureAsPdfIcon
                              sx={{
                                fontSize: 28,
                                color: "#EF4444",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <InsertDriveFileIcon
                              sx={{
                                fontSize: 28,
                                color: "#6366F1",
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              fontSize="0.82rem"
                              fontWeight={600}
                              color="#1E293B"
                              noWrap
                              title={doc.name}
                            >
                              {doc.name}
                            </Typography>
                            <Typography fontSize="0.72rem" color="#94A3B8">
                              {ext} · Saved
                            </Typography>
                          </Box>
                          {doc.url && (
                            <IconButton
                              size="small"
                              component="a"
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                color: "#6366F1",
                                flexShrink: 0,
                                "&:hover": { bgcolor: "#EEF2FF" },
                              }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveExistingDocument(idx)}
                            sx={{
                              color: "#94A3B8",
                              flexShrink: 0,
                              "&:hover": {
                                color: "#EF4444",
                                bgcolor: "#FEF2F2",
                              },
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              <Box
                sx={{
                  border: "2px dashed #E2E8F0",
                  borderRadius: "10px",
                  p: 3,
                  bgcolor: "#F8FAFC",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1.5,
                  width: 370,
                }}
              >
                <Box sx={{ color: "#94A3B8", fontSize: 36, lineHeight: 1 }}>
                  <InsertDriveFileIcon sx={{ fontSize: 36 }} />
                </Box>
                <Button
                  variant="contained"
                  component="label"
                  sx={{
                    bgcolor: "#64748B",
                    textTransform: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    px: 3,
                    "&:hover": { bgcolor: "#475569" },
                  }}
                >
                  Choose File
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                    onChange={handleFileChange}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {documents.length === 0
                    ? "No File Chosen"
                    : `${documents.length} new file${documents.length > 1 ? "s" : ""} selected`}
                </Typography>
              </Box>

              {documents.length > 0 && (
                <Stack spacing={1} sx={{ mt: 2, width: 470 }}>
                  <Typography sx={{ ...sectionLabelStyle, mb: 0.5 }}>
                    NEW FILES TO UPLOAD
                  </Typography>
                  {documents.map((file, idx) => {
                    const isPdf = file.type === "application/pdf";
                    const typeLabel = getFileTypeLabel(file);
                    return (
                      <Box
                        key={`${file.name}-${idx}`}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          px: 2,
                          py: 1.25,
                          border: "1px solid #E2E8F0",
                          borderRadius: "10px",
                          bgcolor: "#FFFFFF",
                        }}
                      >
                        {isPdf ? (
                          <PictureAsPdfIcon
                            sx={{
                              fontSize: 28,
                              color: "#EF4444",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <InsertDriveFileIcon
                            sx={{
                              fontSize: 28,
                              color: "#6366F1",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            fontSize="0.82rem"
                            fontWeight={600}
                            color="#1E293B"
                            noWrap
                            title={file.name}
                          >
                            {file.name}
                          </Typography>
                          <Typography fontSize="0.72rem" color="#94A3B8">
                            {typeLabel} · {formatBytes(file.size)}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveDocument(idx)}
                          sx={{
                            color: "#94A3B8",
                            flexShrink: 0,
                            "&:hover": {
                              color: "#EF4444",
                              bgcolor: "#FEF2F2",
                            },
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          )}

          {/* ===== STEP 3 ===== */}
          {currentStep === 3 && (
            <Box>
              <Typography sx={sectionLabelStyle}>
                APPOINTMENT DETAILS
              </Typography>
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ ...labelStyle, mb: 0.5 }}>
                  Want to Book an Appointment?
                </Typography>
                <RadioGroup
                  row
                  value={wantAppointment}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "yes" || val === "no")
                      handleWantAppointmentChange(val);
                  }}
                >
                  <FormControlLabel
                    value="yes"
                    control={<Radio size="small" />}
                    label="Yes"
                  />
                  <FormControlLabel
                    value="no"
                    control={<Radio size="small" />}
                    label="No"
                  />
                </RadioGroup>
              </Box>

              {wantAppointment === "yes" && (
                <Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: IS_MEDICAL_APP
                        ? "repeat(4, 1fr)"
                        : "repeat(3, 1fr)",
                      gap: 2,
                      mb: 3,
                    }}
                  >
                    {IS_MEDICAL_APP && (
                      <Box>
                        <Typography sx={labelStyle}>Department *</Typography>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={department}
                          onChange={(e) => {
                            clearInvalidField("department");
                            setDepartment(e.target.value);
                            setAppointmentPersonnel("");
                            setAppointmentPersonnelSearch("");
                          }}
                          error={hasError("department")}
                          sx={inputStyleWithError(hasError("department"))}
                          disabled={loadingDepartments}
                          InputProps={{
                            endAdornment: loadingDepartments ? (
                              <CircularProgress size={14} sx={{ mr: 1 }} />
                            ) : null,
                          }}
                        >
                          <MenuItem value="">
                            <em>-- Select Department --</em>
                          </MenuItem>
                          {departments.map((dept) => (
                            <MenuItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Box>
                    )}
                    <Box>
                      <Typography sx={labelStyle}>Personnel</Typography>
                      <Autocomplete
                        options={appointmentPersonnelOptions}
                        loading={
                          appointmentPersonnelLoading || loadingEmployees
                        }
                        clearOnBlur={false}
                        filterOptions={(options) => options}
                        value={selectedAppointmentPersonnel}
                        inputValue={appointmentPersonnelSearch}
                        onInputChange={(_, value, reason) => {
                          if (reason === "reset") return;
                          setAppointmentPersonnelSearch(value);
                          setAppointmentPersonnel("");
                        }}
                        onChange={(_, value) => {
                          setAppointmentPersonnel(
                            value ? String(value.id) : "",
                          );
                          setAppointmentPersonnelSearch(
                            value ? personnelOptionLabel(value) : "",
                          );
                        }}
                        getOptionLabel={personnelOptionLabel}
                        isOptionEqualToValue={(o, v) => o.id === v.id}
                        disabled={
                          loadingEmployees || (IS_MEDICAL_APP && !department)
                        }
                        noOptionsText={
                          IS_MEDICAL_APP && !department
                            ? "Select department first"
                            : "Type to search personnel"
                        }
                        renderOption={(props, option) => (
                          <li {...props} key={option.id}>
                            {personnelOptionLabel(option)}
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            size="small"
                            placeholder="Search appointment personnel"
                            sx={inputStyle}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {appointmentPersonnelLoading ||
                                  loadingEmployees ? (
                                    <CircularProgress
                                      size={20}
                                      sx={{ mr: 1 }}
                                    />
                                  ) : null}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                    </Box>
                    <Box>
                      <Typography sx={labelStyle}>Date *</Typography>
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                          value={selectedDate}
                          format="DD/MM/YYYY"
                          disablePast
                          onChange={(val) => {
                            clearInvalidField("appointmentDate");
                            handleDateChange(val);
                          }}
                          slotProps={{
                            textField: {
                              size: "small",
                              fullWidth: true,
                              error: hasError("appointmentDate"),
                              sx: inputStyleWithError(hasError("appointmentDate")),
                            },
                          }}
                        />
                      </LocalizationProvider>
                    </Box>
                    <Box>
                      <Typography sx={labelStyle}>Select Slot *</Typography>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={slot}
                        onChange={(e) => {
                          clearInvalidField("slot");
                          setSlot(e.target.value);
                        }}
                        error={hasError("slot")}
                        sx={inputStyleWithError(hasError("slot"))}
                        SelectProps={{
                          native: false,
                          MenuProps: SLOT_MENU_PROPS,
                        }}
                      >
                        <MenuItem value="">
                          <em>Select Time Slot</em>
                        </MenuItem>
                        {TIME_SLOTS.map((ts) => (
                          <MenuItem key={ts} value={ts}>
                            {ts}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography sx={labelStyle}>Remark</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      placeholder="Type Here..."
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      sx={inputStyle}
                    />
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* ── Footer ── */}
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
            disabled={saving}
            sx={{
              textTransform: "none",
              color: "#64748B",
              fontWeight: 700,
              px: 3,
            }}
          >
            Cancel
          </Button>
          {currentStep > 1 && (
            <Button
              onClick={() => setCurrentStep((s) => s - 1)}
              variant="outlined"
              disabled={saving}
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
          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              variant="contained"
              disabled={saving}
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
              onClick={handleValidatedSave}
              variant="contained"
              disabled={saving || !canEditLeads}
              sx={{
                bgcolor: "#334155",
                textTransform: "none",
                fontWeight: 700,
                px: 4,
                minWidth: "100px",
                "&:hover": { bgcolor: "#1E293B" },
              }}
            >
              {saving ? (
                <CircularProgress size={18} sx={{ color: "#fff" }} />
              ) : (
                "Save"
              )}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
