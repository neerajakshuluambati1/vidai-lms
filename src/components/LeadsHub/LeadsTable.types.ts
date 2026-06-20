// ====================== Types ======================
export interface RawLead {
  id: string;
  stage_id?: string | number | null;
  stage_name?: string;
  full_name?: string;
  name?: string;
  contact_no?: string;
  email?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  next_action_description?: string;
  next_action_status?: string;
  next_action_type?: string;
  action_status?: string | null;
  task_type?: string;
  nextActionType?: string;
  taskType?: string;
  action_type?: string;
  status?: string;
  lead_status?: string;
  is_active?: boolean;
  created_at?: string;
  appointment_date?: string | null;
  location?: string;
  source?: string;
  score?: number | string;
  activity?: string;
  initials?: string;
  department_id?: number;
  clinic_id?: number | string;
  quality?: "Hot" | "Warm" | "Cold";
  last_interaction_at?: string;
}

export type Quality = "Hot" | "Warm" | "Cold";

export interface ProcessedLead extends RawLead {
  assigned: string;
  quality: Quality;
  displayId: string;
  taskType: string;
  taskStatus: string;
}

import type { FilterValues } from "../../types/leads.types";
export type { FilterValues } from "../../types/leads.types";

export interface Props {
  search: string;
  tab: "active" | "archived";
  filters?: FilterValues;
  importedLeads?: RawLead[];
  canEditLeads?: boolean;
  selectedIndustry?: string;
  selectedPipelineId?: string;
}

export interface ApiErrorShape {
  response?: { data?: { detail?: string; message?: string } };
  message?: string;
}

export interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  use_case?: string;
}

// ====================== Constants ======================
export const rowsPerPage = 10;

export const VALID_TASK_TYPES = [
  "Follow Up",
  "Call Patient",
  "Book Appointment",
  "Send Message",
  "Send Email",
  "Review Details",
  "No Action",
];

export const USE_CASE_OPTIONS = [
  "Appointment",
  "Feedback",
  "Reminder",
  "Follow-Up",
  "Re-engagement",
  "No-Show",
  "General",
];

export const USE_CASE_BODY_SUGGESTIONS: Record<string, string> = {
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

export const EMOJI_LIST = [
  "😊","😀","😂","🥰","😍","🤔","😎","🙏","👍","👏",
  "❤️","🎉","🔥","✅","⭐","📋","📅","💊","🏥","🩺",
  "💉","🧬","🌸","🌟","💙","📞","📧","🕐","✉️","📝",
];

// ====================== Sticky column styles ======================
export const stickyContactStyle = {
  position: "sticky" as const,
  right: 48,
  zIndex: 2,
  bgcolor: "#FFFFFF",
};
export const stickyMenuStyle = {
  position: "sticky" as const,
  right: 0,
  zIndex: 2,
  bgcolor: "#FFFFFF",
};
export const stickyHeaderContactStyle = {
  position: "sticky" as const,
  right: 48,
  zIndex: 3,
  bgcolor: "#F8FAFC",
};
export const stickyHeaderMenuStyle = {
  position: "sticky" as const,
  right: 0,
  zIndex: 3,
  bgcolor: "#F8FAFC",
};