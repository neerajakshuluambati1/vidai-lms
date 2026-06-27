import {
  Box,
  Typography,
  Stack,
  Avatar,
  Card,
  Chip,
  Grid,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { TimeRange } from "./TimeRangeSelector";
import { selectLeads } from "../../store/leadSlice";
import { selectCampaign } from "../../store/campaignSlice";
import { selectClinic } from "../../store/clinicSlice";
import { EmployeeAPI, type Employee, type Lead } from "../../services/leads.api";
import { chartStyles } from "../../styles/dashboard/SourcePerformanceChart.style";
import SafeResponsiveContainer from "./SafeResponsiveContainer";
import {
  findBucketIndex,
  getTimeRangeBuckets,
  isWithinTimeRange,
} from "./timeRange.utils";
import type {
  TeamMember,
  MedalType,
  MemberStats,
  PerformanceChartPoint,
} from "../../types/dashboard.types";

type CampaignItem = {
  id?: string | number;
  campaign_name?: string;
  campaign_mode?: number;
  clinic?: number;
  assigned_to_id?: number;
  assigned_to_name?: string;
  status?: string;
  is_active?: boolean;
};

type DerivedMemberStats = MemberStats & {
  campaigns: number;
  conversionRate: number;
  revenueValue: number;
  slaValue: number;
  lostLeads: number;
};

type FlexibleTeamMember = Employee & {
  user_id?: number | string;
  user_name?: string;
  name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  designation?: string;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeMemberName = (member: FlexibleTeamMember): string => {
  const firstName = String(member.first_name || "").trim();
  const lastName = String(member.last_name || "").trim();
  const fullFromParts = `${firstName} ${lastName}`.trim();

  return (
    String(member.emp_name || "").trim() ||
    String(member.user_name || "").trim() ||
    String(member.name || "").trim() ||
    String(member.full_name || "").trim() ||
    fullFromParts
  );
};

const normalizeMemberRole = (member: FlexibleTeamMember): string =>
  String(
    member.emp_type ||
      member.role ||
      member.designation ||
      member.department_name ||
      "Team Member",
  ).trim() || "Team Member";

const normalizeMemberId = (member: FlexibleTeamMember): number | null =>
  toFiniteNumber(member.id) ?? toFiniteNumber(member.user_id) ?? null;

const normalizeLeadStatus = (status?: string | null): string => {
  if (!status) return "";
  const value = status
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-");
  if (value === "new" || value === "new-lead" || value === "new-leads")
    return "new";
  if (value === "appointment" || value === "appointments") return "appointment";
  if (value.includes("follow")) return "follow-ups";
  if (value === "converted") return "converted";
  if (value === "cycle-conversion" || value === "cycleconversion")
    return "cycle-conversion";
  if (value === "lost") return "lost";
  return value;
};

const formatInteger = (value: number): string => value.toLocaleString("en-US");

const conversionLineColor = "#7d859d";
const conversionGridColor = "#f5f5f5";
const conversionAxisColor = "#666";
const conversionAxisLabelColor = "#ccc";
const overviewStripSx = {
  p: "16px",
  borderRadius: "12px",
  background:
    "linear-gradient(90deg, rgba(255, 199, 183, 0.12) 0%, rgba(255, 199, 183, 0.05) 50.33%, rgba(255, 199, 183, 0.12) 100%)",
  borderTop: "0px solid transparent",
  borderBottom: "0px solid transparent",
  borderLeft: "1.6px solid #FFC7B7",
  borderRight: "1.6px solid #FFC7B7",
  boxShadow: "none",
  opacity: 1,
} as const;
const metricTileSx = {
  p: 1.5,
  background:
    "linear-gradient(90deg, rgba(255, 249, 234, 1) 0%, rgba(248, 243, 232, 1) 100%)",
  borderRadius: "12px",
  border: "1px solid #f4e0b7",
} as const;

const MemberPerformanceTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <Box sx={chartStyles.tooltipContainer}>
      <Typography variant="subtitle2" fontWeight={700}>
        {payload[0]?.value ?? 0}%
      </Typography>
    </Box>
  );
};

// Medal Icon Component
const MedalIcon = ({ type }: { type: MedalType }) => {
  const colors = {
    gold: "#FFD467",
    silver: "#C0C0C0",
    bronze: "#CD7F32",
  };

  const color =
    type === "1st"
      ? colors.gold
      : type === "2nd"
        ? colors.silver
        : colors.bronze;

  return (
    <Box
      sx={{
        position: "relative",
        width: "16px",
        height: "16px",
        boxShadow: "inset 0px -2px 4px rgba(255, 255, 255, 0.4)",
        filter: `drop-shadow(0px 8px 10px ${type === "1st" ? "rgba(255, 212, 103, 0.3)" : "rgba(0, 0, 0, 0.2)"})`,
        borderRadius: "0px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        mr: 0.5,
      }}
    >
      {/* Top Circle (Medal) */}
      <Box
        sx={{
          position: "absolute",
          left: "21.88%",
          right: "21.88%",
          top: "8.33%",
          bottom: "37.5%",
          background: color,
          borderRadius: "50%",
          boxShadow: `inset 0px -1px 2px rgba(0, 0, 0, 0.2)`,
        }}
      />
      {/* Ribbon */}
      <Box
        sx={{
          position: "absolute",
          left: "31.25%",
          right: "31.25%",
          top: "64.81%",
          bottom: "8.29%",
          background: color,
          clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)",
        }}
      />
    </Box>
  );
};

interface TeamPerformanceTabProps {
  timeRange: TimeRange;
}

const TeamPerformanceTab = ({ timeRange }: TeamPerformanceTabProps) => {
  const leads = useSelector(selectLeads) as Lead[];
  const campaigns = useSelector(selectCampaign) as CampaignItem[];
  const selectedClinicId = useSelector(selectClinic)?.id;
  const clinicId = Number(selectedClinicId ?? 0);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const performanceBuckets = useMemo(
    () => getTimeRangeBuckets(timeRange),
    [timeRange],
  );
  const fallbackPerformanceData = useMemo<PerformanceChartPoint[]>(
    () =>
      performanceBuckets.map((bucket) => ({ label: bucket.label, value: 0 })),
    [performanceBuckets],
  );
  useEffect(() => {
    if (!clinicId) {
      setTeamMembers([]);
      return;
    }

    EmployeeAPI.listByClinic(clinicId)
      .then((employees) => {
        setTeamMembers(Array.isArray(employees) ? employees : []);
      })
      .catch(() => setTeamMembers([]));
  }, [clinicId]);

  const { members, overview, memberStatsMap, memberPerformanceMap } =
    useMemo(() => {
      const activeLeads = (leads || []).filter(
        (lead) =>
          Boolean(clinicId) &&
          Number(lead.clinic_id) === clinicId &&
          lead.is_active !== false &&
          isWithinTimeRange(lead.modified_at || lead.created_at, timeRange),
      );

      // ── FIXED: only count active campaigns ───────────────────────────────
      const clinicCampaigns = (campaigns || []).filter(
        (campaign) =>
          Boolean(clinicId) &&
          Number(campaign.clinic) === clinicId &&
          campaign.is_active !== false,
      );

      if (teamMembers.length === 0 && activeLeads.length === 0) {
        return {
          members: [],
          overview: {
            calls: "0",
            followUps: "0",
            appointments: "0",
            converted: "0",
            rate: "0.0%",
            referrals: "0",
            revenue: "$0",
            sla: "0.0%",
          },
          memberStatsMap: {} as Record<string, DerivedMemberStats>,
          memberPerformanceMap: {} as Record<string, PerformanceChartPoint[]>,
        };
      }

      const memberMap = new Map<
        string,
        DerivedMemberStats & { name: string; role: string; img: string }
      >();

      const memberIdToKey = new Map<number, string>();
      const memberNameToKey = new Map<string, string>();

      const ensureMember = (id: number | null, name: string, role: string) => {
        const normalizedName = name.trim();
        if (!normalizedName) return;

        const keyId = id ?? -1;
        const memberKey = `${keyId}::${normalizedName}`;

        if (id !== null) memberIdToKey.set(id, memberKey);
        memberNameToKey.set(normalizedName.toLowerCase(), memberKey);

        if (memberMap.has(memberKey)) return;
        memberMap.set(memberKey, {
          name: normalizedName,
          role,
          img: "",
          assignedLeads: 0,
          callsMade: 0,
          followUps: 0,
          appointments: 0,
          leadConverted: 0,
          revenueGenerated: "$0",
          slaCompliance: "0%",
          campaigns: 0,
          conversionRate: 0,
          revenueValue: 0,
          slaValue: 0,
          lostLeads: 0,
        });
      };

      teamMembers.forEach((member) => {
        const flexibleMember = member as FlexibleTeamMember;
        const memberId = normalizeMemberId(flexibleMember);
        const memberName = normalizeMemberName(flexibleMember);
        const memberRole = normalizeMemberRole(flexibleMember);
        if (memberName) {
          ensureMember(memberId, memberName, memberRole);
        }
      });

      activeLeads.forEach((lead) => {
        const assignedId = toFiniteNumber(lead.assigned_to_id);
        const assignedName = String(lead.assigned_to_name || "").trim();
        if (!assignedName && assignedId === null) return;

        const fallbackName = assignedName || `User ${assignedId}`;
        ensureMember(assignedId, fallbackName, "Team Member");
      });

      clinicCampaigns.forEach((campaign) => {
        const campaignAssigneeId = Number(campaign.assigned_to_id);
        const ownerName = (campaign.assigned_to_name || "").trim().toLowerCase();
        const key =
          (Number.isFinite(campaignAssigneeId)
            ? memberIdToKey.get(campaignAssigneeId)
            : undefined) ||
          (ownerName ? memberNameToKey.get(ownerName) : undefined);
        if (!key || !memberMap.has(key)) return;

        const stats = memberMap.get(key)!;
        memberMap.set(key, { ...stats, campaigns: stats.campaigns + 1 });
      });

      activeLeads.forEach((lead) => {
        const assignedId = Number(lead.assigned_to_id);
        const assignedName = (lead.assigned_to_name || "").trim().toLowerCase();
        const key =
          (Number.isFinite(assignedId) ? memberIdToKey.get(assignedId) : undefined) ||
          (assignedName ? memberNameToKey.get(assignedName) : undefined);

        if (!key || !memberMap.has(key)) return;

        const stats = memberMap.get(key)!;
        stats.assignedLeads += 1;

        const normalizedStatus = normalizeLeadStatus(lead.lead_status);
        if (normalizedStatus === "appointment") stats.appointments += 1;
        if (normalizedStatus === "follow-ups") stats.followUps += 1;
        if (normalizedStatus === "converted" || normalizedStatus === "cycle-conversion") {
          stats.leadConverted += 1;
        }
        if (normalizedStatus === "lost") stats.lostLeads += 1;

        const actionType = (lead.next_action_type || "").toLowerCase();
        if (actionType.includes("call") || normalizedStatus === "follow-ups") {
          stats.callsMade += 1;
        }

        const referenceDate = new Date(lead.modified_at || lead.created_at);
        if (!Number.isNaN(referenceDate.getTime())) {
          const rangeAnchorMs =
            performanceBuckets[performanceBuckets.length - 1]?.end.getTime() ??
            referenceDate.getTime();
          const hoursSinceTouch =
            (rangeAnchorMs - referenceDate.getTime()) / (1000 * 60 * 60);
          if (hoursSinceTouch <= 24) {
            stats.slaValue += 1;
          }
        }
      });

      const membersWithStats = Array.from(memberMap.values()).map((stats) => {
        const conversionRate =
          stats.assignedLeads > 0
            ? (stats.leadConverted / stats.assignedLeads) * 100
            : 0;
        const growthBase =
          stats.assignedLeads > 0
            ? ((stats.leadConverted - stats.lostLeads) / stats.assignedLeads) *
              100
            : 0;
        const slaPercent =
          stats.assignedLeads > 0
            ? (stats.slaValue / stats.assignedLeads) * 100
            : 0;
        const revenueValue = stats.leadConverted * 750 + stats.campaigns * 120;

        const growth = `${growthBase >= 0 ? "+" : ""}${growthBase.toFixed(1)}%`;

        return {
          ...stats,
          role: stats.role,
          conversionRate,
          growth,
          slaValue: slaPercent,
          revenueValue,
          revenueGenerated: `$${revenueValue.toLocaleString("en-US")}`,
          slaCompliance: `${slaPercent.toFixed(1)}%`,
        };
      });

      membersWithStats.sort(
        (a, b) =>
          b.leadConverted - a.leadConverted ||
          b.assignedLeads - a.assignedLeads,
      );

      const rankedMembers: TeamMember[] = membersWithStats.map(
        (member, index) => ({
          name: member.name,
          role: member.role,
          img: member.img,
          growth: member.growth,
          rank:
            index === 0
              ? "1st (Top)"
              : index === 1
                ? "2nd"
                : index === 2
                  ? "3rd"
                  : undefined,
        }),
      );

      const totals = membersWithStats.reduce(
        (acc, member) => {
          acc.calls += member.callsMade;
          acc.followUps += member.followUps;
          acc.appointments += member.appointments;
          acc.converted += member.leadConverted;
          acc.assigned += member.assignedLeads;
          acc.revenue += member.revenueValue;
          acc.sla += member.slaValue;
          return acc;
        },
        {
          calls: 0,
          followUps: 0,
          appointments: 0,
          converted: 0,
          assigned: 0,
          revenue: 0,
          sla: 0,
        },
      );

      const teamOverview = {
        calls: formatInteger(totals.calls),
        followUps: formatInteger(totals.followUps),
        appointments: formatInteger(totals.appointments),
        converted: formatInteger(totals.converted),
        rate: `${totals.assigned > 0 ? ((totals.converted / totals.assigned) * 100).toFixed(1) : "0.0"}%`,
        referrals: formatInteger(activeLeads.length),
        revenue: `$${totals.revenue.toLocaleString("en-US")}`,
        sla: `${membersWithStats.length > 0 ? (totals.sla / membersWithStats.length).toFixed(1) : "0.0"}%`,
      };

      const derivedMemberStatsMap: Record<string, DerivedMemberStats> = {};
      membersWithStats.forEach((member) => {
        derivedMemberStatsMap[member.name] = {
          assignedLeads: member.assignedLeads,
          callsMade: member.callsMade,
          followUps: member.followUps,
          appointments: member.appointments,
          leadConverted: member.leadConverted,
          revenueGenerated: member.revenueGenerated,
          slaCompliance: member.slaCompliance,
          campaigns: member.campaigns,
          conversionRate: member.conversionRate,
          revenueValue: member.revenueValue,
          slaValue: member.slaValue,
          lostLeads: member.lostLeads,
        };
      });

      const memberPerformance: Record<string, PerformanceChartPoint[]> = {};
      membersWithStats.forEach((member) => {
        const memberKey = memberNameToKey.get(member.name.toLowerCase());

        const totalsByBucket = new Array<number>(
          performanceBuckets.length,
        ).fill(0);
        const convertedByBucket = new Array<number>(
          performanceBuckets.length,
        ).fill(0);

        activeLeads
          .filter((lead) => {
            const assignedId = Number(lead.assigned_to_id);
            const assignedName = (lead.assigned_to_name || "").trim().toLowerCase();
            const leadMemberKey =
              (Number.isFinite(assignedId)
                ? memberIdToKey.get(assignedId)
                : undefined) ||
              (assignedName ? memberNameToKey.get(assignedName) : undefined);
            return leadMemberKey === memberKey;
          })
          .forEach((lead) => {
            const date = new Date(lead.modified_at || lead.created_at);
            if (Number.isNaN(date.getTime())) return;
            const bucketIndex = findBucketIndex(date, performanceBuckets);
            if (bucketIndex < 0) return;

            totalsByBucket[bucketIndex] += 1;

            const status = normalizeLeadStatus(lead.lead_status);
            if (status === "converted" || status === "cycle-conversion") {
              convertedByBucket[bucketIndex] += 1;
            }
          });

        memberPerformance[member.name] = performanceBuckets.map(
          (bucket, bucketIndex) => {
            const total = totalsByBucket[bucketIndex];
            const converted = convertedByBucket[bucketIndex];
            const value = total > 0 ? Math.round((converted / total) * 100) : 0;
            return { label: bucket.label, value };
          },
        );
      });

      return {
        members: rankedMembers,
        overview: teamOverview,
        memberStatsMap: derivedMemberStatsMap,
        memberPerformanceMap: memberPerformance,
      };
    }, [
      campaigns,
      clinicId,
      leads,
      performanceBuckets,
      teamMembers,
      timeRange,
    ]);

  const topPerformer = members.find((m) => m.rank === "1st (Top)");
  const otherTops = members.filter((m) => m.rank === "2nd" || m.rank === "3rd");
  const lowPerformers = members.filter((m) => m.growth.startsWith("-"));

  const activeSelectedMember = useMemo(() => {
    if (!selectedMember) return null;
    return members.some((member) => member.name === selectedMember.name)
      ? selectedMember
      : null;
  }, [members, selectedMember]);

  const fullPerformanceData: PerformanceChartPoint[] = activeSelectedMember
    ? memberPerformanceMap[activeSelectedMember.name] &&
      memberPerformanceMap[activeSelectedMember.name].length > 0
      ? memberPerformanceMap[activeSelectedMember.name]
      : fallbackPerformanceData
    : [];

  const performanceData: PerformanceChartPoint[] = fullPerformanceData;

  const memberStats: DerivedMemberStats | null = activeSelectedMember
    ? memberStatsMap[activeSelectedMember.name] || {
        assignedLeads: 0,
        callsMade: 0,
        followUps: 0,
        appointments: 0,
        leadConverted: 0,
        revenueGenerated: "$0",
        slaCompliance: "0.0%",
        campaigns: 0,
        conversionRate: 0,
        revenueValue: 0,
        slaValue: 0,
        lostLeads: 0,
      }
    : null;
  const stats = memberStats!;

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 2 },
        height: "auto",
        minHeight: 0,
        overflowY: "auto",
      }}
    >
      {/* 1. Member Avatar Bar */}
      <Stack
        direction="row"
        spacing={3}
        sx={{ mb: 4, overflowX: "auto", pb: 1 }}
      >
        <Stack
          alignItems="center"
          spacing={1}
          sx={{ cursor: "pointer" }}
          onClick={() => setSelectedMember(null)}
        >
          <Avatar
            sx={{
              bgcolor: activeSelectedMember === null ? "#fff5f5" : "#f5f5f5",
              border:
                activeSelectedMember === null
                  ? "2px solid #ff6b6b"
                  : "2px solid transparent",
              width: 56,
              height: 56,
              color: "#ff6b6b",
            }}
          >
            <Box component="span" sx={{ fontSize: "20px" }}>
              👥
            </Box>
          </Avatar>
          <Typography variant="caption" color="error" fontWeight={600}>
            All
          </Typography>
        </Stack>
        {members.map((member) => (
          <Stack
            key={member.name}
            alignItems="center"
            spacing={1}
            sx={{ cursor: "pointer", position: "relative" }}
            onClick={() => setSelectedMember(member)}
          >
            <Box sx={{ position: "relative" }}>
              <Avatar
                src={member.img}
                sx={{
                  width: 56,
                  height: 56,
                  border:
                    activeSelectedMember?.name === member.name
                      ? "2px solid #1976d2"
                      : "2px solid transparent",
                  opacity:
                    activeSelectedMember &&
                    activeSelectedMember?.name !== member.name
                      ? 0.5
                      : 1,
                }}
              />
              {member.rank && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: -2,
                    right: 8,
                    width: "20px",
                    height: "20px",
                    bgcolor: "white",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  <MedalIcon
                    type={
                      member.rank === "1st (Top)"
                        ? "1st"
                        : member.rank === "2nd"
                          ? "2nd"
                          : "3rd"
                    }
                  />
                </Box>
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{ whiteSpace: "nowrap", fontSize: "10px" }}
            >
              {member.name}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
        {activeSelectedMember
          ? `${activeSelectedMember.name}'s Performance Overview`
          : "Team Performance Overview"}
      </Typography>

      {/* INDIVIDUAL MEMBER VIEW */}
      {activeSelectedMember ? (
        <>
          {/* Member Stats Card */}
          <Card
            sx={{
              ...overviewStripSx,
              width: "100%",
              minHeight: 63,
              mb: 3,
              position: "relative",
            }}
          >
            {activeSelectedMember.rank && (
              <Box sx={{ position: "absolute", left: 16, top: 10 }}>
                <MedalIcon
                  type={
                    activeSelectedMember.rank === "1st (Top)"
                      ? "1st"
                      : activeSelectedMember.rank === "2nd"
                        ? "2nd"
                        : "3rd"
                  }
                />
              </Box>
            )}
            <Typography
              variant="caption"
              color="success.main"
              fontWeight={700}
              sx={{ position: "absolute", right: 16, top: 10 }}
            >
              {activeSelectedMember.growth}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              divider={
                <Box sx={{ width: "1px", bgcolor: "#FFC7B7", height: 32 }} />
              }
              sx={{
                flexWrap: { xs: "wrap", sm: "nowrap" },
                overflowX: { xs: "auto", sm: "hidden" },
                mt: 1.5,
                pt: 1,
                pb: 0.5,
                gap: { xs: 1, sm: 0 },
              }}
            >
              <Box sx={{ textAlign: "left", flex: 1, minWidth: 0, px: 0.75 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "10px", display: "block" }}
                >
                  Assigned Leads
                </Typography>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}
                >
                  {stats.assignedLeads}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "left", flex: 1, minWidth: 0, px: 0.75 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "10px", display: "block" }}
                >
                  Calls Made
                </Typography>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}
                >
                  {stats.callsMade}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "left", flex: 1, minWidth: 0, px: 0.75 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "10px", display: "block" }}
                >
                  Follow-Ups
                </Typography>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}
                >
                  {stats.followUps}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "left", flex: 1, minWidth: 0, px: 0.75 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "10px", display: "block" }}
                >
                  Appointments
                </Typography>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}
                >
                  {stats.appointments}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "left", flex: 1, minWidth: 0, px: 0.75 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "10px", display: "block" }}
                >
                  Lead Converted
                </Typography>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}
                >
                  {stats.leadConverted}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "left", flex: 1, minWidth: 0, px: 0.75 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "10px", display: "block" }}
                >
                  Revenue Generated
                </Typography>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}
                >
                  {stats.revenueGenerated}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "left", flex: 1, minWidth: 0, px: 0.75 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "10px", display: "block" }}
                >
                  SLA Compliance
                </Typography>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}
                >
                  {stats.slaCompliance}
                </Typography>
              </Box>
            </Stack>
          </Card>

          {/* Performance Chart */}
          <Card
            sx={{
              p: 0,
              borderRadius: 2,
              border: "none",
              boxShadow: "none",
              bgcolor: "transparent",
            }}
          >
            <Box sx={chartStyles.container}>
              <Box sx={chartStyles.chartWrapper}>
                <SafeResponsiveContainer minHeight={260}>
                  <LineChart
                    data={performanceData}
                    margin={{ top: 30, right: 30, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={conversionGridColor}
                    />

                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: conversionAxisColor }}
                      dy={10}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: conversionAxisColor }}
                      domain={[0, 100]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                      allowDecimals={false}
                      label={{
                        value: "Conversion Rate (in %)",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 10,
                        fill: conversionAxisLabelColor,
                        offset: 0,
                      }}
                    />

                    <Tooltip
                      content={<MemberPerformanceTooltip />}
                      cursor={{ stroke: "#f0f0f0", strokeWidth: 1 }}
                    />

                    <Line
                      type="linear"
                      dataKey="value"
                      stroke={conversionLineColor}
                      strokeWidth={2}
                      dot={{
                        r: 4,
                        fill: conversionLineColor,
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      animationDuration={1000}
                    />
                  </LineChart>
                </SafeResponsiveContainer>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  mt: 0.5,
                  px: 2,
                }}
              >
                <Box sx={{ flex: 1, height: "1px", bgcolor: "#e6e6e6" }} />
                <Typography
                  variant="caption"
                  sx={{ fontSize: 20, color: "#b3b3b3", lineHeight: 1 }}
                >
                  Time Period
                </Typography>
                <Box sx={{ flex: 1, height: "1px", bgcolor: "#e6e6e6" }} />
              </Box>
            </Box>
          </Card>
        </>
      ) : (
        /* TEAM OVERVIEW */
        <>
          {/* 2. Horizontal Stats Overview Card */}
          <Card sx={{ ...overviewStripSx, mb: 4 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              divider={
                <Box sx={{ width: "1px", bgcolor: "#FFC7B7", height: 30 }} />
              }
              sx={{
                flexWrap: { xs: "wrap", sm: "nowrap" },
                overflowX: { xs: "auto", sm: "hidden" },
                gap: { xs: 1, sm: 0 },
              }}
            >
              {Object.entries(overview).map(([key, val]) => (
                <Box
                  key={key}
                  sx={{ textAlign: "left", flex: 1, minWidth: 0, px: 0.75 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "10px", display: "block" }}
                  >
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}
                  >
                    {val}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Card>

          {/* 3 & 4. Performance Content Grid */}
          <Grid container spacing={3}>
            {/* Left Column: Top Performers */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                Top Performers
              </Typography>

              {topPerformer && (
                <Card
                  sx={{
                    p: 3,
                    mb: 3,
                    borderRadius: "16px",
                    position: "relative",
                    border: "1px solid #f0f0f0",
                    boxShadow: "none",
                  }}
                >
                  <Chip
                    icon={<MedalIcon type="1st" />}
                    label="1st (Top)"
                    size="small"
                    sx={{
                      position: "absolute",
                      right: 20,
                      top: 20,
                      bgcolor: "#fff9c4",
                      color: "#fbc02d",
                      fontWeight: 700,
                      "& .MuiChip-icon": {
                        ml: 0.5,
                        mr: -0.25,
                      },
                    }}
                  />
                  <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                    <Avatar
                      src={topPerformer.img}
                      sx={{ width: 70, height: 70 }}
                    />
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {topPerformer.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {topPerformer.role}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="success.main"
                        fontWeight={700}
                      >
                        ✅ {topPerformer.growth}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Nested Grid for Metrics */}
                  <Grid container spacing={2}>
                    {[
                      {
                        l: "Leads Generated",
                        v: String(
                          memberStatsMap[topPerformer.name]?.assignedLeads ?? 0,
                        ),
                      },
                      {
                        l: "Assigned Leads",
                        v: String(
                          memberStatsMap[topPerformer.name]?.assignedLeads ?? 0,
                        ),
                      },
                      {
                        l: "Calls Made",
                        v: String(
                          memberStatsMap[topPerformer.name]?.callsMade ?? 0,
                        ),
                      },
                      {
                        l: "Follow-Ups",
                        v: String(
                          memberStatsMap[topPerformer.name]?.followUps ?? 0,
                        ),
                      },
                      {
                        l: "Appointments",
                        v: String(
                          memberStatsMap[topPerformer.name]?.appointments ?? 0,
                        ),
                      },
                      {
                        l: "Lead Converted",
                        v: String(
                          memberStatsMap[topPerformer.name]?.leadConverted ?? 0,
                        ),
                      },
                    ].map((stat) => (
                      <Grid size={{ xs: 4 }} key={stat.l}>
                        <Box sx={metricTileSx}>
                          <Typography variant="h6" fontWeight={700}>
                            {stat.v}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: "9px" }}
                          >
                            {stat.l}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Card>
              )}

              {/* Secondary Top Performers */}
              <Grid container spacing={2}>
                {otherTops.map((tp) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={tp.name}>
                    <Card
                      sx={{
                        p: 2,
                        borderRadius: "16px",
                        border: "1px solid #f0f0f0",
                        boxShadow: "none",
                        height: "100%",
                        position: "relative",
                      }}
                    >
                      <Chip
                        icon={
                          <MedalIcon type={tp.rank === "2nd" ? "2nd" : "3rd"} />
                        }
                        label={tp.rank}
                        size="small"
                        sx={{
                          position: "absolute",
                          right: 16,
                          top: 16,
                          bgcolor: tp.rank === "2nd" ? "#e3f2fd" : "#f3e5f5",
                          color: tp.rank === "2nd" ? "#1976d2" : "#7b1fa2",
                          fontWeight: 700,
                          fontSize: "10px",
                          "& .MuiChip-icon": {
                            ml: 0.5,
                            mr: -0.25,
                          },
                        }}
                      />
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        sx={{ mb: 2 }}
                      >
                        <Stack direction="row" spacing={1.5}>
                          <Avatar src={tp.img} sx={{ width: 45, height: 45 }} />
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              {tp.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block" }}
                            >
                              {tp.role}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="success.main"
                              fontWeight={700}
                            >
                              ✅ {tp.growth}
                            </Typography>
                          </Box>
                        </Stack>
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={2}
                        sx={{ ...metricTileSx, p: 1 }}
                      >
                        <Box>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={{ display: "block" }}
                          >
                            {(
                              memberStatsMap[tp.name]?.conversionRate ?? 0
                            ).toFixed(1)}
                            %
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontSize: "8px" }}
                          >
                            Conv. Rate
                          </Typography>
                        </Box>
                        <Box>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={{ display: "block" }}
                          >
                            $
                            {Math.round(
                              memberStatsMap[tp.name]?.revenueValue ?? 0,
                            ).toLocaleString("en-US")}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontSize: "8px" }}
                          >
                            Revenue
                          </Typography>
                        </Box>
                      </Stack>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Right Column: Low Performers */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                Low Performers
              </Typography>

              <Card
                sx={{
                  p: 2,
                  borderRadius: "16px",
                  border: "1px solid #f0f0f0",
                  boxShadow: "none",
                }}
              >
                {lowPerformers.map((lp, i) => (
                  <Stack
                    key={i}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 2.5, "&:last-child": { mb: 0 } }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar src={lp.img} sx={{ width: 40, height: 40 }} />
                      <Box>
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{ display: "block" }}
                        >
                          {lp.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lp.role}
                        </Typography>
                      </Box>
                    </Stack>

                    <Chip
                      label={lp.growth}
                      size="small"
                      variant="outlined"
                      color="error"
                      sx={{ height: 20, fontSize: "10px", fontWeight: 700 }}
                    />
                  </Stack>
                ))}
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default TeamPerformanceTab;