// Leadsboardcard.tsx
// CardContent, LeadCard, LeadColumn

import * as React from "react";
import {
  Box,
  Stack,
  Typography,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Button,
  Divider,
  Tooltip,
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PhoneIcon from "@mui/icons-material/Phone";
import { useNavigate } from "react-router-dom";

import { MenuButton } from "./LeadsMenuDialogs";
import { hasUsablePhone } from "./LeadsTable.helpers";
import { STATUS_OPTIONS_BY_APP, APP_TYPE } from "../../config/appType";

import type { LeadItem, ColumnConfig } from "./Leadsboardtypes";

// Re-export so any file that was importing LeadItem from here still works
export type { LeadItem, ColumnConfig };

// ====================== Statuses that show Book Appointment button ======================
// Driven from appType config — stays in sync if status names ever change
const BOOK_APPOINTMENT_STATUSES = new Set(
  STATUS_OPTIONS_BY_APP[APP_TYPE].filter(
    (s) => s === "New" || s === "Follow Up",
  ),
);

// ====================== Shared icon button style ======================
const iconBtnSx = {
  border: "1px solid #E2E8F0",
  p: 0.5,
  borderRadius: "8px",
  color: "#64748B",
  "&:hover": { bgcolor: "#F8FAFC", color: "#6366F1" },
};

const hasUsableEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  if (
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "no email" ||
    normalized === "none" ||
    normalized === "-"
  ) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

// ====================== Card Content (collapsed / expanded) ======================
interface CardContentProps {
  lead: LeadItem;
  columnLabel: string;
  stageActions?: ColumnConfig["uiActions"];
  isHovered: boolean;
  onOpenSms: (lead: LeadItem) => void;
  onOpenMail: (lead: LeadItem) => void;
  onOpenBook: (lead: LeadItem) => void;
  onOpenCall: (lead: LeadItem) => void;
}

export const CardContent: React.FC<CardContentProps> = ({
  lead,
  columnLabel,
  stageActions,
  isHovered,
  onOpenSms,
  onOpenMail,
  onOpenBook,
  onOpenCall,
}) => {
  // Collapsed view
  if (!isHovered) {
    return (
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{ color: "#64748B", fontSize: "0.7rem" }}
        >
          Score:{" "}
          <Box component="span" sx={{ color: "#1E293B" }}>
            {lead.score || 0}%
          </Box>
        </Typography>
      </Box>
    );
  }

  const showCall = stageActions ? stageActions.showCall : true;
  const showEmail = stageActions ? stageActions.showEmail : true;
  const showSms = stageActions ? stageActions.showSms : true;
  const customActions = stageActions?.customActions ?? [];
  const hasContactOptions = showCall || showSms || showEmail;
  const phoneCandidate = String(
    lead.contact_no ??
      lead.phone ??
      lead.phone_number ??
      lead.mobile ??
      lead.contact ??
      lead.contact_number ??
      lead.contactNo ??
      "",
  ).trim();
  const canUsePhone = hasUsablePhone(phoneCandidate);
  const emailCandidate = String(lead.email ?? lead.email_address ?? "").trim();
  const canUseEmail = hasUsableEmail(emailCandidate);
  // If no stage-level rule exists yet, keep legacy behavior for New / Follow Up.
  const showBookButton = stageActions
    ? stageActions.showBookAppointment && isHovered
    : BOOK_APPOINTMENT_STATUSES.has(columnLabel as "New" | "Follow Up") &&
      isHovered;

  const formattedDate = lead.created_at
    ? new Date(lead.created_at as string).toLocaleDateString("en-GB")
    : "Not specified";
  const formattedTime = lead.created_at
    ? new Date(lead.created_at as string).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Box sx={{ width: "100%", mt: 1.5 }}>
      {/* Location + Date */}
      <Stack spacing={1} sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LocationOnIcon sx={{ fontSize: 14, color: "#94A3B8" }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.75rem" }}
          >
            {lead.location as string}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarMonthIcon sx={{ fontSize: 14, color: "#94A3B8" }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.75rem" }}
          >
            {formattedDate}
            {formattedTime ? `, ${formattedTime}` : ""}
          </Typography>
        </Stack>
      </Stack>

      <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />

      {/* Assigned + Source */}
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.6rem", display: "block", fontWeight: 700 }}
          >
            ASSIGNED TO
          </Typography>
          <Typography
            variant="caption"
            fontWeight={600}
            color="#1E293B"
            sx={{ fontSize: "0.75rem" }}
          >
            {lead.assigned as string}
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.6rem", display: "block", fontWeight: 700 }}
          >
            LEAD SOURCE
          </Typography>
          <Typography
            variant="caption"
            fontWeight={600}
            color="#1E293B"
            sx={{ fontSize: "0.75rem" }}
          >
            {lead.source as string}
          </Typography>
        </Box>
      </Stack>

      {hasContactOptions && (
        <>
          {/* Contact options */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontSize: "0.6rem",
              display: "block",
              fontWeight: 700,
              mb: 1,
            }}
          >
            CONTACT OPTION
          </Typography>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mb: showBookButton ? 2 : 0 }}
          >
            {showCall && (
              <Tooltip
                title={
                  canUsePhone ? `Call ${phoneCandidate}` : "No phone number"
                }
                arrow
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={!canUsePhone}
                    sx={{
                      ...iconBtnSx,
                      ...(!canUsePhone
                        ? {
                            opacity: 0.45,
                            color: "#94A3B8",
                            "&:hover": {
                              bgcolor: "transparent",
                              color: "#94A3B8",
                            },
                          }
                        : {}),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCall(lead);
                    }}
                  >
                    <PhoneIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {showSms && (
              <Tooltip
                title={canUsePhone ? `SMS ${phoneCandidate}` : "No phone number"}
                arrow
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={!canUsePhone}
                    sx={{
                      ...iconBtnSx,
                      ...(!canUsePhone
                        ? {
                            opacity: 0.45,
                            color: "#94A3B8",
                            "&:hover": {
                              bgcolor: "transparent",
                              color: "#94A3B8",
                            },
                          }
                        : {}),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSms(lead);
                    }}
                  >
                    <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {showEmail && (
              <Tooltip
                title={canUseEmail ? `Email ${emailCandidate}` : "No email address"}
                arrow
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={!canUseEmail}
                    sx={{
                      ...iconBtnSx,
                      ...(!canUseEmail
                        ? {
                            opacity: 0.45,
                            color: "#94A3B8",
                            "&:hover": {
                              bgcolor: "transparent",
                              color: "#94A3B8",
                            },
                          }
                        : {}),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMail(lead);
                    }}
                  >
                    <MailOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        </>
      )}

      {customActions.length > 0 && (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ mb: showBookButton ? 1.5 : 0, flexWrap: "wrap", rowGap: 0.75 }}
        >
          {customActions.map((customActionLabel) => (
            <Chip
              key={customActionLabel}
              label={customActionLabel}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.66rem",
                borderRadius: "999px",
                bgcolor: "#EEF2FF",
                color: "#3730A3",
                fontWeight: 600,
              }}
            />
          ))}
        </Stack>
      )}

      {showBookButton && (
        <Button
          fullWidth
          variant="contained"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onOpenBook(lead);
          }}
          sx={{
            bgcolor: "#334155",
            textTransform: "none",
            borderRadius: "8px",
            fontWeight: 600,
            py: 1.2,
            mt: 1,
            "&:hover": { bgcolor: "#1e293b" },
          }}
        >
          Book an Appointment
        </Button>
      )}
    </Box>
  );
};

// ====================== Lead Card ======================
interface LeadCardProps {
  lead: LeadItem;
  columnLabel: string;
  columnColor: string;
  stageActions?: ColumnConfig["uiActions"];
  isHovered: boolean;
  isDragging?: boolean;
  onHover: (id: string | null) => void;
  onOpenSms: (lead: LeadItem) => void;
  onOpenMail: (lead: LeadItem) => void;
  onOpenBook: (lead: LeadItem) => void;
  onOpenCall: (lead: LeadItem) => void;
  canEditLeads?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setLeads: React.Dispatch<React.SetStateAction<any[]>>;
  onDragStart?: (leadId: string) => void;
  onDragEnd?: () => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  columnLabel,
  columnColor,
  stageActions,
  isHovered,
  onHover,
  onOpenSms,
  onOpenMail,
  onOpenBook,
  onOpenCall,
  canEditLeads = true,
  setLeads,
  isDragging = false,
  onDragStart,
  onDragEnd,
}) => {
  const navigate = useNavigate();

  return (
    <Paper
      elevation={0}
      onMouseEnter={() => onHover(lead.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => navigate(`/leads/${lead.id.replace("#", "")}`)}
      draggable={canEditLeads}
      onDragStart={(event) => {
        if (!canEditLeads) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", lead.id);
        onDragStart?.(lead.id);
      }}
      onDragEnd={() => {
        onDragEnd?.();
      }}
      sx={{
        p: 2.5,
        borderRadius: "16px",
        border: "1px solid #EAECF0",
        transition: "all 0.3s ease",
        width: "100%",
        backgroundColor: "#FFFFFF",
        cursor: "pointer",
        opacity: isDragging ? 0.55 : 1,
        ...(isHovered && {
          boxShadow: "0px 12px 24px -4px rgba(145,158,171,0.16)",
          borderColor: columnColor,
          transform: "translateY(-2px)",
          zIndex: 10,
        }),
      }}
    >
      {/* Header row */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: "0.8rem",
              bgcolor: "#EEF2FF",
              color: "#6366F1",
              fontWeight: 700,
            }}
          >
            {lead.initials as string}
          </Avatar>
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ fontSize: "0.9rem", color: "#1E293B" }}
            >
              {lead.full_name ?? lead.name}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              {lead.id}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            label={lead.quality as string}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.65rem",
              fontWeight: 700,
              bgcolor:
                lead.quality === "Hot"
                  ? "#FEE2E2"
                  : lead.quality === "Warm"
                    ? "#FEF3C7"
                    : "#F1F5F9",
              color:
                lead.quality === "Hot"
                  ? "#B91C1C"
                  : lead.quality === "Warm"
                    ? "#B45309"
                    : "#475569",
            }}
          />
          <Box onClick={(e) => e.stopPropagation()}>
            <MenuButton
              lead={lead}
              setLeads={setLeads}
              tab="active"
              canEditLeads={canEditLeads}
            />
          </Box>
        </Stack>
      </Stack>

      <CardContent
        lead={lead}
        columnLabel={columnLabel}
        stageActions={stageActions}
        isHovered={isHovered}
        onOpenSms={onOpenSms}
        onOpenMail={onOpenMail}
        onOpenBook={onOpenBook}
        onOpenCall={onOpenCall}
      />
    </Paper>
  );
};

// ====================== Lead Column ======================
export interface LeadColumnProps {
  col: ColumnConfig;
  leads: LeadItem[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onOpenSms: (lead: LeadItem) => void;
  onOpenMail: (lead: LeadItem) => void;
  onOpenBook: (lead: LeadItem) => void;
  onOpenCall: (lead: LeadItem) => void;
  canEditLeads?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setLeads: React.Dispatch<React.SetStateAction<any[]>>;
  draggedLeadId?: string | null;
  dropColumnKey?: string | null;
  onDragStart?: (leadId: string) => void;
  onDragEnd?: () => void;
  onDragOverColumn?: (columnKey: string) => void;
  onDropLead?: (leadId: string) => void;
}

export const LeadColumn: React.FC<LeadColumnProps> = ({
  col,
  leads,
  hoveredId,
  onHover,
  onOpenSms,
  onOpenMail,
  onOpenBook,
  onOpenCall,
  canEditLeads = true,
  setLeads,
  draggedLeadId,
  dropColumnKey,
  onDragStart,
  onDragEnd,
  onDragOverColumn,
  onDropLead,
}) => (
  <Box
    onDragOver={(event) => {
      if (!canEditLeads) return;
      event.preventDefault();
      onDragOverColumn?.(col.stageId ?? col.label);
    }}
    onDragLeave={() => {
      onDragOverColumn?.("");
    }}
    onDrop={(event) => {
      if (!canEditLeads) return;
      event.preventDefault();
      const leadId = event.dataTransfer.getData("text/plain");
      if (leadId) {
        onDropLead?.(leadId);
      }
    }}
    sx={{
      minWidth: 350,
      maxWidth: 350,
      bgcolor: "#F1F5F9",
      borderRadius: "20px",
      display: "flex",
      flexDirection: "column",
      maxHeight: "100%",
      p: 2,
      border:
        dropColumnKey === (col.stageId ?? col.label)
          ? "1px dashed #6366F1"
          : "1px solid #E2E8F0",
      backgroundColor:
        dropColumnKey === (col.stageId ?? col.label) ? "#EEF2FF" : "#F1F5F9",
      flexShrink: 0,
    }}
  >
    <Typography
      variant="subtitle2"
      fontWeight={800}
      sx={{
        color: "#64748B",
        mb: 2.5,
        px: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
        letterSpacing: 0.5,
      }}
    >
      {col.label}{" "}
      <Box component="span" sx={{ color: "#94A3B8", fontWeight: 500 }}>
        ({leads.length.toString().padStart(2, "0")})
      </Box>
    </Typography>

    <Stack
      spacing={2}
      sx={{
        overflowY: "auto",
        px: 0.5,
        pb: 1,
        "&::-webkit-scrollbar": { display: "none" },
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          columnLabel={col.label}
          columnColor={col.color}
          stageActions={col.uiActions}
          isHovered={hoveredId === lead.id}
          isDragging={draggedLeadId === lead.id}
          onHover={onHover}
          onOpenSms={onOpenSms}
          onOpenMail={onOpenMail}
          onOpenBook={onOpenBook}
          onOpenCall={onOpenCall}
          canEditLeads={canEditLeads}
          setLeads={setLeads}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </Stack>
  </Box>
);
