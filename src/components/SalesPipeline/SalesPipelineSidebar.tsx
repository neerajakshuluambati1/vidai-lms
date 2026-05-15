import type { MouseEvent } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
	Box,
	Button,
	CircularProgress,
	IconButton,
	ListItemIcon,
	Menu,
	MenuItem,
	Paper,
	Stack,
	Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { Pipeline } from "../../services/pipeline.api";
import { INDUSTRY_LABEL_MAP } from "./salesPipeline.utils";

type SalesPipelineSidebarProps = {
	pipelines: Pipeline[];
	selectedPipelineId: string | null;
	defaultPipelineId: string;
	pipelineLoading: boolean;
	pipelineError: string | null;
	canEditPipeline: boolean;
	actionInProgress: boolean;
	actionMenuAnchor: HTMLElement | null;
	actionMenuPipelineId: string | null;
	chipBackgrounds: string[];
	onOpenCreatePipeline: () => void;
	onSelectPipeline: (pipelineId: string) => void;
	onOpenActionMenu: (event: MouseEvent<HTMLElement>, pipelineId: string) => void;
	onCloseActionMenu: () => void;
	onEditPipeline: () => void;
	onDuplicatePipeline: () => void;
	onArchivePipeline: () => void;
	onDeletePipeline: () => void;
};

const SalesPipelineSidebar = ({
	pipelines,
	selectedPipelineId,
	defaultPipelineId,
	pipelineLoading,
	pipelineError,
	canEditPipeline,
	actionInProgress,
	actionMenuAnchor,
	actionMenuPipelineId,
	chipBackgrounds,
	onOpenCreatePipeline,
	onSelectPipeline,
	onOpenActionMenu,
	onCloseActionMenu,
	onEditPipeline,
	onDuplicatePipeline,
	onArchivePipeline,
	onDeletePipeline,
}: SalesPipelineSidebarProps) => {
	const theme = useTheme();

	return (
		<Paper
			elevation={0}
			sx={{
				width: { xs: "100%", lg: 344 },
				flexShrink: 0,
				p: 1.25,
				borderRadius: 2,
				border: `1px solid ${theme.palette.grey[200]}`,
				backgroundColor: alpha(theme.palette.background.paper, 0.95),
				height: "74vh",
				display: "flex",
				flexDirection: "column",
				overflowY: "auto",
				overflowX: "hidden",
				scrollbarWidth: "thin",
				scrollbarColor: `${alpha(theme.palette.grey[500], 0.7)} ${alpha(theme.palette.grey[200], 0.45)}`,
				"&::-webkit-scrollbar": { width: 8 },
				"&::-webkit-scrollbar-thumb": {
					backgroundColor: alpha(theme.palette.grey[500], 0.7),
					borderRadius: 999,
				},
				"&::-webkit-scrollbar-track": {
					backgroundColor: alpha(theme.palette.grey[200], 0.45),
					borderRadius: 999,
				},
			}}
		>
			<Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary", mb: 1.5 }}>
				Pipelines
			</Typography>

			<Button
				fullWidth
				startIcon={<AddIcon fontSize="small" />}
				className="mobile-add-button"
				variant="outlined"
				onClick={onOpenCreatePipeline}
				disabled={!canEditPipeline}
				sx={{
					justifyContent: "center",
					color: "text.primary",
					borderColor: theme.palette.grey[300],
					borderRadius: 2,
					fontWeight: 700,
					py: 1,
					mb: 1.75,
					backgroundColor: alpha(theme.palette.grey[200], 0.35),
					"&:hover": {
						borderColor: theme.palette.grey[400],
						backgroundColor: alpha(theme.palette.grey[200], 0.55),
					},
				}}
			>
				<span className="mobile-add-button-label">
					Create New Pipeline
				</span>
			</Button>

			<Stack spacing={1.2} sx={{ pr: 0.45 }}>
				{pipelineError ? (
					<Typography sx={{ fontSize: 13, color: theme.palette.error.main }}>
						{pipelineError}
					</Typography>
				) : null}

				{pipelineLoading && pipelines.length === 0 ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
						<CircularProgress size={26} />
					</Box>
				) : null}

				{pipelines.map((pipeline) => {
					const isSelected = selectedPipelineId === pipeline.id;
					const visibleStages = isSelected ? pipeline.stages : pipeline.stages.slice(0, 3);

					return (
						<Box
							key={pipeline.id}
							onClick={() => onSelectPipeline(pipeline.id)}
							sx={{
								border: `1px solid ${
									isSelected
										? alpha(theme.palette.primary.main, 0.45)
										: theme.palette.grey[200]
								}`,
								borderRadius: 2,
								backgroundColor: theme.palette.background.paper,
								cursor: "pointer",
								overflow: "hidden",
								transition: "all 0.2s ease",
								"&:hover": {
									borderColor: alpha(theme.palette.primary.main, 0.4),
								},
							}}
						>
							<Box
								sx={{
									px: 1.35,
									py: 1.05,
									borderBottom:
										pipeline.stages.length > 0
											? `1px solid ${theme.palette.grey[100]}`
											: "none",
									display: "flex",
									alignItems: "flex-start",
									justifyContent: "space-between",
									backgroundColor: isSelected
										? alpha(theme.palette.primary.main, 0.04)
										: "transparent",
								}}
							>
								<Box>
									<Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
										{pipeline.pipeline_name}
									</Typography>
<<<<<<< Updated upstream
									{defaultPipelineId === pipeline.id ? (
=======
									{pipeline.is_active ? (
>>>>>>> Stashed changes
										<Typography
											variant="caption"
											sx={{
												display: "inline-block",
												mt: 0.35,
												px: 0.7,
												py: 0.1,
												borderRadius: 999,
												fontSize: 10,
												fontWeight: 700,
												letterSpacing: 0.4,
												textTransform: "uppercase",
												color: "#166534",
												backgroundColor: "#DCFCE7",
											}}
										>
<<<<<<< Updated upstream
											Default
=======
											Active
>>>>>>> Stashed changes
										</Typography>
									) : null}
									<Typography
										variant="caption"
										sx={{
											display: "block",
											textTransform: "uppercase",
											color: "text.secondary",
											letterSpacing: 0.6,
										}}
									>
										{INDUSTRY_LABEL_MAP[pipeline.industry_type] ?? pipeline.industry_type}
									</Typography>
								</Box>

								<IconButton
									size="small"
									sx={{ mt: -0.25, mr: -0.75 }}
									onClick={(event) => onOpenActionMenu(event, pipeline.id)}
									disabled={!canEditPipeline}
								>
									<MoreVertIcon fontSize="small" />
								</IconButton>
							</Box>

							{pipeline.stages.length > 0 ? (
								<Box sx={{ pt: 1.2, px: 1.35, pb: isSelected ? 1.8 : 1.2 }}>
									<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignContent: "flex-start" }}>
										{visibleStages.map((stage, index) => (
											<Box
												key={stage.id}
												sx={{
													px: 1.05,
													py: 0.42,
													borderRadius: 999,
													fontSize: 12,
													fontWeight: 600,
													color: "text.primary",
													backgroundColor: chipBackgrounds[index % chipBackgrounds.length],
												}}
											>
												{stage.stage_name}
											</Box>
										))}
									</Box>
								</Box>
							) : (
								<Box
									sx={{
										px: 1.5,
										py: 1.15,
										fontSize: 13,
										fontWeight: 500,
										color: "text.secondary",
										textAlign: "center",
										borderTop: `1px solid ${theme.palette.grey[100]}`,
									}}
								>
									No stages defined
								</Box>
							)}
						</Box>
					);
				})}
			</Stack>

			<Menu
				anchorEl={actionMenuAnchor && actionMenuAnchor.isConnected ? actionMenuAnchor : null}
				open={Boolean(actionMenuPipelineId && actionMenuAnchor && actionMenuAnchor.isConnected)}
				onClose={onCloseActionMenu}
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				transformOrigin={{ vertical: "top", horizontal: "right" }}
				MenuListProps={{
					sx: {
						px: 0.5,
						py: 0.5,
					},
				}}
				PaperProps={{
					sx: {
						mt: 0.9,
						width: 130,
						height: 174.94541931152344,
						borderRadius: "12px",
						border: "1px solid #ECECEC",
						boxShadow: "0 16px 34px rgba(25, 35, 58, 0.14)",
						overflow: "hidden",
						opacity: 1,
					},
				}}
			>
				<MenuItem
					onClick={onEditPipeline}
					disabled={actionInProgress}
					sx={{
						minHeight: 42,
						px: 0.8,
						borderRadius: 1.5,
						fontSize: 12.5,
						fontWeight: 600,
						color: "#252525",
					}}
				>
					<ListItemIcon sx={{ minWidth: 28, color: "#5A88E8" }}>
						<EditOutlinedIcon sx={{ fontSize: 20 }} />
					</ListItemIcon>
					Edit
				</MenuItem>
				<MenuItem
					onClick={onDuplicatePipeline}
					disabled={actionInProgress}
					sx={{
						minHeight: 42,
						px: 0.8,
						borderRadius: 1.5,
						fontSize: 12.5,
						fontWeight: 600,
						color: "#252525",
					}}
				>
					<ListItemIcon sx={{ minWidth: 28, color: "#5A88E8" }}>
						<ContentCopyOutlinedIcon sx={{ fontSize: 20 }} />
					</ListItemIcon>
					Duplicate
				</MenuItem>
				<MenuItem
					onClick={onArchivePipeline}
					disabled={actionInProgress}
					sx={{
						minHeight: 42,
						px: 0.8,
						borderRadius: 1.5,
						fontSize: 12.5,
						fontWeight: 600,
						color: "#252525",
					}}
				>
					<ListItemIcon sx={{ minWidth: 28, color: "#5A88E8" }}>
						<ArchiveOutlinedIcon sx={{ fontSize: 20 }} />
					</ListItemIcon>
					Archive
				</MenuItem>
				<MenuItem
					onClick={onDeletePipeline}
					disabled={actionInProgress}
					sx={{
						minHeight: 42,
						px: 0.8,
						borderRadius: 1.5,
						fontSize: 12.5,
						fontWeight: 600,
						color: "#CC4343",
					}}
				>
					<ListItemIcon sx={{ minWidth: 28, color: "#CC4343" }}>
						<DeleteOutlineOutlinedIcon sx={{ fontSize: 20 }} />
					</ListItemIcon>
					Delete
				</MenuItem>
			</Menu>
		</Paper>
	);
};

export default SalesPipelineSidebar;
