import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Pagination,
  PaginationItem,
  Popover,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CheckIcon from "@mui/icons-material/Check";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { type UserRecord as User } from "../../../../services/users.api";
import EditUser from "../../../../assets/icons/Edit_User_List.svg";

interface Props {
  users: User[];
  isLoading?: boolean;
  onToggleUserStatus: (userId: number) => Promise<void> | void;
  onNewUser: () => void;
  onEditUser?: (user: User) => void;
  onDeleteUser?: (userId: number) => Promise<void> | void;
  canViewUsers?: boolean;
  canAddUsers?: boolean;
  canEditUsers?: boolean;
  canDeleteUsers?: boolean;
  pinnedUserId?: number | null;
}

type OptionalColumnKey =
  | "gender"
  | "dateOfJoining"
  | "dateOfBirth"
  | "mobileNumber"
  | "email";

type SortKey = "username" | "name" | "role";
type SortDirection = "asc" | "desc";

const OPTIONAL_COLUMNS: Array<{
  key: OptionalColumnKey;
  label: string;
  getValue: (user: User) => string;
}> = [
  { key: "gender", label: "Gender", getValue: (user) => user.gender },
  {
    key: "dateOfJoining",
    label: "Date Of Joining",
    getValue: (user) => user.dateOfJoining,
  },
  {
    key: "dateOfBirth",
    label: "Date Of Birth",
    getValue: (user) => user.dateOfBirth,
  },
  {
    key: "mobileNumber",
    label: "Mobile Number",
    getValue: (user) => user.mobileNumber,
  },
  { key: "email", label: "Email", getValue: (user) => user.email },
];

const ROWS_PER_PAGE = 8;

const FIXED_TABLE_MIN_WIDTH = 670;
const OPTIONAL_COLUMN_MIN_WIDTH = 160;

const headerCellSx = {
  color: "#505050",
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: "#FAFAFA",
  borderBottom: "2px solid #FAFAFA",
  py: 1,
  borderRadius: "2px",
  whiteSpace: "nowrap",
};

const bodyCellSx = {
  color: "#4A4A4A",
  fontSize: 13,
  borderBottom: "1px solid #F8F8F8",
  py: 1.4,
  whiteSpace: "nowrap",
};

const checkboxSx = {
  p: 0,
  width: 20,
  height: 20,
  borderRadius: "6px",
  color: "#D8EEDD",
  "& .MuiSvgIcon-root": {
    fontSize: 20,
  },
  "&.Mui-checked": {
    color: "#DFF4E4",
  },
  "&.MuiCheckbox-root:hover": {
    backgroundColor: "transparent",
  },
};

const checkboxIcon = (
  <Box
    sx={{
      width: 18,
      height: 18,
      borderRadius: "6px",
      border: "1px solid #D9ECDD",
      bgcolor: "#FFFFFF",
    }}
  />
);

const checkedCheckboxIcon = (
  <Box
    sx={{
      width: 18,
      height: 18,
      borderRadius: "6px",
      bgcolor: "#E8F7EB",
      color: "#73C686",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <CheckIcon sx={{ fontSize: 12 }} />
  </Box>
);

const EditActionIcon = ({
  alt = "Edit user",
  size = 18,
}: {
  alt?: string;
  size?: number;
}) => (
  <Box
    component="img"
    src={EditUser}
    alt={alt}
    sx={{
      width: size,
      height: size,
      display: "block",
    }}
  />
);

const UsersList: React.FC<Props> = ({
  users,
  isLoading = false,
  onToggleUserStatus,
  onNewUser,
  onEditUser,
  onDeleteUser,
  canViewUsers = true,
  canAddUsers = true,
  canEditUsers = true,
  canDeleteUsers = false,
  pinnedUserId,
}) => {
  const addPermissionTooltip = "You do not have permission to add users.";
  const editPermissionTooltip = "You do not have permission to edit users.";
  const deletePermissionTooltip =
    "You do not have permission to delete users.";

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [columnPickerAnchor, setColumnPickerAnchor] =
    useState<HTMLElement | null>(null);
  const [visibleOptionalColumns, setVisibleOptionalColumns] = useState<
    Record<OptionalColumnKey, boolean>
  >({
    gender: false,
    dateOfJoining: false,
    dateOfBirth: false,
    mobileNumber: false,
    email: false,
  });
  const [sortBy, setSortBy] = useState<SortKey | null>("username");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [deleteCandidate, setDeleteCandidate] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) =>
      user.username.toLowerCase().includes(normalizedSearch),
    );
  }, [searchTerm, users]);

  const activeOptionalColumns = useMemo(
    () =>
      OPTIONAL_COLUMNS.filter((column) => visibleOptionalColumns[column.key]),
    [visibleOptionalColumns],
  );

  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];

    if (sortBy) {
      const resolveValue = (user: User): string => {
        if (sortBy === "name") {
          return `${user.firstName} ${user.lastName}`.trim().toLowerCase();
        }

        if (sortBy === "role") {
          return user.role.toLowerCase();
        }

        return user.username.toLowerCase();
      };

      list.sort((a, b) => {
        const left = resolveValue(a);
        const right = resolveValue(b);

        if (left < right) return sortDirection === "asc" ? -1 : 1;
        if (left > right) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    // Pin the recently updated/created user to the very first row.
    if (pinnedUserId != null) {
      const pinnedIndex = list.findIndex((u) => u.id === pinnedUserId);
      if (pinnedIndex > 0) {
        const [pinned] = list.splice(pinnedIndex, 1);
        list.unshift(pinned);
      }
    }

    return list;
  }, [filteredUsers, sortBy, sortDirection, pinnedUserId]);

  const isColumnPickerOpen = Boolean(columnPickerAnchor);

  const handleOpenColumnPicker = (event: React.MouseEvent<HTMLElement>) => {
    setColumnPickerAnchor(event.currentTarget);
  };

  const handleCloseColumnPicker = () => {
    setColumnPickerAnchor(null);
  };

  const handleToggleOptionalColumn = (key: OptionalColumnKey) => {
    setVisibleOptionalColumns((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSort = (nextSortBy: SortKey) => {
    if (sortBy === nextSortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection("asc");
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortBy || sortBy !== key) {
      return <UnfoldMoreIcon sx={{ fontSize: 14, color: "#9A9A9A" }} />;
    }

    return sortDirection === "asc" ? (
      <ArrowUpwardIcon sx={{ fontSize: 14, color: "#676767" }} />
    ) : (
      <ArrowDownwardIcon sx={{ fontSize: 14, color: "#676767" }} />
    );
  };

  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * ROWS_PER_PAGE;
  const paginatedUsers = sortedUsers.slice(
    startIndex,
    startIndex + ROWS_PER_PAGE,
  );
  const showingFrom = sortedUsers.length === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + paginatedUsers.length;
  const tableMinWidth =
    FIXED_TABLE_MIN_WIDTH +
    activeOptionalColumns.length * OPTIONAL_COLUMN_MIN_WIDTH;

  const handleOpenDeleteDialog = (user: User) => {
    setDeleteCandidate(user);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeletingUser) return;
    setDeleteCandidate(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate || !onDeleteUser) {
      return;
    }

    setIsDeletingUser(true);
    try {
      await onDeleteUser(deleteCandidate.id);
      setDeleteCandidate(null);
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 2.5,
          flexWrap: "wrap",
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#212121" }}>
          List Of Users
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          <TextField
            size="small"
            placeholder="search By User Name"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            sx={{
              width: 240,
              "& .MuiOutlinedInput-root": {
                height: 31,
                borderRadius: "8px",
                fontSize: 12,
                bgcolor: "#FFFFFF",
                "& fieldset": { borderColor: "#E6E6E6" },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: "#B5B5B5" }} />
                </InputAdornment>
              ),
            }}
          />

          <Tooltip
            title={!canAddUsers ? addPermissionTooltip : ""}
            disableHoverListener={canAddUsers}
            disableFocusListener={canAddUsers}
            disableTouchListener={canAddUsers}
            placement="top"
          >
            <span>
              <Button
                variant="contained"
                onClick={onNewUser}
                disabled={!canAddUsers}
                startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
                className="mobile-add-button"
                sx={{
                  bgcolor: "#505050",
                  color: "#FFFFFF",
                  textTransform: "none",
                  borderRadius: "6px",
                  px: 2,
                  minWidth: 86,
                  height: 31,
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: "none",
                  "&:hover": { bgcolor: "#232323", boxShadow: "none" },
                }}
              >
                <span className="mobile-add-button-label">New</span>
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <TableContainer sx={{ overflowX: "auto", borderRadius: "8px" }}>
        <Table
          sx={{
            minWidth: tableMinWidth,
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <TableHead
            sx={{
              "& .MuiTableRow-root .MuiTableCell-head:first-of-type": {
                borderTopLeftRadius: "2px",
              },
              "& .MuiTableRow-root .MuiTableCell-head:last-of-type": {
                borderTopRightRadius: "2px",
              },
            }}
          >
            <TableRow>
              <TableCell sx={{ ...headerCellSx, minWidth: 170 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Typography
                    component="span"
                    sx={{ fontSize: 11, fontWeight: 600 }}
                  >
                    Username
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleSort("username")}
                    sx={{ p: 0.1 }}
                    aria-label="Sort by username"
                  >
                    {renderSortIcon("username")}
                  </IconButton>
                </Box>
              </TableCell>
              <TableCell sx={{ ...headerCellSx, minWidth: 180 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Typography
                    component="span"
                    sx={{ fontSize: 11, fontWeight: 600 }}
                  >
                    Name
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleSort("name")}
                    sx={{ p: 0.1 }}
                    aria-label="Sort by name"
                  >
                    {renderSortIcon("name")}
                  </IconButton>
                </Box>
              </TableCell>
              <TableCell sx={{ ...headerCellSx, minWidth: 120 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Typography
                    component="span"
                    sx={{ fontSize: 11, fontWeight: 600 }}
                  >
                    Role
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleSort("role")}
                    sx={{ p: 0.1 }}
                    aria-label="Sort by role"
                  >
                    {renderSortIcon("role")}
                  </IconButton>
                </Box>
              </TableCell>
              {activeOptionalColumns.map((column) => (
                <TableCell
                  key={column.key}
                  sx={{ ...headerCellSx, minWidth: OPTIONAL_COLUMN_MIN_WIDTH }}
                >
                  {column.label}
                </TableCell>
              ))}
              <TableCell sx={{ ...headerCellSx, minWidth: 90 }}>
                Status
              </TableCell>
              <TableCell sx={{ ...headerCellSx, minWidth: 88 }} align="right">
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <IconButton
                    onClick={handleOpenColumnPicker}
                    size="small"
                    sx={{ p: 0 }}
                    aria-label="Configure visible columns"
                  >
                    <EditActionIcon alt="Configure columns" />
                  </IconButton>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedUsers.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell sx={{ ...bodyCellSx, minWidth: 170 }}>
                  {user.username}
                </TableCell>
                <TableCell
                  sx={{ ...bodyCellSx, minWidth: 180 }}
                >{`${user.firstName} ${user.lastName}`}</TableCell>
                <TableCell sx={{ ...bodyCellSx, minWidth: 120 }}>
                  {user.role}
                </TableCell>
                {activeOptionalColumns.map((column) => (
                  <TableCell
                    key={`${user.id}-${column.key}`}
                    sx={{ ...bodyCellSx, minWidth: OPTIONAL_COLUMN_MIN_WIDTH }}
                  >
                    {column.getValue(user)}
                  </TableCell>
                ))}
                <TableCell sx={{ ...bodyCellSx, minWidth: 90 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Checkbox
                      checked={user.status}
                      onChange={() => onToggleUserStatus(user.id)}
                      disabled={isLoading || !canEditUsers}
                      icon={checkboxIcon}
                      checkedIcon={checkedCheckboxIcon}
                      sx={checkboxSx}
                      inputProps={{
                        "aria-label": `Toggle status for ${user.username}`,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: user.status ? "#3F7D4A" : "#8A8A8A",
                      }}
                    >
                      {user.status ? "Active" : "Inactive"}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ ...bodyCellSx, minWidth: 88 }} align="right">
                  <Box
                    sx={{ display: "flex", justifyContent: "flex-end", gap: 0.6 }}
                  >
                    <Tooltip
                      title={!canEditUsers ? editPermissionTooltip : ""}
                      disableHoverListener={canEditUsers}
                      disableFocusListener={canEditUsers}
                      disableTouchListener={canEditUsers}
                      placement="top"
                    >
                      <span>
                        <Button
                          onClick={() => onEditUser?.(user)}
                          disabled={!canEditUsers}
                          sx={{
                            minWidth: "auto",
                            p: 0,
                            opacity: canEditUsers ? 1 : 0.45,
                          }}
                        >
                          <EditActionIcon />
                        </Button>
                      </span>
                    </Tooltip>

                    <Tooltip
                      title={!canDeleteUsers ? deletePermissionTooltip : ""}
                      disableHoverListener={canDeleteUsers}
                      disableFocusListener={canDeleteUsers}
                      disableTouchListener={canDeleteUsers}
                      placement="top"
                    >
                      <span>
                        <Button
                          onClick={() => handleOpenDeleteDialog(user)}
                          disabled={!canDeleteUsers || !onDeleteUser}
                          sx={{
                            minWidth: "auto",
                            p: 0,
                            color: "#D55252",
                            opacity: canDeleteUsers ? 1 : 0.45,
                          }}
                          aria-label={`Delete ${user.username}`}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}

            {paginatedUsers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5 + activeOptionalColumns.length}
                  sx={{ ...bodyCellSx, textAlign: "center", py: 4 }}
                >
                  {isLoading
                    ? "Loading users..."
                    : !canViewUsers
                      ? "No view permission for users."
                      : "No users found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(deleteCandidate)}
        onClose={handleCloseDeleteDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 18, fontWeight: 700, pb: 1 }}>
          Delete User
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: "#4A4A4A" }}>
            {deleteCandidate
              ? `Are you sure you want to delete ${deleteCandidate.username}?`
              : "Are you sure you want to delete this user?"}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseDeleteDialog}
            disabled={isDeletingUser}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleConfirmDelete();
            }}
            variant="contained"
            color="error"
            disabled={isDeletingUser}
            sx={{ textTransform: "none" }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Popover
        open={isColumnPickerOpen}
        anchorEl={columnPickerAnchor}
        onClose={handleCloseColumnPicker}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 2, minWidth: 220 }}>
          <Typography
            sx={{ fontSize: 12, fontWeight: 700, color: "#3F3F3F", mb: 1.2 }}
          >
            Select Columns
          </Typography>
          <Typography sx={{ fontSize: 11, color: "#8A8A8A", mb: 1.2 }}>
            Fixed: Username, Name, Role, Status
          </Typography>
          {OPTIONAL_COLUMNS.map((column) => (
            <Box
              key={column.key}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: 0.2,
              }}
            >
              <Typography sx={{ fontSize: 12, color: "#4A4A4A" }}>
                {column.label}
              </Typography>
              <Checkbox
                size="small"
                checked={visibleOptionalColumns[column.key]}
                onChange={() => handleToggleOptionalColumn(column.key)}
                inputProps={{ "aria-label": `Toggle ${column.label} column` }}
              />
            </Box>
          ))}
        </Box>
      </Popover>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mt: 6,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography sx={{ fontSize: 12, color: "#9A9A9A" }}>
          {`Showing ${showingFrom} to ${showingTo} of ${sortedUsers.length} entries`}
        </Typography>

        <Pagination
          size="small"
          count={pageCount}
          page={safePage}
          onChange={(_, value) => setPage(value)}
          shape="rounded"
          siblingCount={1}
          boundaryCount={1}
          renderItem={(item) => (
            <PaginationItem
              slots={{ previous: ChevronLeftIcon, next: ChevronRightIcon }}
              {...item}
            />
          )}
          sx={{
            "& .MuiPagination-ul": { gap: 0.5 },
            "& .MuiPaginationItem-root": {
              minWidth: 28,
              height: 28,
              fontSize: 12,
              color: "#8A8F98",
              borderRadius: "8px",
              margin: 0,
            },
            "& .MuiPaginationItem-page.Mui-selected": {
              bgcolor: "#707070",
              color: "#FFFFFF",
              fontWeight: 700,
            },
            "& .MuiPaginationItem-page.Mui-selected:hover": {
              bgcolor: "#707070",
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default UsersList;
