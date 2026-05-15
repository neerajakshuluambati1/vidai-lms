import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
	Box,
	Button,
	IconButton,
	Paper,
	Stack,
	Typography,
	CircularProgress,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
	pipelineApi,
	type PipelineIndustryType,
} from "../../services/pipeline.api";
import type { AppDispatch } from "../../store";
import { selectClinic } from "../../store/clinicSlice";
import { selectUser } from "../../store/authSlice";
import {
	hasAnySubcategoryActionPermission,
	resolveUserRole,
} from "../../utils/roleAccess";
import {
	createPipeline,
	createPipelineStage,
	fetchPipelineDetail,
	fetchPipelines,
	selectPipelineError,
	selectPipelineLoading,
	selectPipelines,
	selectSelectedPipeline,
	updatePipelineStage,
} from "../../store/pipelineSlice";
import CreateNewPipeline from "./CreateNewPipeline";
import SalesPipeLineData from "./SalesPipeLineData";
import SalesPipelineActionConfirmDialog from "./SalesPipelineActionConfirmDialog";
import SalesPipelineSidebar from "./SalesPipelineSidebar";
import type { StageConfigPayload } from "./StageConfiguration";
import {
	isAlphabeticName,
	mapActionsToRules,
	mapDataCaptureToFields,
	normalizeNameForCompare,
	normalizeEntryRule,
	normalizeStageStatus,
	normalizeStageType,
	STAGE_TYPE_SEQUENCE,
} from "./salesPipeline.utils";

const STORAGE_KEY_SELECTED_INDUSTRY = "leads_selected_industry";
const STORAGE_KEY_SELECTED_PIPELINE = "leads_selected_pipeline_id";
const STORAGE_KEY_DEFAULT_PIPELINE = "leads_default_pipeline_id";

const SalesPipelineDashboard = () => {
	const MAX_STAGE_NAME_LENGTH = 50;
	const theme = useTheme();
	const dispatch = useDispatch<AppDispatch>();
	const clinic = useSelector(selectClinic);
	const user = useSelector(selectUser);
	const authUser = user as unknown as Record<string, unknown> | null;
	const role = resolveUserRole(authUser);
	const permissions = authUser?.permissions;
	const pipelineAliases = ["sales pipeline configuration", "pipeline", "sales pipeline"];
	const canViewPipeline =
		role === "super_admin" ||
		hasAnySubcategoryActionPermission(permissions, pipelineAliases, "view") ||
		hasAnySubcategoryActionPermission(permissions, pipelineAliases, "print");
	const canEditPipeline =
		role === "super_admin" ||
		hasAnySubcategoryActionPermission(permissions, pipelineAliases, "add") ||
		hasAnySubcategoryActionPermission(permissions, pipelineAliases, "edit");
	const pipelines = useSelector(selectPipelines);
	const selectedPipeline = useSelector(selectSelectedPipeline);
	const pipelineLoading = useSelector(selectPipelineLoading);
	const pipelineError = useSelector(selectPipelineError);
	const selectedPipelineId = selectedPipeline?.id ?? null;
<<<<<<< Updated upstream
	const [defaultPipelineId, setDefaultPipelineId] = useState<string>(
		localStorage.getItem(STORAGE_KEY_DEFAULT_PIPELINE) ?? "",
=======
	const activePipeline = pipelines.find((pipeline) => pipeline.is_active) ?? null;
	const effectiveClinicId = Number(
		localStorage.getItem("clinic_id") ?? clinic?.id ?? 0,
>>>>>>> Stashed changes
	);

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [editPipelineData, setEditPipelineData] = useState<{ id: string; pipelineName: string; industry: string } | null>(null);
	const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(
		null,
	);
	const [actionMenuPipelineId, setActionMenuPipelineId] = useState<string | null>(
		null,
	);
	const [confirmAction, setConfirmAction] = useState<"archive" | "delete" | null>(null);
	const [confirmPipelineId, setConfirmPipelineId] = useState<string | null>(null);
	const [stageConfirmAction, setStageConfirmAction] = useState<"archive" | "delete" | null>(null);
	const [confirmStageIndex, setConfirmStageIndex] = useState<number | null>(null);
	const [actionInProgress, setActionInProgress] = useState(false);
	const [stageColorOverrides, setStageColorOverrides] = useState<Record<string, string>>({});
	const [zoomPercent, setZoomPercent] = useState(100);

	const chipBackgrounds = [
		alpha(theme.palette.primary.main, 0.14),
		alpha(theme.palette.warning.main, 0.16),
		alpha(theme.palette.info.main, 0.16),
		alpha(theme.palette.success.main, 0.16),
		alpha(theme.palette.secondary.main, 0.16),
		alpha(theme.palette.grey[500], 0.2),
	];

	useEffect(() => {
		if (!canViewPipeline) return;
		if (!effectiveClinicId) return;
		dispatch(fetchPipelines(effectiveClinicId));
	}, [canViewPipeline, dispatch, effectiveClinicId]);

	useEffect(() => {
		if (!canViewPipeline) return;
		if (pipelineLoading || selectedPipeline || pipelines.length === 0) return;
		const preferredPipeline =
<<<<<<< Updated upstream
			pipelines.find((pipeline) => pipeline.id === defaultPipelineId) ??
			pipelines.find((pipeline) => pipeline.is_active) ??
			pipelines[0];
		dispatch(fetchPipelineDetail(preferredPipeline.id));
	}, [canViewPipeline, defaultPipelineId, dispatch, pipelineLoading, pipelines, selectedPipeline]);

	useEffect(() => {
		if (defaultPipelineId) {
			localStorage.setItem(STORAGE_KEY_DEFAULT_PIPELINE, defaultPipelineId);
		}
	}, [defaultPipelineId]);
=======
			pipelines.find((pipeline) => pipeline.is_active) ?? pipelines[0];
		dispatch(fetchPipelineDetail(preferredPipeline.id));
	}, [canViewPipeline, dispatch, pipelineLoading, pipelines, selectedPipeline]);
>>>>>>> Stashed changes

	useEffect(() => {
		if (!actionMenuAnchor) return;
		if (!actionMenuAnchor.isConnected || !document.body.contains(actionMenuAnchor)) {
			setActionMenuAnchor(null);
			setActionMenuPipelineId(null);
		}
	}, [actionMenuAnchor, pipelines]);

	useEffect(() => {
		setStageColorOverrides({});
	}, [selectedPipelineId]);

	const handleZoomOut = () => {
		setZoomPercent((previous) => Math.max(50, previous - 10));
	};

	const handleZoomIn = () => {
		setZoomPercent((previous) => Math.min(200, previous + 10));
	};

	const handleCreatePipelineSave = async ({
		pipelineName,
		industry,
	}: {
		pipelineName: string;
		industry: string;
	}): Promise<boolean> => {
		if (!canEditPipeline) return false;
		if (!effectiveClinicId) return false;

		const trimmedPipelineName = pipelineName.trim();
		const isSingleLetterPipelineName =
			trimmedPipelineName.length === 1 && /^[A-Za-z]$/.test(trimmedPipelineName);
		const isEditing = Boolean(editPipelineData);
		const isNameChanged =
			!isEditing ||
			normalizeNameForCompare(trimmedPipelineName) !==
				normalizeNameForCompare(editPipelineData?.pipelineName ?? "");

		if (isNameChanged && isSingleLetterPipelineName) {
			toast.error("Pipeline name cannot be a single letter.");
			return false;
		}

		if (isNameChanged && !isAlphabeticName(trimmedPipelineName)) {
			toast.error("Pipeline name can contain only letters and spaces.");
			return false;
		}

		const normalizedName = normalizeNameForCompare(trimmedPipelineName);
		const duplicatePipeline = pipelines.some((pipeline) => {
			const isSameIndustry = pipeline.industry_type === industry;
			const isSameName = normalizeNameForCompare(pipeline.pipeline_name) === normalizedName;
			if (!isSameIndustry || !isSameName) return false;
			if (editPipelineData) {
				return pipeline.id !== editPipelineData.id;
			}
			return true;
		});

		if (duplicatePipeline) {
			toast.error("A pipeline with this name already exists for the selected industry.");
			return false;
		}

		if (editPipelineData) {
			try {
				setActionInProgress(true);
				await pipelineApi.update(editPipelineData.id, {
					pipeline_name: trimmedPipelineName,
					industry_type: industry as PipelineIndustryType,
<<<<<<< Updated upstream
				}, clinic.id);
=======
				});
>>>>>>> Stashed changes
				await refreshPipelines();
				if (selectedPipelineId === editPipelineData.id) {
					await dispatch(fetchPipelineDetail(editPipelineData.id));
				}
				toast.success("Pipeline updated successfully.");
				return true;
			} catch {
				toast.error("Failed to update pipeline.");
				return false;
			} finally {
				setActionInProgress(false);
				setEditPipelineData(null);
			}
		} else {
			try {
				setActionInProgress(true);
				const createdPipeline = await dispatch(
					createPipeline({
						clinic_id: effectiveClinicId,
						pipeline_name: trimmedPipelineName,
						industry_type: industry as PipelineIndustryType,
					}),
				).unwrap();
				await pipelineApi.setActivePipelineForClinic(effectiveClinicId, createdPipeline.id);
				await refreshPipelines();
				await dispatch(fetchPipelineDetail(createdPipeline.id));
				toast.success("Pipeline created successfully.");
				return true;
			} catch {
				toast.error("Failed to create pipeline.");
				return false;
			} finally {
				setActionInProgress(false);
			}
		}
	};

	const handleOpenCreatePipeline = () => {
		if (!canEditPipeline) return;
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
		setEditPipelineData(null);
		setIsCreateModalOpen(true);
	};

	const handleOpenActionMenu = (
		event: React.MouseEvent<HTMLElement>,
		pipelineId: string,
	) => {
		if (!canEditPipeline) return;
		event.stopPropagation();
		setActionMenuPipelineId(pipelineId);
		setActionMenuAnchor(event.currentTarget);
	};

	const handleCloseActionMenu = () => {
		if (actionInProgress) return;
		setActionMenuAnchor(null);
		setActionMenuPipelineId(null);
	};

	const refreshPipelines = async () => {
		if (!effectiveClinicId) return;
		await dispatch(fetchPipelines(effectiveClinicId));
	};

	const handleSelectPipeline = async (pipelineId: string) => {
		if (!canViewPipeline) return;
		if (!effectiveClinicId) {
			await dispatch(fetchPipelineDetail(pipelineId));
			return;
		}

		try {
			setActionInProgress(true);
			await dispatch(fetchPipelineDetail(pipelineId));
			await pipelineApi.setActivePipelineForClinic(effectiveClinicId, pipelineId);
			await refreshPipelines();
			await dispatch(fetchPipelineDetail(pipelineId));
			toast.success("Active pipeline updated.");
		} catch {
			toast.error("Failed to update active pipeline.");
		} finally {
			setActionInProgress(false);
		}
	};

	const handleSelectPipeline = async (pipelineId: string) => {
		if (!canViewPipeline) return;
		if (!clinic?.id) {
			await dispatch(fetchPipelineDetail(pipelineId));
			return;
		}

		const targetPipeline = pipelines.find((pipeline) => pipeline.id === pipelineId) ?? null;

		try {
			setActionInProgress(true);
			await dispatch(fetchPipelineDetail(pipelineId));
			await refreshPipelines();
			await dispatch(fetchPipelineDetail(pipelineId));
			toast.success("Default pipeline updated.");

			const industryToPersist = targetPipeline?.industry_type ?? "";
			if (industryToPersist) {
				localStorage.setItem(STORAGE_KEY_SELECTED_INDUSTRY, industryToPersist);
			}
			localStorage.setItem(STORAGE_KEY_SELECTED_PIPELINE, pipelineId);
			localStorage.setItem(STORAGE_KEY_DEFAULT_PIPELINE, pipelineId);
			setDefaultPipelineId(pipelineId);
		} catch {
			toast.error("Failed to set default pipeline.");
		} finally {
			setActionInProgress(false);
		}
	};

	const getActionPipeline = () => {
		if (!actionMenuPipelineId) return null;
		return pipelines.find((pipeline) => pipeline.id === actionMenuPipelineId) ?? null;
	};

	const handleEditPipeline = () => {
		if (!canEditPipeline) return;
		const pipeline = getActionPipeline();
		if (!pipeline) return;
		handleCloseActionMenu();
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
		setEditPipelineData({
			id: pipeline.id,
			pipelineName: pipeline.pipeline_name,
			industry: pipeline.industry_type,
		});
		window.setTimeout(() => {
			setIsCreateModalOpen(true);
		}, 0);
	};

	const handleDuplicatePipeline = async () => {
		if (!canEditPipeline) return;
		const pipeline = getActionPipeline();
		if (!pipeline) return;

		try {
			setActionInProgress(true);
			await pipelineApi.duplicate(pipeline.id);
			await refreshPipelines();
			toast.success("Pipeline duplicated successfully.");
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Failed to duplicate pipeline.";
			toast.error(errorMsg);
		} finally {
			setActionInProgress(false);
			handleCloseActionMenu();
		}
	};

	const handleArchivePipeline = () => {
		if (!canEditPipeline) return;
		const pipeline = getActionPipeline();
		if (!pipeline) return;
		setConfirmAction("archive");
		setConfirmPipelineId(pipeline.id);
		handleCloseActionMenu();
	};

	const handleDeletePipeline = () => {
		if (!canEditPipeline) return;
		const pipeline = getActionPipeline();
		if (!pipeline) return;
		setConfirmAction("delete");
		setConfirmPipelineId(pipeline.id);
		handleCloseActionMenu();
	};

	const handleCloseConfirmAction = () => {
		if (actionInProgress) return;
		setConfirmAction(null);
		setConfirmPipelineId(null);
	};

	const handleCloseStageConfirmAction = () => {
		if (actionInProgress) return;
		setStageConfirmAction(null);
		setConfirmStageIndex(null);
	};

	const handleConfirmPipelineAction = async () => {
		if (!canEditPipeline) return;
		if (!confirmAction || !confirmPipelineId) return;
		try {
			setActionInProgress(true);
			if (confirmAction === "archive") {
				await pipelineApi.archive(confirmPipelineId);
				toast.success("Pipeline archived successfully.");
			} else {
				await pipelineApi.remove(confirmPipelineId);
				toast.success("Pipeline deleted successfully.");
			}
			await refreshPipelines();
			if (selectedPipelineId === confirmPipelineId) {
				setConfirmPipelineId(null);
			}
		} catch {
			toast.error(
				confirmAction === "archive"
					? "Failed to archive pipeline."
					: "Failed to delete pipeline.",
			);
		} finally {
			setActionInProgress(false);
			handleCloseConfirmAction();
		}
	};

	const createStageByName = async (
		stageName: string,
		stageConfig?: StageConfigPayload,
	): Promise<boolean> => {
		if (!canEditPipeline) return false;
		if (!selectedPipelineId) return false;
		const trimmedStage = stageName.trim();
		const normalizedStageName = trimmedStage.replace(/\s+/g, " ");
		const isSingleLetterStageName =
			normalizedStageName.length === 1 && /^[A-Za-z]$/.test(normalizedStageName);
		if (isSingleLetterStageName) {
			toast.error("Stage name cannot be a single letter.");
			return false;
		}
		if (normalizedStageName.length > MAX_STAGE_NAME_LENGTH) {
			toast.error("Stage name cannot exceed 50 characters.");
			return false;
		}
		if (normalizedStageName && !isAlphabeticName(normalizedStageName)) {
			toast.error("Stage name can contain only letters and spaces.");
			return false;
		}

		const existingNames = new Set(
			(selectedPipeline?.stages ?? []).map((stage) => normalizeNameForCompare(stage.stage_name)),
		);
		let resolvedStageName = normalizedStageName;
		if (!resolvedStageName) {
			resolvedStageName = "New Stage";
			let suffix = 2;
			while (existingNames.has(normalizeNameForCompare(resolvedStageName))) {
				resolvedStageName = `New Stage ${suffix}`;
				suffix += 1;
			}
		}

		const nextStageType =
			STAGE_TYPE_SEQUENCE[
				Math.min(selectedPipeline?.stages.length ?? 0, STAGE_TYPE_SEQUENCE.length - 1)
			] ?? "lead";
		const nextStageOrder = (selectedPipeline?.stages.length ?? 0) + 1;

		const stageExists = selectedPipeline?.stages.some(
			(stage) => normalizeNameForCompare(stage.stage_name) === normalizeNameForCompare(resolvedStageName),
		);
		if (stageExists) {
			toast.error("Stage name already exists.");
			return false;
		}

		try {
			const createdStage = await dispatch(
				createPipelineStage({
					pipeline_id: selectedPipelineId,
					stage_name: resolvedStageName,
					stage_type: stageConfig?.stageType
						? normalizeStageType(stageConfig.stageType)
						: nextStageType,
					stage_status: normalizeStageStatus(stageConfig?.stageStatus),
					stage_order: nextStageOrder,
					entry_rule: normalizeEntryRule(stageConfig?.entryRule),
					stage_color: stageConfig?.colorCode,
					rules: stageConfig?.actions ? mapActionsToRules(stageConfig.actions) : undefined,
					fields: mapDataCaptureToFields(stageConfig?.dataCaptureFields),
				}),
			).unwrap();
			let newStageId = createdStage?.stage?.id ? String(createdStage.stage.id) : null;
			if (!newStageId || newStageId.startsWith("stage-")) {
				const refreshedPipeline = await dispatch(fetchPipelineDetail(selectedPipelineId)).unwrap();
				const matchedStage =
					refreshedPipeline.stages.find(
						(stage) =>
							stage.stage_order === nextStageOrder &&
							normalizeNameForCompare(stage.stage_name) ===
								normalizeNameForCompare(resolvedStageName),
					) ??
					refreshedPipeline.stages.find(
						(stage) =>
							normalizeNameForCompare(stage.stage_name) ===
							normalizeNameForCompare(resolvedStageName),
					) ??
					null;
				newStageId = matchedStage?.id ? String(matchedStage.id) : null;
			}
			if (newStageId) {
				const mappedRules = stageConfig?.actions ? mapActionsToRules(stageConfig.actions) : null;
				const mappedFields = mapDataCaptureToFields(stageConfig?.dataCaptureFields);
				await Promise.all([
					mappedRules ? pipelineApi.saveStageRules(newStageId, mappedRules) : Promise.resolve(),
					mappedFields.length > 0 ? pipelineApi.saveStageFields(newStageId, mappedFields) : Promise.resolve(),
				]);
			}
			if (stageConfig?.colorCode) {
				setStageColorOverrides((previous) => ({
					...previous,
					[resolvedStageName.toLowerCase()]: stageConfig.colorCode,
				}));
			}
			await dispatch(fetchPipelineDetail(selectedPipelineId));
			toast.success("Stage created successfully.");
			return true;
		} catch {
			toast.error("Failed to create stage.");
			return false;
		}
	};

	const resolveStageId = async (stageIndex: number): Promise<string | null> => {
		if (!selectedPipelineId || !selectedPipeline) return null;
		const currentStage = selectedPipeline.stages[stageIndex];
		if (!currentStage) return null;

		let currentStageId = String(currentStage.id ?? "").trim();
		if (currentStageId && !currentStageId.startsWith("stage-")) {
			return currentStageId;
		}

		try {
			const refreshedPipeline = await dispatch(fetchPipelineDetail(selectedPipelineId)).unwrap();
			const refreshedStage =
				refreshedPipeline.stages.find(
					(stage) =>
						stage.stage_order === currentStage.stage_order ||
						stage.stage_name.toLowerCase() === currentStage.stage_name.toLowerCase(),
				) ?? null;
			currentStageId = String(refreshedStage?.id ?? "").trim();
		} catch {
			currentStageId = "";
		}

		if (!currentStageId || currentStageId.startsWith("stage-")) {
			return null;
		}

		return currentStageId;
	};

	const handleOpenAddStage = async (
		stageName?: string,
		stageConfig?: StageConfigPayload,
	): Promise<boolean> => {
		if (!selectedPipelineId) return false;
		return createStageByName(stageName ?? "", stageConfig);
	};

	const handleReorderStages = async (fromIndex: number, toIndex: number) => {
		if (!canEditPipeline) return;
		if (!selectedPipelineId || !selectedPipeline || fromIndex === toIndex) return;
		if (
			fromIndex < 0 ||
			toIndex < 0 ||
			fromIndex >= selectedPipeline.stages.length ||
			toIndex >= selectedPipeline.stages.length
		) {
			return;
		}

		const nextStages = [...selectedPipeline.stages];
		const [movedStage] = nextStages.splice(fromIndex, 1);
		nextStages.splice(toIndex, 0, movedStage);

		for (const [index, stage] of nextStages.entries()) {
			const nextOrder = index + 1;
			if (stage.stage_order === nextOrder) continue;

			await dispatch(
				updatePipelineStage({
					pipelineId: selectedPipelineId,
					stageId: stage.id,
					payload: {
						stage_name: stage.stage_name,
						stage_type: stage.stage_type,
						stage_status: stage.stage_status,
						stage_order: nextOrder,
					},
				}),
			);
		}
	};

	const handleEditStage = async (
		stageIndex: number,
		updatedStageName: string,
		stageConfig?: StageConfigPayload,
	): Promise<boolean> => {
		if (!canEditPipeline) return false;
		if (!selectedPipelineId || !selectedPipeline) return false;
		if (stageIndex < 0 || stageIndex >= selectedPipeline.stages.length) return false;

		const trimmedStageName = updatedStageName.trim();
		const normalizedStageName = trimmedStageName.replace(/\s+/g, " ");
		const isSingleLetterStageName =
			normalizedStageName.length === 1 && /^[A-Za-z]$/.test(normalizedStageName);
		if (isSingleLetterStageName) {
			toast.error("Stage name cannot be a single letter.");
			return false;
		}
		if (normalizedStageName.length > MAX_STAGE_NAME_LENGTH) {
			toast.error("Stage name cannot exceed 50 characters.");
			return false;
		}
		if (normalizedStageName && !isAlphabeticName(normalizedStageName)) {
			toast.error("Stage name can contain only letters and spaces.");
			return false;
		}

		const currentStage = selectedPipeline.stages[stageIndex];
		const resolvedStageName = normalizedStageName || currentStage.stage_name;
		const currentStageId = await resolveStageId(stageIndex);

		if (!currentStageId) {
			toast.error("Stage update failed because backend stage id was not found.");
			return false;
		}
		const duplicateName = selectedPipeline.stages.some(
			(stage, index) =>
				index !== stageIndex &&
				normalizeNameForCompare(stage.stage_name) === normalizeNameForCompare(resolvedStageName),
		);
		if (duplicateName) {
			toast.error("Stage name already exists.");
			return false;
		}

		try {
			await dispatch(
				updatePipelineStage({
					pipelineId: selectedPipelineId,
					stageId: currentStageId,
					payload: {
						stage_name: resolvedStageName,
						stage_type: normalizeStageType(stageConfig?.stageType ?? currentStage.stage_type),
						stage_status: normalizeStageStatus(
							stageConfig?.stageStatus ?? currentStage.stage_status,
						),
						stage_order: currentStage.stage_order,
						stage_color: stageConfig?.colorCode ?? currentStage.stage_color,
						entry_rule: normalizeEntryRule(stageConfig?.entryRule ?? currentStage.entry_rule),
						rules: stageConfig?.actions ? mapActionsToRules(stageConfig.actions) : undefined,
						fields: mapDataCaptureToFields(stageConfig?.dataCaptureFields),
					},
				}),
			).unwrap();
			const mappedRules = stageConfig?.actions ? mapActionsToRules(stageConfig.actions) : null;
			const mappedFields = mapDataCaptureToFields(stageConfig?.dataCaptureFields);
			await Promise.all([
				mappedRules ? pipelineApi.saveStageRules(currentStageId, mappedRules) : Promise.resolve(),
				// Always call saveStageFields — even with an empty array — so deleted fields are cleared on the backend
				pipelineApi.saveStageFields(currentStageId, mappedFields),
			]);
			if (stageConfig?.colorCode) {
				setStageColorOverrides((previous) => ({
					...previous,
					[currentStageId]: stageConfig.colorCode,
					[resolvedStageName.toLowerCase()]: stageConfig.colorCode,
				}));
			}
			await dispatch(fetchPipelineDetail(selectedPipelineId));
			toast.success("Stage updated successfully.");
			return true;
		} catch {
			toast.error("Failed to update stage.");
			return false;
		}
	};

	const handleDuplicateStage = async (stageIndex: number): Promise<boolean> => {
		if (!canEditPipeline) return false;
		if (!selectedPipelineId || !selectedPipeline) return false;
		if (stageIndex < 0 || stageIndex >= selectedPipeline.stages.length) return false;

		const stageId = await resolveStageId(stageIndex);
		if (!stageId) {
			toast.error("Stage duplication failed because backend stage id was not found.");
			return false;
		}

		try {
			setActionInProgress(true);
			await pipelineApi.duplicateStage(stageId);
			await dispatch(fetchPipelineDetail(selectedPipelineId));
			toast.success("Stage duplicated successfully.");
			return true;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Failed to duplicate stage";
			toast.error(errorMsg);
			return false;
		} finally {
			setActionInProgress(false);
		}
	};

	const handleArchiveStageRequest = (stageIndex: number) => {
		if (!canEditPipeline) return;
		if (!selectedPipelineId || !selectedPipeline) return;
		if (stageIndex < 0 || stageIndex >= selectedPipeline.stages.length) return;

		setStageConfirmAction("archive");
		setConfirmStageIndex(stageIndex);
	};

	const handleDeleteStageRequest = (stageIndex: number) => {
		if (!canEditPipeline) return;
		if (!selectedPipelineId || !selectedPipeline) return;
		if (stageIndex < 0 || stageIndex >= selectedPipeline.stages.length) return;

		setStageConfirmAction("delete");
		setConfirmStageIndex(stageIndex);
	};

	const handleConfirmStageAction = async () => {
		if (!canEditPipeline || !selectedPipelineId || !selectedPipeline) return;
		if (!stageConfirmAction || confirmStageIndex === null) return;

		const stage = selectedPipeline.stages[confirmStageIndex];
		if (!stage) return;

		const resolvedStageId = await resolveStageId(confirmStageIndex);
		if (!resolvedStageId) {
			toast.error("Stage action failed because backend stage id was not found.");
			return;
		}

		try {
			setActionInProgress(true);
			if (stageConfirmAction === "archive") {
				await pipelineApi.archiveStage(resolvedStageId);
				toast.success("Stage archived successfully.");
			} else {
				await pipelineApi.removeStage(resolvedStageId);
				toast.success("Stage deleted successfully.");
			}

			setStageColorOverrides((previous) => {
				const next = { ...previous };
				delete next[resolvedStageId];
				delete next[stage.stage_name.toLowerCase()];
				return next;
			});
			await dispatch(fetchPipelineDetail(selectedPipelineId));
		} catch {
			toast.error(
				stageConfirmAction === "archive"
					? "Failed to archive stage."
					: "Failed to delete stage.",
			);
		} finally {
			setActionInProgress(false);
			handleCloseStageConfirmAction();
		}
	};

	return (
		<Box sx={{ p: 0.5, overflow: "hidden" }}>
			{!canViewPipeline ? (
				<Typography sx={{ color: "#B45309", mb: 1.5 }}>
					You do not have permission to view sales pipeline.
				</Typography>
			) : null}
			<Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
				Sales Pipeline Configuration
			</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2.25 }}>
				Configure how leads flow, convert, and generate metrics across your
				business
			</Typography>
			<Box
				sx={{
					display: "inline-flex",
					alignItems: "center",
					gap: 0.75,
					mb: 1.8,
					px: 1.25,
					py: 0.7,
					borderRadius: 1.5,
					border: `1px solid ${alpha(theme.palette.success.main, 0.35)}`,
					backgroundColor: alpha(theme.palette.success.main, 0.08),
				}}
			>
				<Typography sx={{ fontSize: 12, fontWeight: 700, color: theme.palette.success.dark }}>
					Active Pipeline:
				</Typography>
				<Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>
					{activePipeline?.pipeline_name ?? "Not configured"}
				</Typography>
			</Box>

			<Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ alignItems: "flex-start" }}>
				<SalesPipelineSidebar
					pipelines={pipelines}
					selectedPipelineId={selectedPipelineId}
					defaultPipelineId={defaultPipelineId}
					pipelineLoading={pipelineLoading}
					pipelineError={pipelineError}
					canEditPipeline={canEditPipeline}
					actionInProgress={actionInProgress}
					actionMenuAnchor={actionMenuAnchor}
					actionMenuPipelineId={actionMenuPipelineId}
					chipBackgrounds={chipBackgrounds}
					onOpenCreatePipeline={handleOpenCreatePipeline}
<<<<<<< Updated upstream
					onSelectPipeline={handleSelectPipeline}
=======
					onSelectPipeline={(pipelineId) => {
						void handleSelectPipeline(pipelineId);
					}}
>>>>>>> Stashed changes
					onOpenActionMenu={handleOpenActionMenu}
					onCloseActionMenu={handleCloseActionMenu}
					onEditPipeline={handleEditPipeline}
					onDuplicatePipeline={handleDuplicatePipeline}
					onArchivePipeline={handleArchivePipeline}
					onDeletePipeline={handleDeletePipeline}
				/>

				<Paper
					elevation={0}
					sx={{
						position: "relative",
						flex: 1,
						height: "74vh",
						borderRadius: 2,
						border: `1px solid ${theme.palette.grey[200]}`,
						backgroundColor: theme.palette.background.paper,
						backgroundImage: `radial-gradient(${alpha(
							theme.palette.grey[400],
							0.28,
						)} 0.8px, transparent 0.8px)`,
						backgroundSize: "16px 16px",
						overflow: "hidden",
					}}
				>
					<Box
						sx={{
							height: "100%",
							display: "flex",
							alignItems: "stretch",
							justifyContent: "flex-start",
							textAlign: "center",
							px: { xs: 1, sm: 2 },
							overflowX: "auto",
							overflowY: "hidden",
						}}
					>
						{selectedPipeline ? (
							<SalesPipeLineData
								stages={selectedPipeline.stages.map((stage) => ({
									id: stage.id,
									stageName: stage.stage_name,
									stageColor:
										stageColorOverrides[stage.id] ??
										stageColorOverrides[stage.stage_name.toLowerCase()] ??
										stage.stage_color,
									stageType: stage.stage_type,
									stageStatus: stage.stage_status,
									entryRule: stage.entry_rule,
									rules: stage.rules,
									fields: stage.fields,
								}))}
								canEditPipeline={canEditPipeline}
								onAddStage={handleOpenAddStage}
								onEditStage={handleEditStage}
								onDuplicateStage={handleDuplicateStage}
								onArchiveStage={handleArchiveStageRequest}
								onDeleteStage={handleDeleteStageRequest}
								onReorderStages={handleReorderStages}
								zoomPercent={zoomPercent}
							/>
						) : pipelineLoading ? (
							<CircularProgress size={28} />
						) : (
							<Box>
								<Typography variant="h6" sx={{ fontWeight: 700, mb: 0.65 }}>
									No Pipeline Data Found
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Create a new pipeline or Select a pipeline to see the stages
									from left sidebar.
								</Typography>
								<Button
									startIcon={<AddIcon fontSize="small" />}
									className="mobile-add-button"
									variant="outlined"
									onClick={handleOpenCreatePipeline}
									disabled={!canEditPipeline}
									sx={{
										mt: 1.5,
										borderRadius: 2,
										fontWeight: 700,
									}}
								>
									<span className="mobile-add-button-label">
										Create New Pipeline
									</span>
								</Button>
							</Box>
						)}
					</Box>

					<Box
						sx={{
							position: "absolute",
							left: 14,
							bottom: 14,
							display: "flex",
							alignItems: "center",
							gap: 0.5,
						}}
					>
						<IconButton
							size="small"
							onClick={handleZoomOut}
							sx={{
								width: 26,
								height: 26,
								border: `1px solid ${theme.palette.grey[300]}`,
								backgroundColor: theme.palette.background.paper,
							}}
						>
							<RemoveIcon fontSize="small" />
						</IconButton>
						<Box
							sx={{
								px: 1,
								py: 0.3,
								fontSize: 12,
								fontWeight: 600,
								borderRadius: 1,
								border: `1px solid ${theme.palette.grey[300]}`,
								backgroundColor: theme.palette.background.paper,
							}}
						>
							{zoomPercent}%
						</Box>
						<IconButton
							size="small"
							onClick={handleZoomIn}
							sx={{
								width: 26,
								height: 26,
								border: `1px solid ${theme.palette.grey[300]}`,
								backgroundColor: theme.palette.background.paper,
							}}
						>
							<AddIcon fontSize="small" />
						</IconButton>
					</Box>
				</Paper>
			</Stack>

			<CreateNewPipeline
				key={editPipelineData?.id ?? "create"}
				open={isCreateModalOpen}
				onClose={() => {
					setIsCreateModalOpen(false);
					setEditPipelineData(null);
				}}
				onSave={handleCreatePipelineSave}
				mode={editPipelineData ? "edit" : "create"}
				initialPipelineName={editPipelineData?.pipelineName}
				initialIndustry={editPipelineData?.industry}
			/>

			<SalesPipelineActionConfirmDialog
				open={confirmAction !== null}
				action={confirmAction}
				entityLabel="Pipeline"
				actionInProgress={actionInProgress}
				onClose={handleCloseConfirmAction}
				onConfirm={handleConfirmPipelineAction}
			/>

			<SalesPipelineActionConfirmDialog
				open={stageConfirmAction !== null}
				action={stageConfirmAction}
				entityLabel="Stage"
				actionInProgress={actionInProgress}
				onClose={handleCloseStageConfirmAction}
				onConfirm={handleConfirmStageAction}
			/>
		</Box>
	);
};

export default SalesPipelineDashboard;
