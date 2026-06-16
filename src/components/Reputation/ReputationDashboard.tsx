import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";

import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import { selectUser } from "../../store/authSlice";

import {
  fetchReviewRequests,
  selectReputationRequests,
  selectReputationReviews,
} from "../../store/reputationSlice";
import { fetchLeads } from "../../store/leadSlice";
import { selectClinic } from "../../store/clinicSlice";
import {
  hasAnySubcategoryActionPermission,
  resolveUserRole,
} from "../../utils/roleAccess";
import { reputationApi } from "../../services/reputation.api";

import BackwardIcon from "../../assets/icons/Backward_icon.svg";
import FilterLeadsIcon from "../../assets/icons/Filter_Leads.svg";

import ReputationHeaderCards from "./ReputationHeaderCards";
import ReviewRequestDialog from "./ReviewRequest";
import ReviewCard from "./ReviewCard";
import ReviewCardDetailedView from "./ReviewCardDetailedView";
import ReviewRequestFilterDialog, {
  type ReviewRequestFilters,
} from "./ReviewRequestFilterDialog";

type ReviewRequestItem = {
  id: string;
  request_name: string;
  status: string;
  requests_sent?: number;
  request_sent?: number;
  reviews_submitted?: number;
  review_submitted?: number;
  total_reviews?: number;
  avg_rating?: number;
  lead_ids?: string[];
  leads?: unknown[];
  mode?: string;
  created_at?: string;
};

type DashboardMetrics = {
  avgRating: number;
  reviewRequestsSent: number;
  reviewsSubmitted: number;
  totalReviews: number;
  conversionRate: number;
};

type RequestMetrics = {
  sent: number;
  submitted: number;
  totalReviews: number;
  avgRating: number;
  conversionRate: number;
};

type RequestRecord = Record<string, unknown>;

type PerRequestReviewData = {
  submitted: number;
  avgRating: number;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const asRecord = (value: unknown): RequestRecord => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return value as RequestRecord;
};

const pickNumber = (source: RequestRecord, keys: string[]): number => {
  for (const key of keys) {
    const value = toNumber(source[key]);
    if (value > 0) {
      return value;
    }
  }

  return 0;
};

const pickArrayLength = (source: RequestRecord, keys: string[]): number => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value) && value.length > 0) {
      return value.length;
    }
  }

  return 0;
};

const resolveSentCount = (record: RequestRecord): number => {
  const explicitSent = pickNumber(record, [
    "requests_sent",
    "request_sent",
    "requestsSent",
    "requestSent",
    "sent_count",
    "sentCount",
    "leads_count",
    "lead_count",
    "selected_leads_count",
    "total_recipients",
  ]);

  if (explicitSent > 0) {
    return explicitSent;
  }

  return pickArrayLength(record, ["lead_ids", "leads", "selected_leads"]);
};

const resolveSubmittedCount = (record: RequestRecord): number => {
  return pickNumber(record, [
    "reviews_submitted",
    "review_submitted",
    "reviewsSubmitted",
    "reviewSubmitted",
    "submitted_count",
    "submittedCount",
    "reviews_count",
    "review_count",
    "total_submitted",
  ]);
};

const resolveAvgRating = (record: RequestRecord): number => {
  return pickNumber(record, [
    "avg_rating",
    "average_rating",
    "avgRating",
    "rating_avg",
  ]);
};

const resolveTotalReviews = (record: RequestRecord): number => {
  return pickNumber(record, [
    "total_reviews",
    "reviews_count",
    "review_count",
    "total_submitted",
  ]);
};

const ReputationDashboard = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector(selectUser);
  const authUser = user as unknown as Record<string, unknown> | null;
  const role = resolveUserRole(authUser);
  const nestedAuthUser =
    authUser?.user && typeof authUser.user === "object"
      ? (authUser.user as Record<string, unknown>)
      : null;
  const permissions = authUser?.permissions ?? nestedAuthUser?.permissions;
  const reputationAliases = ["reputation management", "reputation"];
  const canViewReputation =
    role === "super_admin" ||
    hasAnySubcategoryActionPermission(permissions, reputationAliases, "view") ||
    hasAnySubcategoryActionPermission(permissions, reputationAliases, "print");
  const canManageReputation =
    role === "super_admin" ||
    hasAnySubcategoryActionPermission(permissions, reputationAliases, "add") ||
    hasAnySubcategoryActionPermission(permissions, reputationAliases, "edit");
  const addPermissionTooltip = "You don't have permission to add.";

  const requests = useSelector(selectReputationRequests) as ReviewRequestItem[];
  const reputationReviews = useSelector(selectReputationReviews) as Array<
    Record<string, unknown>
  >;

  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [openReviewDetails, setOpenReviewDetails] = useState(false);
  const [openFilterDialog, setOpenFilterDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [requestFilters, setRequestFilters] = useState<ReviewRequestFilters>({
    fromDate: null,
    toDate: null,
    mode: "",
    status: "",
  });
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [selectedRequestName, setSelectedRequestName] = useState<string>("");
  // reviewsData holds the live per-request review counts fetched directly
  // from the /reviews/ endpoint. This is simpler and more reliable than the
  // previous overrides+localStorage cache approach.
  const [reviewsData, setReviewsData] = useState<
    Record<string, PerRequestReviewData>
  >({});

  // Fetch reviews for every request and derive submitted count + avgRating.
  // Re-runs whenever the requests list changes AND every 60 s so newly
  // submitted reviews appear without a full page reload.
  useEffect(() => {
    if (!requests.length) {
      return;
    }

    let cancelled = false;

    const fetchAllReviewMetrics = async () => {
      const results = await Promise.allSettled(
        requests.map(async (request) => {
          const requestId = String(request.id);
          const rows = await reputationApi.getReviews(requestId);
          const submitted = Array.isArray(rows) ? rows.length : 0;
          const validRatings = Array.isArray(rows)
            ? rows
                .map((row) => toNumber(asRecord(row).rating))
                .filter((v) => v > 0)
            : [];
          const avgRating =
            validRatings.length > 0
              ? validRatings.reduce((sum, v) => sum + v, 0) /
                validRatings.length
              : 0;
          return { requestId, submitted, avgRating };
        }),
      );

      if (cancelled) {
        return;
      }

      const data: Record<string, PerRequestReviewData> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const { requestId, submitted, avgRating } = result.value;
          data[requestId] = { submitted, avgRating };
        }
      });
      setReviewsData(data);
    };

    void fetchAllReviewMetrics();

    const interval = setInterval(() => {
      void fetchAllReviewMetrics();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [requests]);

  const requestMetricsById = useMemo(() => {
    const metrics = new Map<string, RequestMetrics>();

    requests.forEach((request: ReviewRequestItem) => {
      const requestId = String(request.id);
      const reqRecord = asRecord(request);
      const sent = resolveSentCount(reqRecord);
      const live = reviewsData[requestId];
      // Prefer live review data (from /reviews/ endpoint); fall back to
      // whatever the backend list endpoint returns on the request object.
      const submitted =
        live !== undefined
          ? live.submitted
          : Math.max(
              resolveSubmittedCount(reqRecord),
              resolveTotalReviews(reqRecord),
            );
      const avgRating =
        live !== undefined ? live.avgRating : resolveAvgRating(reqRecord);
      const totalReviews = submitted;
      const conversionRate = sent > 0 ? (submitted / sent) * 100 : 0;

      metrics.set(requestId, {
        sent,
        submitted,
        totalReviews,
        avgRating,
        conversionRate,
      });
    });

    return metrics;
  }, [requests, reviewsData]);

  const dashboardMetrics = useMemo<DashboardMetrics>(() => {
    if (!requests.length) {
      return {
        avgRating: 0,
        reviewRequestsSent: 0,
        reviewsSubmitted: 0,
        totalReviews: 0,
        conversionRate: 0,
      };
    }

    let reviewRequestsSent = 0;
    let reviewsSubmitted = 0;
    let totalReviews = 0;
    let weightedRatingTotal = 0;

    requests.forEach((request: ReviewRequestItem) => {
      const metrics = requestMetricsById.get(String(request.id));
      if (!metrics) {
        return;
      }

      reviewRequestsSent += metrics.sent;
      reviewsSubmitted += metrics.submitted;
      totalReviews += metrics.totalReviews;
      weightedRatingTotal += metrics.avgRating * metrics.submitted;
    });

    const avgRating =
      reviewsSubmitted > 0 ? weightedRatingTotal / reviewsSubmitted : 0;
    const conversionRate =
      reviewRequestsSent > 0
        ? (reviewsSubmitted / reviewRequestsSent) * 100
        : 0;

    return {
      avgRating,
      reviewRequestsSent,
      reviewsSubmitted,
      totalReviews,
      conversionRate,
    };
  }, [requests, requestMetricsById]);

  const selectedRequestMetrics = useMemo<RequestMetrics>(() => {
    if (!selectedRequestId) {
      return {
        sent: 0,
        submitted: 0,
        totalReviews: 0,
        avgRating: 0,
        conversionRate: 0,
      };
    }

    const base = requestMetricsById.get(String(selectedRequestId)) || {
      sent: 0,
      submitted: 0,
      totalReviews: 0,
      avgRating: 0,
      conversionRate: 0,
    };

    // When the detail view is open, reputationReviews holds the live reviews
    // for this specific request (fetched by ReviewCardDetailedView).
    // Use them to compute accurate submitted count and avg rating.
    if (openReviewDetails && reputationReviews.length > 0) {
      const validRatings = reputationReviews
        .map((r) => toNumber(r.rating))
        .filter((v) => v > 0);
      const submitted = reputationReviews.length;
      const avgRating =
        validRatings.length > 0
          ? validRatings.reduce((sum, v) => sum + v, 0) / validRatings.length
          : 0;
      const sent = Math.max(base.sent, submitted);
      const conversionRate = sent > 0 ? (submitted / sent) * 100 : 0;
      return {
        sent,
        submitted,
        totalReviews: submitted,
        avgRating,
        conversionRate,
      };
    }

    return base;
  }, [
    requestMetricsById,
    selectedRequestId,
    openReviewDetails,
    reputationReviews,
  ]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const fromDate = requestFilters.fromDate?.startOf("day") || null;
    const toDate = requestFilters.toDate?.endOf("day") || null;

    return requests.filter((req: ReviewRequestItem) => {
      const matchesName =
        !query || req.request_name?.toLowerCase().includes(query);

      const requestMode = (req.mode || "").toLowerCase();
      const selectedMode = requestFilters.mode.toLowerCase();
      const matchesMode = !selectedMode || requestMode === selectedMode;

      const requestStatus = (req.status || "").toLowerCase();
      const normalizedFilterStatus =
        requestFilters.status === "schedule"
          ? "scheduled"
          : requestFilters.status;
      const matchesStatus =
        !normalizedFilterStatus || requestStatus === normalizedFilterStatus;

      const requestDate = req.created_at ? dayjs(req.created_at) : null;
      const matchesFromDate =
        !fromDate ||
        !!requestDate?.isAfter(fromDate) ||
        !!requestDate?.isSame(fromDate);
      const matchesToDate =
        !toDate ||
        !!requestDate?.isBefore(toDate) ||
        !!requestDate?.isSame(toDate);

      return (
        matchesName &&
        matchesMode &&
        matchesStatus &&
        matchesFromDate &&
        matchesToDate
      );
    });
  }, [requests, searchQuery, requestFilters]);

  const _reputationClinic = useSelector(selectClinic);

  useEffect(() => {
    if (!canViewReputation) {
      return;
    }

    dispatch(fetchLeads());
    dispatch(fetchReviewRequests());
  }, [canViewReputation, dispatch, _reputationClinic?.id]);

  return (
    <Box sx={{ p: { xs: 0.25, sm: 0.5 } }}>
      {/* Page Title */}
      {!openReviewDetails && (
        <Typography variant="h5" sx={{ mb: 3 }}>
          Reputation Management
        </Typography>
      )}

      {!openReviewDetails && !canViewReputation ? (
        <Typography sx={{ color: "#B45309", mb: 2 }}>
          You do not have permission to view reputation management.
        </Typography>
      ) : null}

      {/* ================= NORMAL PAGE ================= */}
      {!openReviewDetails && canViewReputation && (
        <>
          {/* Header Cards */}
          <ReputationHeaderCards
            avgRating={dashboardMetrics.avgRating}
            reviewsSubmitted={dashboardMetrics.reviewsSubmitted}
            reviewRequestsSent={dashboardMetrics.reviewRequestsSent}
            totalReviews={dashboardMetrics.totalReviews}
            conversionRate={dashboardMetrics.conversionRate}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
              mb: 2,
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography
              sx={{
                fontSize: 16,
                fontWeight: 600,
                color: "#111827",
                lineHeight: 1.2,
              }}
            >
              Review Requests
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 1,
                ml: { xs: 0, sm: "auto" },
                width: { xs: "100%", sm: "auto" },
              }}
            >
              <TextField
                size="small"
                placeholder="Search by Request name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  flex: { xs: "1 1 180px", sm: "0 1 auto" },
                  width: { xs: "auto", sm: 240 },
                  minWidth: { xs: 0, sm: 220 },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    backgroundColor: "#fff",
                  },
    "& input::placeholder": {   
      fontSize: "14px",
      opacity: 0.5,
    },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "#9CA3AF", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <IconButton
                sx={{ p: 0 }}
                onClick={() => setOpenFilterDialog(true)}
              >
                <img
                  src={FilterLeadsIcon}
                  alt="Filter"
                  style={{ width: 40, height: 40 }}
                />
              </IconButton>

              <Tooltip
                title={!canManageReputation ? addPermissionTooltip : ""}
                disableHoverListener={canManageReputation}
                disableFocusListener={canManageReputation}
                disableTouchListener={canManageReputation}
              >
                <span>
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (!canManageReputation) return;
                      setOpenReviewDialog(true);
                    }}
                    disabled={!canManageReputation}
                    startIcon={<AddCircleOutlineIcon />}
                    className="mobile-add-button"
                    sx={{
                      textTransform: "none",
                      borderRadius: "10px",
                      px: 2.25,
                      py: 1,
                      fontSize: 14,
                      fontWeight: 600,
                      backgroundColor: "#505050",
                      color: "#fff",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      width: "auto",
                      "&:hover": {
                        backgroundColor: "#232323",
                      },
                    }}
                  >
                    <span className="mobile-add-button-label">
                      New Review Request
                    </span>
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Box>

          {/* Review Request Dialog */}
          <ReviewRequestDialog
            open={openReviewDialog}
            onClose={() => setOpenReviewDialog(false)}
            onOpenChange={setOpenReviewDialog}
          />

          <ReviewRequestFilterDialog
            open={openFilterDialog}
            initialFilters={requestFilters}
            onClose={() => setOpenFilterDialog(false)}
            onApply={(filters) => setRequestFilters(filters)}
            onClear={() =>
              setRequestFilters({
                fromDate: null,
                toDate: null,
                mode: "",
                status: "",
              })
            }
          />

          {/* Review Cards Grid */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {filteredRequests.map((req: ReviewRequestItem) => (
              <ReviewCard
                key={req.id}
                request={{
                  ...req,
                  requests_sent:
                    requestMetricsById.get(String(req.id))?.sent ??
                    req.requests_sent ??
                    0,
                  reviews_submitted:
                    requestMetricsById.get(String(req.id))?.submitted ??
                    req.reviews_submitted ??
                    0,
                  avg_rating:
                    requestMetricsById.get(String(req.id))?.avgRating ??
                    req.avg_rating ??
                    0,
                }}
                onOpen={() => {
                  setSelectedRequestId(req.id);
                  setSelectedRequestName(req.request_name);
                  setOpenReviewDetails(true);
                }}
              />
            ))}
          </Box>
        </>
      )}

      {/* ================= DETAILED VIEW PAGE ================= */}
      {openReviewDetails && (
        <>
          {/* Back Button */}
          <Box
            sx={{
              mb: 2,
              display: "flex",
              alignItems: "center",
              gap: 1,
              cursor: "pointer",
              width: "fit-content",
            }}
            onClick={() => {
              setOpenReviewDetails(false);
              setSelectedRequestId(null);
            }}
          >
            <img src={BackwardIcon} alt="Back" width={40} height={40} />

            <Typography
              sx={{
                fontSize: 18,
                fontWeight: 600,
                color: "#232323",
              }}
            >
              {selectedRequestName}
            </Typography>
          </Box>

          {/* Header Cards */}
          <ReputationHeaderCards
            avgRating={selectedRequestMetrics.avgRating}
            reviewsSubmitted={selectedRequestMetrics.submitted}
            reviewRequestsSent={selectedRequestMetrics.sent}
            totalReviews={selectedRequestMetrics.totalReviews}
            conversionRate={selectedRequestMetrics.conversionRate}
            showTotalReviews={false}
          />

          {/* Reviews Table */}
          {selectedRequestId && (
            <ReviewCardDetailedView requestId={selectedRequestId} />
          )}
        </>
      )}
    </Box>
  );
};

export default ReputationDashboard;
