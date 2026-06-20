import * as React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  MenuItem,
  Stack,
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
  Autocomplete,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import type { Department } from "../../services/leads.api";
import type { Interest } from "../../services/leads.api";
import type { ReferralDepartment } from "../../services/referral.api";
import type { FormState } from "../../types/leads.types";
import {
  SOURCE_OPTIONS,
  SUB_SOURCE_OPTIONS,
  TIME_SLOTS,
  inputStyle,
  labelStyle,
  getDocColor,
  TASK_STATUS_OPTIONS,
  type LeadGeneratedByObject,
  type NextActionStatusOption,
} from "../LeadsHub/addNewLead.constants";
import {
  IS_MEDICAL_APP,
  IS_CONTRACTS_APP,
  ACTIVE_FLOW_COPY,
} from "../../config/appType";

// ── Local types ───────────────────────────────────────────────────────────────
type Campaign = { id: string; name: string; source: string; subSource: string };

type AssigneeOption = {
  id: number;
  first_name: string | undefined;
  last_name: string | undefined;
  username: string | undefined;
  role: string | undefined;
  designation: string | undefined;
  email: string | undefined;
};

type DataCaptureFormField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "dropdown";
  required: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const assigneeLabel = (option: AssigneeOption): string => {
  const fullName =
    `${option.first_name ?? ""} ${option.last_name ?? ""}`.trim();
  const primary = fullName || option.username || `User ${option.id}`;
  return primary;
};

// ── Capitalize first letter of each word ─────────────────────────────────────
const capitalizeWords = (str: string): string =>
  str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// ── FIX: normalize for case-insensitive comparison ───────────────────────────
const normalizeForCompare = (val: string): string => val.trim().toLowerCase();

const parseSlotStartTime = (slotStr: string): dayjs.Dayjs | null => {
  const match = slotStr.match(/^(\d{1,2}):(\d{2})\s(AM|PM)/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3];

  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return dayjs().set("hour", hour).set("minute", minute).set("second", 0);
};

const SLOT_MENU_PROPS = {
  anchorOrigin: { vertical: "bottom" as const, horizontal: "left" as const },
  transformOrigin: { vertical: "top" as const, horizontal: "left" as const },
  disablePortal: false,
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

// ── ALL BCP-47 language subtags that have a known display name ────────────────
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
  "fil","haw","hmn","ilo","jw","ceb","tl","war","min","su","bug","ban",
  "ace","mad","bali","mak","gor","sas","nds","pms","scn","lmo","vec",
  "fur","lij","nap","szl","csb","hsb","dsb","rue","be-tarask",
  "zh-Hans","zh-Hant","pt-BR","pt-PT","es-419",
  "sr-Latn","sr-Cyrl","uz-Latn","uz-Cyrl","az-Latn","az-Cyrl",
  "bs-Latn","bs-Cyrl","shi-Latn","shi-Tfng",
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
        // Skip invalid codes silently
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

function useUSLanguages() {
  const [languages, setLanguages] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const id = setTimeout(() => {
      const langs = getLanguagesFromBrowser();
      setLanguages(langs);
      setLoading(false);
    }, 0);
    return () => clearTimeout(id);
  }, []);
  return { languages, loading };
}

// ====================== STEP 1 ======================
interface Step1Props {
  form: FormState;
  isCouple: "yes" | "no";
  setIsCouple: (v: "yes" | "no") => void;
  assigneeName: string;
  assigneeOptions: AssigneeOption[];
  assigneeLoading: boolean;
  leadGeneratedByInput: string;
  leadGeneratedByOptions: AssigneeOption[];
  leadGeneratedByLoading: boolean;
  selectedLeadGeneratedBy: LeadGeneratedByObject | null;
  campaigns: Campaign[];
  leadStatusOptions?: NextActionStatusOption[];
  nextActionStatusOptions?: NextActionStatusOption[];
  nextActionTypeOptions?: string[];
  handleChange: (
    field: keyof FormState,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectChange: (
    field: keyof FormState,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAssigneeInputChange: (value: string) => void;
  handleAssigneeChange: (value: AssigneeOption | null) => void;
  handleLeadGeneratedByInputChange: (value: string) => void;
  handleLeadGeneratedByChange: (value: AssigneeOption | null) => void;
  handleCampaignChange: (value: string) => void;
  handleSourceChange: (value: string) => void;
  handleSubSourceChange: (value: string) => void;
  handleLeadStatusChange: (value: string) => void;
  handleNextStatusChange: (value: string) => void;
  handleNextTypeChange: (value: string) => void;
  handleReferralDepartmentChange: (value: string) => void;
  referralDepartments: ReferralDepartment[];
  loadingReferralDepts: boolean;
  dataCaptureFields?: DataCaptureFormField[];
  dataCaptureValues?: Record<string, string>;
  onDataCaptureChange?: (fieldKey: string, value: string) => void;
}

export function Step1({
  form,
  isCouple,
  setIsCouple,
  assigneeName,
  assigneeOptions,
  assigneeLoading,
  leadGeneratedByInput,
  leadGeneratedByOptions,
  leadGeneratedByLoading,
  selectedLeadGeneratedBy,
  campaigns,
  leadStatusOptions,
  nextActionStatusOptions,
  nextActionTypeOptions,
  handleChange,
  handleSelectChange,
  handleAssigneeInputChange,
  handleAssigneeChange,
  handleLeadGeneratedByInputChange,
  handleLeadGeneratedByChange,
  handleCampaignChange,
  handleSourceChange,
  handleSubSourceChange,
  handleLeadStatusChange,
  handleNextStatusChange,
  handleNextTypeChange,
  handleReferralDepartmentChange,
  referralDepartments,
  loadingReferralDepts,
  dataCaptureFields,
  dataCaptureValues,
  onDataCaptureChange,
}: Step1Props) {
  const campaignSelected = Boolean(form.campaign);
  const [leadGeneratedByOpen, setLeadGeneratedByOpen] = React.useState(false);
  const { languages: usLanguages, loading: languagesLoading } = useUSLanguages();

  const selectedLeadGeneratedByOption = React.useMemo<AssigneeOption | null>(() => {
    if (!selectedLeadGeneratedBy) return null;

    const selectedId = Number(selectedLeadGeneratedBy.id);
    if (Number.isFinite(selectedId) && selectedId > 0) {
      const matched = leadGeneratedByOptions.find((o) => o.id === selectedId);
      if (matched) return matched;
      return {
        id: selectedId,
        first_name: selectedLeadGeneratedBy.first_name,
        last_name: selectedLeadGeneratedBy.last_name,
        username: undefined,
        role: selectedLeadGeneratedBy.role,
        designation: selectedLeadGeneratedBy.role,
        email: selectedLeadGeneratedBy.email,
      };
    }

    return {
      id: -1,
      first_name: selectedLeadGeneratedBy.first_name,
      last_name: selectedLeadGeneratedBy.last_name,
      username: undefined,
      role: selectedLeadGeneratedBy.role,
      designation: selectedLeadGeneratedBy.role,
      email: selectedLeadGeneratedBy.email,
    };
  }, [leadGeneratedByOptions, selectedLeadGeneratedBy]);

  const availableSubSources: string[] =
    form.source === "Referral"
      ? referralDepartments.map((d) => d.name)
      : form.source && SUB_SOURCE_OPTIONS[form.source]
        ? SUB_SOURCE_OPTIONS[form.source]
        : [];

  const filteredCampaigns = React.useMemo(() => {
    if (!form.source && !form.subSource) return campaigns;
    return campaigns.filter((c) => {
      const sourceMatch = form.source
        ? normalizeForCompare(c.source) === normalizeForCompare(form.source)
        : true;

      const subSourceMatch = form.subSource
        ? normalizeForCompare(c.subSource) === normalizeForCompare(form.subSource)
        : true;

      return sourceMatch && subSourceMatch;
    });
  }, [campaigns, form.source, form.subSource]);

  const resolvedLeadStatusOptions: NextActionStatusOption[] = leadStatusOptions ?? [];
  const resolvedNextActionStatusOptions: NextActionStatusOption[] = nextActionStatusOptions ?? [];
  const resolvedNextActionTypeOptions: string[] = nextActionTypeOptions ?? [];
  const resolvedDataCaptureFields = dataCaptureFields ?? [];
  const resolvedDataCaptureValues = dataCaptureValues ?? {};

  const isCampaignDisabled =
    form.source === "Referral" ||
    (form.source === "Direct" && form.subSource !== "Gmail");

  return (
    <Box>
      {/* ── LEAD INFORMATION ─────────────────────────────────────────────── */}
      <Typography variant="subtitle2" fontWeight={700} color="#1E293B" sx={{ mb: 2 }}>
        LEAD INFORMATION
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: IS_CONTRACTS_APP ? "repeat(5, 1fr)" : "repeat(4, 1fr)",
          gap: 2,
          mb: 3,
        }}
      >
        {(
          [
            ["Lab Name", "full_name"],
            ["Contact No.", "contact"],
            ["Email", "email"],
            ["Location", "location"],
            ...(IS_CONTRACTS_APP ? [["Address", "address"]] : []),
          ] as [string, keyof FormState][]
        ).map(([lbl, field]) => (
          <Box key={field}>
            <Typography sx={labelStyle}>
              {lbl}
              {field === "full_name" && (
                <Typography component="span" sx={{ color: "#EF4444", fontSize: "0.75rem" }}>
                  {" "}*
                </Typography>
              )}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={form[field] as string}
              onChange={handleChange(field)}
              inputProps={field === "contact" ? { maxLength: 15, inputMode: "numeric" } : undefined}
              sx={inputStyle}
            />
          </Box>
        ))}
      </Box>

      {/* Medical — Gender, Age, Marital, Address */}
      {IS_MEDICAL_APP && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 4 }}>
          <Box>
            <Typography sx={labelStyle}>Gender</Typography>
            <TextField select fullWidth size="small" value={form.gender} onChange={handleSelectChange("gender")} sx={inputStyle}>
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
            </TextField>
          </Box>
          <Box>
            <Typography sx={labelStyle}>Age</Typography>
            <TextField fullWidth size="small" type="number" value={form.age} onChange={handleChange("age")} sx={inputStyle} />
          </Box>
          <Box>
            <Typography sx={labelStyle}>Marital Status</Typography>
            <TextField select fullWidth size="small" value={form.marital} onChange={handleSelectChange("marital")} sx={inputStyle}>
              <MenuItem value="">-- Select --</MenuItem>
              <MenuItem value="married">Married</MenuItem>
              <MenuItem value="single">Single</MenuItem>
            </TextField>
          </Box>
          <Box>
            <Typography sx={labelStyle}>Address</Typography>
            <TextField fullWidth size="small" value={form.address} onChange={handleChange("address")} sx={inputStyle} />
          </Box>
        </Box>
      )}

      {/* Language */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={labelStyle}>Language Preference</Typography>
        <TextField
          select
          fullWidth
          size="small"
          value={form.language}
          onChange={handleSelectChange("language")}
          disabled={languagesLoading}
          sx={{ ...inputStyle, maxWidth: "25%" }}
          InputProps={{
            endAdornment: languagesLoading ? <CircularProgress size={16} sx={{ mr: 3 }} /> : null,
          }}
        >
          <MenuItem value="">{languagesLoading ? "Loading languages…" : "-- Select --"}</MenuItem>
          {usLanguages.map((lang) => (
            <MenuItem key={lang} value={lang}>{lang}</MenuItem>
          ))}
        </TextField>
      </Box>

      {/* ── PARTNER INFORMATION — medical only ───────────────────────────── */}
      {IS_MEDICAL_APP && (
        <>
          <Typography variant="subtitle2" fontWeight={700} color="#1E293B" sx={{ mb: 2 }}>
            PARTNER INFORMATION
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ ...labelStyle, mb: 1 }}>Is This Inquiry For A Couple?</Typography>
            <RadioGroup row value={isCouple} onChange={(e) => setIsCouple(e.target.value as "yes" | "no")}>
              <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
              <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
            </RadioGroup>
          </Box>
          {isCouple === "yes" && (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, mb: 4 }}>
              <Box>
                <Typography sx={labelStyle}>Full Name</Typography>
                <TextField fullWidth size="small" value={form.partnerName} onChange={handleChange("partnerName")} sx={inputStyle} />
              </Box>
              <Box>
                <Typography sx={labelStyle}>Age</Typography>
                <TextField fullWidth size="small" type="number" value={form.partnerAge} onChange={handleChange("partnerAge")} sx={inputStyle} />
              </Box>
              <Box>
                <Typography sx={labelStyle}>Gender</Typography>
                <TextField select fullWidth size="small" value={form.partnerGender} onChange={handleSelectChange("partnerGender")} sx={inputStyle}>
                  <MenuItem value="">-- Select --</MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                </TextField>
              </Box>
            </Box>
          )}
        </>
      )}

      {/* ── CONTACT INFORMATION — contracts only ─────────────────────────── */}
      {IS_CONTRACTS_APP && (
        <>
          <Typography variant="subtitle2" fontWeight={700} color="#1E293B" sx={{ mb: 2 }}>
            {ACTIVE_FLOW_COPY.contactSectionLabel}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 4 }}>
            {(
              [
                ["Full Name", "contactFullName"],
                ["Designation", "designation"],
                ["Contact No.", "contactPhone"],
                ["Email", "contactEmail"],
              ] as [string, keyof FormState][]
            ).map(([lbl, field]) => (
              <Box key={field}>
                <Typography sx={labelStyle}>{lbl}</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={(form[field] as string) ?? ""}
                  onChange={handleChange(field)}
                  inputProps={field === "contactPhone" ? { maxLength: 15, inputMode: "numeric" } : undefined}
                  sx={inputStyle}
                />
              </Box>
            ))}
          </Box>
        </>
      )}

      {/* ── SOURCE & CAMPAIGN DETAILS ────────────────────────────────────── */}
      <Typography variant="subtitle2" fontWeight={700} color="#1E293B" sx={{ mb: 2 }}>
        SOURCE & CAMPAIGN DETAILS
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isCampaignDisabled ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
          gap: 2,
          mb: 4,
        }}
      >
        {/* Source */}
        <Box>
          <Typography sx={labelStyle}>
            Source
            {campaignSelected && (
              <Typography component="span" sx={{ fontSize: "0.65rem", color: "#6366F1", ml: 1, fontWeight: 500 }}>
                auto-filled from campaign
              </Typography>
            )}
          </Typography>
          <TextField select fullWidth size="small" value={form.source} onChange={(e) => handleSourceChange(e.target.value)} sx={inputStyle}>
            <MenuItem value="">-- Select --</MenuItem>
            {SOURCE_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Box>

        {/* Sub-Source */}
        {form.source !== "Other" && (
          <Box>
            <Typography sx={labelStyle}>
              Sub-Source
              {campaignSelected && (
                <Typography component="span" sx={{ fontSize: "0.65rem", color: "#6366F1", ml: 1, fontWeight: 500 }}>
                  auto-filled from campaign
                </Typography>
              )}
            </Typography>
            <TextField
              select fullWidth size="small"
              value={form.subSource}
              onChange={(e) => handleSubSourceChange(e.target.value)}
              disabled={!form.source || (form.source === "Referral" && loadingReferralDepts)}
              sx={inputStyle}
              InputProps={{
                endAdornment: form.source === "Referral" && loadingReferralDepts
                  ? <CircularProgress size={16} sx={{ mr: 3 }} /> : null,
              }}
            >
              <MenuItem value="">-- Select --</MenuItem>
              {form.source === "Referral" && loadingReferralDepts ? (
                <MenuItem value="" disabled>Loading departments...</MenuItem>
              ) : form.source === "Referral" && availableSubSources.length === 0 ? (
                <MenuItem value="" disabled>No departments available</MenuItem>
              ) : (
                availableSubSources.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)
              )}
              {!form.source && <MenuItem value="" disabled>Select source first</MenuItem>}
            </TextField>
          </Box>
        )}

        {/* Campaign Name */}
        {form.source !== "Other" && !isCampaignDisabled && (
          <Box>
            <Typography sx={labelStyle}>
              Campaign Name
              {form.subSource && !campaignSelected && (
                <Typography component="span" sx={{ fontSize: "0.65rem", color: "#94A3B8", ml: 1, fontWeight: 500 }}>
                  linked with {form.subSource}
                </Typography>
              )}
            </Typography>
            <TextField
              select fullWidth size="small"
              value={form.campaign}
              onChange={(e) => handleCampaignChange(e.target.value)}
              disabled={!form.source && !form.subSource}
              sx={inputStyle}
            >
              <MenuItem value="">-- None --</MenuItem>
              {filteredCampaigns.length === 0 ? (
                <MenuItem value="" disabled>
                  {form.source || form.subSource ? "No campaigns match the selected source / sub-source" : "No campaigns available"}
                </MenuItem>
              ) : (
                filteredCampaigns.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)
              )}
            </TextField>
          </Box>
        )}
      </Box>

      {/* ── ASSIGNEE & NEXT ACTION DETAILS ───────────────────────────────── */}
      <Typography variant="subtitle2" fontWeight={700} color="#1E293B" sx={{ mb: 2 }}>
        ASSIGNEE & NEXT ACTION DETAILS
      </Typography>

      {/* Row 1 */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: IS_CONTRACTS_APP ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
          gap: 2,
          mb: 2,
        }}
      >
        {/* Assigned To */}
        <Box>
          <Typography sx={labelStyle}>
            Assigned To{" "}
            <Typography component="span" sx={{ color: "#EF4444", fontSize: "0.75rem" }}>*</Typography>
          </Typography>
          <Autocomplete
            options={assigneeOptions}
            loading={assigneeLoading}
            clearOnBlur={false}
            filterOptions={(options) => options}
            value={assigneeOptions.find((o) => String(o.id) === form.assignee) || null}
            inputValue={assigneeName}
            onInputChange={(_, value: string, reason) => {
              if (reason === "reset") return;
              handleAssigneeInputChange(value);
            }}
            onChange={(_, value: AssigneeOption | null) => handleAssigneeChange(value)}
            getOptionLabel={assigneeLabel}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="Type to search assignee"
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {`${option.first_name ?? ""} ${option.last_name ?? ""}`.trim() || option.username}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params} fullWidth size="small" placeholder="Search assignee" sx={inputStyle}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {assigneeLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Box>

        {/* Lead Generated By — contracts only */}
        {IS_CONTRACTS_APP && (
          <Box>
            <Typography sx={labelStyle}>Lead Generated By (Referral)</Typography>
            <Autocomplete
              options={leadGeneratedByOptions}
              loading={leadGeneratedByLoading}
              clearOnBlur={false}
              filterOptions={(options) => options}
              open={leadGeneratedByOpen}
              onOpen={() => setLeadGeneratedByOpen(true)}
              onClose={() => setLeadGeneratedByOpen(false)}
              value={selectedLeadGeneratedByOption}
              inputValue={leadGeneratedByInput}
              onInputChange={(_, value: string, reason) => {
                if (reason === "reset") return;
                handleLeadGeneratedByInputChange(value);
              }}
              onChange={(_, value: AssigneeOption | null) => {
                handleLeadGeneratedByChange(value);
                setLeadGeneratedByOpen(false);
              }}
              getOptionLabel={assigneeLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText="Type to search user"
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {`${option.first_name ?? ""} ${option.last_name ?? ""}`.trim() || option.username || `User ${option.id}`}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params} fullWidth size="small" placeholder="Search user" sx={inputStyle}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {leadGeneratedByLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            {leadGeneratedByOpen && selectedLeadGeneratedBy && (
              <Box
                sx={{
                  mt: 1, p: 1.5, borderRadius: "8px", border: "1px solid #E2E8F0",
                  bgcolor: "#F8FAFC", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
                }}
              >
                {(
                  [
                    ["FIRST NAME", selectedLeadGeneratedBy.first_name],
                    ["LAST NAME", selectedLeadGeneratedBy.last_name],
                    ["ROLE", selectedLeadGeneratedBy.role],
                    ["EMAIL", selectedLeadGeneratedBy.email],
                  ] as [string, string | undefined][]
                ).map(([fieldLabel, fieldValue]) => (
                  <Box key={fieldLabel}>
                    <Typography sx={{ fontSize: "0.65rem", color: "#94A3B8", fontWeight: 600 }}>
                      {fieldLabel}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.8rem", fontWeight: 500,
                        color: fieldLabel === "EMAIL" ? "#6366F1" : "#1E293B",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {fieldValue || "—"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Referral Department — contracts only */}
        {IS_CONTRACTS_APP && (
          <Box>
            <Typography sx={labelStyle}>Referral Department</Typography>
            <TextField
              select fullWidth size="small"
              value={form.referralDepartment}
              onChange={(e) => handleReferralDepartmentChange(e.target.value)}
              sx={inputStyle}
              disabled={loadingReferralDepts}
              InputProps={{
                endAdornment: loadingReferralDepts ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null,
              }}
            >
              <MenuItem value="">-- None --</MenuItem>
              {loadingReferralDepts ? (
                <MenuItem value="" disabled>Loading...</MenuItem>
              ) : referralDepartments.length === 0 ? (
                <MenuItem value="" disabled>No departments available</MenuItem>
              ) : (
                referralDepartments.map((dept) => (
                  <MenuItem key={dept.id} value={String(dept.id)}>{dept.name}</MenuItem>
                ))
              )}
            </TextField>
          </Box>
        )}
      </Box>

      {/* Row 2: Lead Status | Next Action Status | Next Action Type | Task Status | Next Action Description */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: IS_CONTRACTS_APP
            ? "repeat(5, 1fr)"
            : "repeat(4, 1fr)",
          gap: 2,
          mb: 2,
        }}
      >
        {/* Lead Status */}
        <Box>
          <Typography sx={labelStyle}>
            Lead Status{" "}
            <Typography component="span" sx={{ color: "#EF4444", fontSize: "0.75rem" }}>*</Typography>
          </Typography>
          <TextField
            select fullWidth size="small"
            value={form.leadStatus}
            onChange={(e) => handleLeadStatusChange(e.target.value)}
            sx={inputStyle}
          >
            <MenuItem value="">-- Select --</MenuItem>
            {resolvedLeadStatusOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
        </Box>

        {/* Next Action Status */}
        <Box>
          <Typography sx={labelStyle}>
            Next Action Status{" "}
            <Typography component="span" sx={{ color: "#EF4444", fontSize: "0.75rem" }}>*</Typography>
          </Typography>
          <TextField
            select fullWidth size="small"
            value={form.nextStatus}
            onChange={(e) => handleNextStatusChange(e.target.value)}
            sx={inputStyle}
          >
            <MenuItem value="">-- Select --</MenuItem>
            {resolvedNextActionStatusOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
        </Box>

        {/* Next Action Type */}
        <Box>
          <Typography sx={labelStyle}>Next Action Type</Typography>
          <TextField
            select fullWidth size="small"
            value={form.nextType}
            onChange={(e) => handleNextTypeChange(e.target.value)}
            sx={inputStyle}
            disabled={resolvedNextActionTypeOptions.length === 0}
          >
            <MenuItem value="">-- Select --</MenuItem>
            {resolvedNextActionTypeOptions.length === 0 ? (
              <MenuItem value="" disabled>
                {form.leadStatus ? "No actions configured for this stage" : "Select a lead status first"}
              </MenuItem>
            ) : (
              resolvedNextActionTypeOptions.map((label) => (
                <MenuItem key={label} value={label}>{capitalizeWords(label)}</MenuItem>
              ))
            )}
          </TextField>
        </Box>

        {/* ── Task Status ───────────────────────────────────────────────── */}
        <Box>
          <Typography sx={labelStyle}>Task Status</Typography>
          <TextField
            select fullWidth size="small"
            value={form.taskStatus}
            onChange={handleSelectChange("taskStatus")}
            sx={inputStyle}
          >
            <MenuItem value="">-- Select --</MenuItem>
            {TASK_STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
        </Box>

        {/* Next Action Description — contracts inline */}
        {IS_CONTRACTS_APP && (
          <Box>
            <Typography sx={labelStyle}>Next Action Description</Typography>
            <TextField
              fullWidth size="small"
              value={form.nextDesc}
              onChange={handleChange("nextDesc")}
              sx={inputStyle}
            />
          </Box>
        )}
      </Box>

      {/* Next Action Description — full width for non-contracts */}
      {!IS_CONTRACTS_APP && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={labelStyle}>Next Action Description</Typography>
          <TextField
            fullWidth size="small"
            value={form.nextDesc}
            onChange={handleChange("nextDesc")}
            sx={inputStyle}
          />
        </Box>
      )}

      {/* ── DATA CAPTURE FIELDS (from selected pipeline stage) ───────────── */}
      {resolvedDataCaptureFields.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={700} color="#1E293B" sx={{ mb: 2 }}>
            DATA CAPTURE FIELDS
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 2,
              mb: 2,
            }}
          >
            {resolvedDataCaptureFields.map((field) => {
              const value = resolvedDataCaptureValues[field.key] ?? "";
              const commonProps = {
                fullWidth: true,
                size: "small" as const,
                value,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  onDataCaptureChange?.(field.key, e.target.value),
                sx: inputStyle,
              };

              return (
                <Box key={field.key}>
                  <Typography sx={labelStyle}>
                    {field.label}
                    {field.required && (
                      <Typography component="span" sx={{ color: "#EF4444", fontSize: "0.75rem" }}>
                        {" "}*
                      </Typography>
                    )}
                  </Typography>

                  {field.type === "date" ? (
                    <TextField
                      {...commonProps}
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                  ) : field.type === "number" ? (
                    <TextField
                      {...commonProps}
                      type="number"
                    />
                  ) : (
                    <TextField
                      {...commonProps}
                      placeholder={field.type === "dropdown" ? "Enter value" : ""}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
}

// ====================== STEP 2 ======================
interface Step2Props {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  pendingFiles: File[];
  docDragOver: boolean;
  setDocDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // ── dynamic interest objects fetched from backend ─────────────────────────
  interests?: Interest[];
  loadingInterests?: boolean;
  // ── legacy flat-string options (kept for backward compat) ─────────────────
  interestOptions?: string[];
  interestOptionsLoading?: boolean;
}

export function Step2({
  form,
  setForm,
  pendingFiles,
  docDragOver,
  setDocDragOver,
  fileInputRef,
  addFiles,
  removeFile,
  handleFileInputChange,
  interests,
  loadingInterests = false,
  interestOptions,
  interestOptionsLoading = false,
}: Step2Props) {
  const [previewFile, setPreviewFile] = React.useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);

  const openPendingFile = (file: File) => {
    const fileUrl = URL.createObjectURL(file);
    setPreviewFile((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return {
        url: fileUrl,
        name: file.name,
        type: file.type || "",
      };
    });
  };

  const closePreview = () => {
    setPreviewFile((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const sectionHeading = IS_MEDICAL_APP ? "TREATMENT INFORMATION" : "PRODUCT INFORMATION";
  const interestLabel = ACTIVE_FLOW_COPY.treatmentLabel;

  const isLoading = loadingInterests || interestOptionsLoading;

  // Build the flat string list to display in the dropdown.
  // Priority: Interest[] objects from backend → flat string interestOptions → static fallback
  const resolvedInterestOptions: string[] = React.useMemo(() => {
    if (interests && interests.length > 0) {
      return interests.map((i) => i.name);
    }
    if (interestOptions && interestOptions.length > 0) {
      return [...interestOptions];
    }
    // Spread into a new mutable array so readonly tuples are accepted
    return [...ACTIVE_FLOW_COPY.treatmentOptions];
  }, [interests, interestOptions]);

  return (
    <Box>
      <Typography
        variant="subtitle2"
        fontWeight={700}
        color="#1E293B"
        sx={{ mb: 2 }}
      >
        {sectionHeading}
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography sx={labelStyle}>
          {interestLabel}
          <span style={{ color: "red", marginLeft: "4px" }}>*</span>
        </Typography>
        <TextField
          select
          fullWidth
          size="small"
          value={form.treatmentInterest}
          onChange={(e) => {
            const selectedName = e.target.value;
            // Find the matching interest object to get its ID
            const matched = interests?.find((i) => i.name === selectedName);
            const selectedId = matched ? String(matched.id) : selectedName;

            setForm((prev) => ({
              ...prev,
              treatmentInterest: selectedName, // display value only
              treatments: prev.treatments.includes(selectedId)
                ? prev.treatments
                : [...prev.treatments, selectedId],
            }));
          }}
          sx={{ ...inputStyle, maxWidth: "50%" }}
          SelectProps={{ displayEmpty: true }}
          disabled={isLoading}
          InputProps={{
            endAdornment: isLoading ? (
              <CircularProgress size={16} sx={{ mr: 3 }} />
            ) : null,
          }}
        >
          <MenuItem value="" disabled>
            {isLoading ? "Loading…" : "Select"}
          </MenuItem>
          {resolvedInterestOptions.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {form.treatments.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
          {form.treatments.map((id) => {
            const matched = interests?.find((i) => String(i.id) === id);
            const label = matched?.name ?? id;
            return (
              <Chip
                key={id}
                label={label}
                onDelete={() =>
                  setForm((prev) => ({
                    ...prev,
                    treatments: prev.treatments.filter((x) => x !== id),
                  }))
                }
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
            );
          })}
        </Stack>
      )}

      <Typography
        variant="subtitle2"
        fontWeight={700}
        color="#1E293B"
        sx={{ mb: 2 }}
      >
        DOCUMENTS & REPORTS (Optional)
      </Typography>

      <Box
        onDrop={(e) => {
          e.preventDefault();
          setDocDragOver(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDocDragOver(true);
        }}
        onDragLeave={() => setDocDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          border: docDragOver ? "2px dashed #6366F1" : "2px dashed #E2E8F0",
          borderRadius: "12px",
          p: 3,
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          bgcolor: docDragOver ? "rgba(99,102,241,0.04)" : "#F8FAFC",
          minWidth: "400px",
          transition: "all 0.2s",
          cursor: "pointer",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          onChange={handleFileInputChange}
        />
        <UploadFileIcon sx={{ fontSize: 28, color: "#94A3B8", mb: 1 }} />
        <Button
          variant="contained"
          component="span"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          sx={{
            bgcolor: "#64748B",
            textTransform: "none",
            borderRadius: "8px",
            fontWeight: 600,
            px: 3,
            py: 1,
            "&:hover": { bgcolor: "#475569" },
          }}
        >
          Choose File
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          {pendingFiles.length > 0
            ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} selected`
            : "No File Chosen · PDF, Word, JPG, PNG up to 10MB"}
        </Typography>
      </Box>

      {pendingFiles.length > 0 && (
        <Stack spacing={1} sx={{ mt: 2, maxWidth: "500px" }}>
          {pendingFiles.map((file, index) => {
            const color = getDocColor(file.name);
            const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
            return (
              <Stack
                key={`${file.name}-${index}`}
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  bgcolor: "#F8FAFC",
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "6px",
                    bgcolor: `${color}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 16, color }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color="#1E293B"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ext} · {(file.size / 1024).toFixed(0)} KB
                  </Typography>
                </Box>
                <Tooltip title="View">
                  <IconButton
                    size="medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPendingFile(file);
                    }}
                    sx={{
                      width: 32,
                      height: 32,
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      bgcolor: "#FFFFFF",
                      color: "#0F172A",
                      "&:hover": {
                        bgcolor: "#F8FAFC",
                        borderColor: "#94A3B8",
                        color: "#020617",
                      },
                    }}
                  >
                    <VisibilityOutlinedIcon fontSize="medium" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    sx={{ color: "#94A3B8", "&:hover": { color: "#EF4444" } }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Dialog
        open={Boolean(previewFile)}
        onClose={closePreview}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle
          sx={{
            pr: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {previewFile?.name ?? "File preview"}
          </Typography>
          <IconButton
            onClick={closePreview}
            sx={{ color: "#64748B", "&:hover": { color: "#334155" } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, minHeight: "70vh" }}>
          {previewFile &&
          (previewFile.type.startsWith("image/") ||
            /\.(png|jpe?g|webp|gif)$/i.test(previewFile.name)) ? (
            <Box
              component="img"
              src={previewFile.url}
              alt={previewFile.name}
              sx={{
                width: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                bgcolor: "#F8FAFC",
              }}
            />
          ) : previewFile &&
            (previewFile.type === "application/pdf" ||
              /\.pdf$/i.test(previewFile.name)) ? (
            <Box
              component="iframe"
              src={previewFile.url}
              title={previewFile.name}
              sx={{ width: "100%", height: "70vh", border: 0 }}
            />
          ) : (
            <Box
              sx={{
                height: "70vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 1,
                p: 3,
              }}
            >
              <Typography color="text.secondary">
                Preview is not supported for this file type.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// ====================== STEP 3 ======================
interface Step3Props {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  selectedDate: Dayjs | null;
  setSelectedDate: React.Dispatch<React.SetStateAction<Dayjs | null>>;
  departments: Department[];
  loadingDepartments: boolean;
  loadingEmployees: boolean;
  personnelInput: string;
  personnelOptions: AssigneeOption[];
  personnelLoading: boolean;
  selectedPersonnel: AssigneeOption | null;
  handlePersonnelInputChange: (value: string) => void;
  handlePersonnelChange: (value: AssigneeOption | null) => void;
  handleChange: (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDepartmentChange: (value: string) => void;
}

export function Step3({
  form,
  setForm,
  selectedDate,
  setSelectedDate,
  departments,
  loadingDepartments,
  loadingEmployees,
  personnelInput,
  personnelOptions,
  personnelLoading,
  selectedPersonnel,
  handlePersonnelInputChange,
  handlePersonnelChange,
  handleChange,
  handleDepartmentChange,
}: Step3Props) {
  const noAppointment = form.wantAppointment === "no";

  const availableSlots = React.useMemo<string[]>(() => {
    if (!selectedDate) return TIME_SLOTS;

    const selectedDateStartOfDay = selectedDate.startOf("day");
    const today = dayjs().startOf("day");
    const isToday = selectedDateStartOfDay.isSame(today, "day");
    if (!isToday) return TIME_SLOTS;

    const now = dayjs();
    return TIME_SLOTS.filter((slotStr) => {
      const slotTime = parseSlotStartTime(slotStr);
      if (!slotTime) return true;
      const slotTimeToday = dayjs()
        .set("hour", slotTime.hour())
        .set("minute", slotTime.minute())
        .set("second", 0);
      return slotTimeToday.isAfter(now);
    });
  }, [selectedDate]);

  React.useEffect(() => {
    if (!form.slot) return;
    if (availableSlots.includes(form.slot)) return;

    setForm((prev) => ({
      ...prev,
      slot: "",
    }));
  }, [availableSlots, form.slot, setForm]);

  const handleWantAppointmentChange = (value: "yes" | "no") => {
    setForm((prev) => ({
      ...prev,
      wantAppointment: value,
      ...(value === "no" && {
        department: "",
        personnel: "",
        appointmentDate: "",
        slot: "",
        remark: "",
      }),
    }));
    if (value === "no") setSelectedDate(null);
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} color="#1E293B" sx={{ mb: 2 }}>
        APPOINTMENT DETAILS
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ ...labelStyle, mb: 1 }}>Want to Book an Appointment?</Typography>
        <RadioGroup
          row
          value={form.wantAppointment}
          onChange={(e) => handleWantAppointmentChange(e.target.value as "yes" | "no")}
        >
          <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
          <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
        </RadioGroup>
      </Box>

      {!noAppointment && (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: IS_MEDICAL_APP ? "repeat(2, 1fr)" : "1fr",
              gap: 2,
              mb: 2,
            }}
          >
            {IS_MEDICAL_APP && (
              <Box>
                <Typography sx={labelStyle}>Department</Typography>
                <Autocomplete
                  options={departments}
                  loading={loadingDepartments}
                  disabled={loadingDepartments}
                  value={departments.find((d) => d.id.toString() === form.department) ?? null}
                  getOptionLabel={(d) => d.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  onChange={(_, dept) =>
                    handleDepartmentChange(dept ? dept.id.toString() : "")
                  }
                  renderOption={(props, dept) => (
                    <li {...props} key={dept.id}>{dept.name}</li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      fullWidth
                      placeholder="Search department"
                      sx={inputStyle}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingDepartments ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  noOptionsText={loadingDepartments ? "Loading..." : "No departments"}
                />
              </Box>
            )}

            <Box>
              <Typography sx={labelStyle}>Appointment Personnel</Typography>
              <Autocomplete
                options={personnelOptions}
                loading={personnelLoading || loadingEmployees}
                clearOnBlur={false}
                filterOptions={(options) => options}
                value={selectedPersonnel}
                inputValue={personnelInput}
                onInputChange={(_, value: string, reason) => {
                  if (reason === "reset") return;
                  handlePersonnelInputChange(value);
                }}
                onChange={(_, value: AssigneeOption | null) => handlePersonnelChange(value)}
                getOptionLabel={assigneeLabel}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                disabled={loadingEmployees || (IS_MEDICAL_APP ? !form.department : false)}
                noOptionsText={
                  IS_MEDICAL_APP && !form.department
                    ? "Select department first"
                    : "Type to search personnel"
                }
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {`${option.first_name ?? ""} ${option.last_name ?? ""}`.trim() ||
                          option.username}
                      </Typography>
                    </Box>
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
                          {personnelLoading || loadingEmployees ? (
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2, mb: 3 }}>
            <Box>
              <Typography sx={labelStyle}>Date</Typography>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={selectedDate}
                  format="DD/MM/YYYY"
                  disablePast
                  onChange={(newDate) => {
                    const asDayjs = newDate ? dayjs(newDate as Dayjs | Date) : null;
                    const validDate = asDayjs && asDayjs.isValid() ? asDayjs : null;
                    setSelectedDate(validDate);
                    setForm((prev) => ({
                      ...prev,
                      appointmentDate: validDate ? validDate.format("YYYY-MM-DD") : "",
                    }));
                  }}
                  slotProps={{
                    textField: { size: "small", fullWidth: true, sx: inputStyle },
                  }}
                />
              </LocalizationProvider>
            </Box>
            <Box>
              <Typography sx={labelStyle}>Select Slot</Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={form.slot}
                onChange={handleChange("slot")}
                sx={inputStyle}
                SelectProps={{ native: false, MenuProps: SLOT_MENU_PROPS }}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {availableSlots.map((slot, i) => (
                  <MenuItem key={i} value={slot}>{slot}</MenuItem>
                ))}
                {selectedDate && availableSlots.length === 0 && (
                  <MenuItem disabled>No slots available for selected time</MenuItem>
                )}
              </TextField>
            </Box>
          </Box>

          <Box>
            <Typography sx={labelStyle}>Remark</Typography>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="Type Here..."
              value={form.remark}
              onChange={handleChange("remark")}
              sx={inputStyle}
            />
          </Box>
        </>
      )}
    </Box>
  );
}