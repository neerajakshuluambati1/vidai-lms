import { http } from "./http";

const storedClinicId = (): number =>
  Number(localStorage.getItem("clinic_id") ?? 0);

export type PipelineIndustryType =
  | "healthcare"
  | "ivf"
  | "pharma"
  | "diagnostics"
  | "corporate"
  | "education"
  | "saas"
  | "manufacturing"
  | "research"
  | "government"
  | "other";

export type PipelineStageType =
  | "lead"
  | "engagement"
  | "conversion"
  | "closure";

// Backend uses: "open" | "won" | "lost"
// Frontend previously used: "active" | "inactive"
// Both are now accepted everywhere.
export type PipelineStageStatus =
  | "active"
  | "inactive"
  | "open"
  | "won"
  | "lost";

export type PipelineRuleActionType =
  | "call"
  | "email"
  | "whatsapp"
  | "sms"
  | "appointment"
  | "custom";
export type PipelineFieldType = "text" | "number" | "date" | "dropdown";

export interface PipelineStageRule {
  id?: string;
  action_type: PipelineRuleActionType;
  custom_label?: string;
  is_enabled: boolean;
  is_required: boolean;
  auto_move: boolean;
  allow_manual_move: boolean;
}

export interface PipelineStageField {
  id?: string;
  field_name: string;
  field_type: PipelineFieldType;
  is_mandatory: boolean;
}

export interface PipelineStage {
  id: string;
  stage_name: string;
  stage_type: PipelineStageType;
  stage_status: PipelineStageStatus;
  stage_order: number;
  stage_color?: string;
  entry_rule?: "manual" | "auto";
  rules: PipelineStageRule[];
  fields: PipelineStageField[];
}

export interface Pipeline {
  id: string;
  clinic_id?: number;
  clinic?: number;
  pipeline_name: string;
  industry_type: PipelineIndustryType;
  is_active: boolean;
  stages: PipelineStage[];
}

export interface CreatePipelinePayload {
  clinic_id: number;
  pipeline_name: string;
  industry_type: PipelineIndustryType;
  is_active?: boolean;
}

export interface UpdatePipelinePayload {
  pipeline_name?: string;
  industry_type?: PipelineIndustryType;
  is_active?: boolean;
}

export interface CreatePipelineStagePayload {
  pipeline_id: string;
  stage_name: string;
  stage_type: PipelineStageType;
  stage_status?: PipelineStageStatus;
  stage_order?: number;
  stage_color?: string;
  entry_rule?: "manual" | "auto";
  rules?: PipelineStageRule[];
  fields?: PipelineStageField[];
}

export interface UpdatePipelineStagePayload {
  stage_name: string;
  stage_type: PipelineStageType;
  stage_status: PipelineStageStatus;
  stage_order: number;
  stage_color?: string;
  entry_rule?: "manual" | "auto";
  rules?: PipelineStageRule[];
  fields?: PipelineStageField[];
}

type StageMutationPayload =
  | CreatePipelineStagePayload
  | UpdatePipelineStagePayload;

type PipelineStageApiResponse = Partial<PipelineStage> & {
  id?: string;
  stage_id?: string | number;
  stage_uuid?: string;
  uuid?: string;
  pk?: string | number;
  stage_name?: string;
  stage_type?: PipelineStageType;
  stage_status?: PipelineStageStatus;
  stage_order?: number;
  stage_color?: string;
  color_code?: string;
  entry_rule?: "manual" | "auto";
  rules?: PipelineStageRule[];
  fields?: PipelineStageField[];
};

type PipelineApiResponse = Partial<Pipeline> & {
  id?: string;
  pipeline_name?: string;
  industry_type?: PipelineIndustryType;
  is_active?: boolean;
  clinic_id?: number;
  clinic?: number;
  stages?: PipelineStageApiResponse[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns true when a stage_status value should be treated as "active/visible".
 * Backend uses "open" for active stages; frontend historically used "active".
 * Both are accepted here so the filter works regardless of which value arrives.
 */
export const isActiveStageStatus = (status: string | undefined | null): boolean => {
  const s = (status ?? "").toLowerCase().trim();
  return s === "open" || s === "active";
};

const normalizeStage = (
  stage: PipelineStageApiResponse,
  index: number,
): PipelineStage => ({
  id: String(
    stage.id ??
      stage.stage_id ??
      stage.stage_uuid ??
      stage.uuid ??
      stage.pk ??
      `stage-${index}`,
  ),
  stage_name: stage.stage_name ?? "Untitled Stage",
  stage_type: stage.stage_type ?? "lead",
  // Preserve the exact value from the backend ("open", "won", "lost", "active", etc.)
  // so isActiveStageStatus() can match it correctly downstream.
  stage_status: stage.stage_status ?? "open",
  stage_order: stage.stage_order ?? index,
  stage_color: stage.stage_color ?? stage.color_code,
  entry_rule: stage.entry_rule,
  rules: Array.isArray(stage.rules) ? stage.rules : [],
  fields: Array.isArray(stage.fields) ? stage.fields : [],
});

const unwrapListData = (data: unknown): PipelineApiResponse[] => {
  if (Array.isArray(data)) return data as PipelineApiResponse[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as PipelineApiResponse[];
    if (Array.isArray(obj.data)) return obj.data as PipelineApiResponse[];
    if (Array.isArray(obj.pipelines))
      return obj.pipelines as PipelineApiResponse[];
  }
  return [];
};

const unwrapItemData = (data: unknown): PipelineApiResponse => {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
      return obj.data as PipelineApiResponse;
    }
    if (
      obj.pipeline &&
      typeof obj.pipeline === "object" &&
      !Array.isArray(obj.pipeline)
    ) {
      return obj.pipeline as PipelineApiResponse;
    }
  }
  return data as PipelineApiResponse;
};

const unwrapStageData = (data: unknown): PipelineStageApiResponse => {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
      return obj.data as PipelineStageApiResponse;
    }
    if (
      obj.stage &&
      typeof obj.stage === "object" &&
      !Array.isArray(obj.stage)
    ) {
      return obj.stage as PipelineStageApiResponse;
    }
  }
  return data as PipelineStageApiResponse;
};

const hasStageRelations = (payload: StageMutationPayload): boolean =>
  Array.isArray(payload.rules) || Array.isArray(payload.fields);

const stripStageRelations = <TPayload extends StageMutationPayload>(
  payload: TPayload,
): TPayload => {
  const rest = { ...payload } as StageMutationPayload;
  delete rest.rules;
  delete rest.fields;
  return rest as TPayload;
};

const shouldRetryWithoutRelations = (status?: number): boolean =>
  status === 400 || status === 422 || status === 500;

const removeRelationsForBackend = <TPayload extends StageMutationPayload>(
  payload: TPayload,
): Omit<TPayload, "rules" | "fields"> => {
  return stripStageRelations(payload) as Omit<TPayload, "rules" | "fields">;
};

const normalizePipeline = (pipeline: PipelineApiResponse): Pipeline => {
  const isValidStage = (stage: PipelineStageApiResponse): boolean => {
    if (!stage || typeof stage !== "object") return false;
    if (Object.keys(stage).length === 0) return false;
    return (
      stage.id != null ||
      stage.stage_id != null ||
      stage.stage_uuid != null ||
      stage.uuid != null ||
      stage.pk != null ||
      stage.stage_name != null ||
      stage.stage_type != null ||
      stage.stage_status != null
    );
  };

  const stages = Array.isArray(pipeline.stages)
    ? pipeline.stages
        .filter(isValidStage)
        .map((stage, index) => normalizeStage(stage, index))
    : [];

  return {
    id: String(pipeline.id ?? ""),
    clinic_id: pipeline.clinic_id,
    clinic: pipeline.clinic,
    pipeline_name: pipeline.pipeline_name ?? "Untitled Pipeline",
    industry_type: pipeline.industry_type ?? "other",
    is_active: pipeline.is_active ?? true,
    // Sort by stage_order ascending — backend Meta.ordering = ["stage_order"]
    // but we sort here too in case the response arrives unsorted.
    stages: stages.sort((a, b) => a.stage_order - b.stage_order),
  };
};

export const pipelineApi = {
  async list(clinicId: number): Promise<Pipeline[]> {
    const response = await http.get("/pipelines/", {
      params: { clinic_id: clinicId },
    });
    return unwrapListData(response.data).map(normalizePipeline);
  },

  async setActivePipelineForClinic(
    clinicId: number,
    activePipelineId: string,
  ): Promise<void> {
    const pipelines = await this.list(clinicId);
    const updates = pipelines
      .filter((pipeline) => {
        const shouldBeActive = pipeline.id === activePipelineId;
        return pipeline.is_active !== shouldBeActive;
      })
      .map((pipeline) =>
        this.update(pipeline.id, {
          is_active: pipeline.id === activePipelineId,
        }),
      );

    await Promise.all(updates);
  },

  async create(payload: CreatePipelinePayload): Promise<Pipeline> {
    const response = await http.post("/pipelines/create/", payload);
    return normalizePipeline(unwrapItemData(response.data));
  },

  async getById(pipelineId: string): Promise<Pipeline> {
    try {
      const response = await http.get(`/pipelines/${pipelineId}/`, {
        params: { clinic_id: storedClinicId() },
      });
      return normalizePipeline(unwrapItemData(response.data));
    } catch (error) {
      const candidate = error as { response?: { status?: number } };
      // Some backend deployments don't expose GET on /pipelines/{id}/
      if (candidate?.response?.status === 405) {
        const clinicId = storedClinicId();
        if (clinicId > 0) {
          const pipelines = await this.list(clinicId);
          const fallbackPipeline = pipelines.find((pipeline) => pipeline.id === pipelineId);
          if (fallbackPipeline) return fallbackPipeline;
        }
      }
      throw error;
    }
  },

  async update(
    pipelineId: string,
    payload: UpdatePipelinePayload,
    clinicId?: number,
  ): Promise<Pipeline> {
    const params = { clinic_id: clinicId ?? storedClinicId() };
    const attempts: Array<{ method: "put" | "patch"; url: string }> = [
      { method: "put", url: `/pipelines/${pipelineId}/` },
      { method: "patch", url: `/pipelines/${pipelineId}/` },
      { method: "put", url: `/pipelines/${pipelineId}/update/` },
      { method: "patch", url: `/pipelines/${pipelineId}/update/` },
    ];

    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        const response =
          attempt.method === "put"
            ? await http.put(attempt.url, payload, { params })
            : await http.patch(attempt.url, payload, { params });
        return normalizePipeline(unwrapItemData(response.data));
      } catch (error) {
        lastError = error;
        const candidate = error as {
          response?: { status?: number };
          code?: string;
          message?: string;
        };
        const status = candidate?.response?.status;
        const shouldTryNext =
          status === 404 ||
          status === 405 ||
          status === 500 ||
          candidate?.code === "ERR_NETWORK" ||
          candidate?.message?.includes("Parse Error") === true;
        if (!shouldTryNext) {
          throw error;
        }
      }
    }

    throw lastError;
  },

  async setActivePipelineForClinic(
    clinicId: number,
    activePipelineId: string,
  ): Promise<void> {
    const pipelines = await this.list(clinicId);
    const nextActive = pipelines.find((pipeline) => pipeline.id === activePipelineId) ?? null;
    if (!nextActive) return;

    await this.update(activePipelineId, { is_active: true }, clinicId);
  },

  async duplicate(pipelineId: string): Promise<Pipeline> {
    try {
      const response = await http.post(
        `/pipelines/${pipelineId}/duplicate/`,
        undefined,
        {
          params: { clinic_id: storedClinicId() },
        },
      );
      return normalizePipeline(unwrapItemData(response.data));
    } catch (error) {
      const candidate = error as { response?: { status?: number } };
      if (candidate?.response?.status === 404) {
        throw new Error(
          "Duplicate endpoint not yet implemented on the backend. Please contact support.",
        );
      }
      throw error;
    }
  },

  async archive(pipelineId: string): Promise<Pipeline> {
    try {
      const response = await http.post(
        `/pipelines/${pipelineId}/archive/`,
        undefined,
        {
          params: { clinic_id: storedClinicId() },
        },
      );
      return normalizePipeline(unwrapItemData(response.data));
    } catch (error) {
      const candidate = error as { response?: { status?: number } };
      if (candidate?.response?.status === 404) {
        throw new Error(
          "Archive endpoint not yet implemented on the backend. Please contact support.",
        );
      }
      throw error;
    }
  },

  async remove(pipelineId: string): Promise<void> {
    const clinicId = storedClinicId();
    const params = { clinic_id: clinicId };
    const wasDeleted = async (): Promise<boolean> => {
      if (!Number.isFinite(clinicId) || clinicId <= 0) return false;
      try {
        const pipelines = await this.list(clinicId);
        return !pipelines.some((pipeline) => pipeline.id === pipelineId);
      } catch {
        return false;
      }
    };

    try {
      await http.delete(`/pipelines/${pipelineId}/`, { params });
      return;
    } catch (restDeleteError) {
      const candidate = restDeleteError as {
        response?: { status?: number };
        code?: string;
        message?: string;
      };

      const shouldFallbackToActionDelete =
        candidate?.response?.status === 404 ||
        candidate?.response?.status === 405 ||
        candidate?.code === "ERR_NETWORK" ||
        candidate?.message?.includes("Parse Error") === true;

      if (shouldFallbackToActionDelete) {
        try {
          await http.post(`/pipelines/${pipelineId}/delete/`, undefined, {
            params,
          });
          return;
        } catch (actionDeleteError) {
          if (await wasDeleted()) {
            return;
          }
          throw actionDeleteError;
        }
      }

      if (await wasDeleted()) {
        return;
      }

      throw restDeleteError;
    }
  },

  async createStage(
    payload: CreatePipelineStagePayload,
  ): Promise<PipelineStage> {
    const convertColorCode = <TPayload extends object>(
      p: TPayload,
    ): Record<string, unknown> => {
      const result: Record<string, unknown> = {
        ...(p as Record<string, unknown>),
      };
      if ("stage_color" in result && result.stage_color) {
        result.color_code = result.stage_color;
        delete result.stage_color;
      }
      return result;
    };

    try {
      const converted = convertColorCode(payload);
      const response = await http.post("/pipelines/stages/create/", converted, {
        params: { clinic_id: storedClinicId() },
      });
      return normalizeStage(unwrapStageData(response.data), 0);
    } catch (error) {
      const candidate = error as {
        response?: { status?: number };
      };

      const fallbackPayload: CreatePipelineStagePayload & {
        pipeline?: string;
      } = {
        ...payload,
        pipeline: payload.pipeline_id,
        stage_status: payload.stage_status ?? "open",
      };

      if (candidate?.response?.status === 400) {
        try {
          const converted = convertColorCode(fallbackPayload);
          const response = await http.post(
            "/pipelines/stages/create/",
            converted,
            {
              params: { clinic_id: storedClinicId() },
            },
          );
          return normalizeStage(unwrapStageData(response.data), 0);
        } catch (fallbackError) {
          const fallbackStatus = (
            fallbackError as { response?: { status?: number } }
          )?.response?.status;

          if (
            !hasStageRelations(fallbackPayload) ||
            !shouldRetryWithoutRelations(fallbackStatus)
          ) {
            throw fallbackError;
          }

          const strippedFallbackPayload = stripStageRelations(fallbackPayload);
          const converted = convertColorCode(strippedFallbackPayload);
          const response = await http.post(
            "/pipelines/stages/create/",
            converted,
            {
              params: { clinic_id: storedClinicId() },
            },
          );
          return normalizeStage(unwrapStageData(response.data), 0);
        }
      }

      if (
        !hasStageRelations(payload) ||
        !shouldRetryWithoutRelations(candidate?.response?.status)
      ) {
        throw error;
      }

      const strippedPayload = stripStageRelations(payload);
      const converted = convertColorCode(strippedPayload);
      const response = await http.post("/pipelines/stages/create/", converted, {
        params: { clinic_id: storedClinicId() },
      });
      return normalizeStage(unwrapStageData(response.data), 0);
    }
  },

  async updateStage(
    stageId: string,
    payload: UpdatePipelineStagePayload,
  ): Promise<PipelineStage> {
    const convertColorCode = <TPayload extends object>(
      p: TPayload,
    ): Record<string, unknown> => {
      const result: Record<string, unknown> = {
        ...(p as Record<string, unknown>),
      };
      if ("stage_color" in result && result.stage_color) {
        result.color_code = result.stage_color;
        delete result.stage_color;
      }
      return result;
    };

    const stripOptionalFields = (p: UpdatePipelineStagePayload) => {
      const result = {
        stage_name: p.stage_name,
        stage_type: p.stage_type,
        stage_status: p.stage_status,
        stage_order: p.stage_order,
      } as Record<string, unknown>;
      if (p.stage_color) {
        result.color_code = p.stage_color;
      }
      return result;
    };

    const tryUpdate = async (
      method: "put" | "patch",
      url: string,
      data: unknown,
    ) => {
      const response =
        method === "put"
          ? await http.put(url, data, {
              params: { clinic_id: storedClinicId() },
            })
          : await http.patch(url, data, {
              params: { clinic_id: storedClinicId() },
            });
      return normalizeStage(
        unwrapStageData(response.data),
        payload.stage_order,
      );
    };

    try {
      const cleanPayload = removeRelationsForBackend(payload);
      const converted = convertColorCode(cleanPayload);
      return await tryUpdate("put", `/pipelines/stages/${stageId}/update/`, converted);
    } catch (error) {
      const candidate = error as { response?: { status?: number } };
      const status = candidate?.response?.status;

      if (status === 404 || status === 405) {
        try {
          const cleanPayload = removeRelationsForBackend(payload);
          const converted = convertColorCode(cleanPayload);
          return await tryUpdate("put", `/pipelines/stages/${stageId}/`, converted);
        } catch (fallbackError) {
          const fallbackStatus = (
            fallbackError as { response?: { status?: number } }
          )?.response?.status;
          if (fallbackStatus !== 404) {
            throw fallbackError;
          }
        }
      }

      try {
        const minimalPayload = stripOptionalFields(payload);
        return await tryUpdate(
          "patch",
          `/pipelines/stages/${stageId}/update/`,
          minimalPayload,
        );
      } catch (minimalError) {
        const minimalStatus = (
          minimalError as { response?: { status?: number } }
        )?.response?.status;
        if (minimalStatus === 404 || minimalStatus === 405) {
          try {
            const minimalPayload = stripOptionalFields(payload);
            return await tryUpdate(
              "patch",
              `/pipelines/stages/${stageId}/`,
              minimalPayload,
            );
          } catch {
            throw minimalError;
          }
        }
        throw minimalError;
      }
    }
  },

  async archiveStage(stageId: string): Promise<void> {
    try {
      await http.put(`/pipelines/stages/${stageId}/archive/`, undefined, {
        params: { clinic_id: storedClinicId() },
      });
    } catch (error) {
      const candidate = error as { response?: { status?: number } };
      if (candidate?.response?.status === 404) {
        throw new Error(
          "Archive endpoint not yet implemented on the backend. Please contact support.",
        );
      }
      throw error;
    }
  },

  async removeStage(stageId: string): Promise<void> {
    try {
      await http.delete(`/pipelines/stages/${stageId}/`, {
        params: { clinic_id: storedClinicId() },
      });
    } catch (error) {
      const candidate = error as {
        response?: { status?: number };
        code?: string;
        message?: string;
      };
      const shouldFallbackToActionDelete =
        candidate?.response?.status === 404 ||
        candidate?.response?.status === 405 ||
        candidate?.code === "ERR_NETWORK" ||
        candidate?.message?.includes("Parse Error") === true;

      if (shouldFallbackToActionDelete) {
        try {
          await http.post(`/pipelines/stages/${stageId}/delete/`, undefined, {
            params: { clinic_id: storedClinicId() },
          });
        } catch (fallbackError) {
          const fallbackStatus = (
            fallbackError as { response?: { status?: number } }
          )?.response?.status;
          if (fallbackStatus === 404) {
            throw new Error(
              "Delete endpoint not yet implemented on the backend. Please contact support.",
            );
          }
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  },

  async duplicateStage(stageId: string): Promise<PipelineStage> {
    try {
      const response = await http.post(
        `/pipelines/stages/${stageId}/duplicate/`,
        undefined,
        {
          params: { clinic_id: storedClinicId() },
        },
      );
      return normalizeStage(unwrapStageData(response.data), 0);
    } catch (error) {
      const candidate = error as { response?: { status?: number } };
      if (candidate?.response?.status === 404) {
        throw new Error(
          "Duplicate endpoint not yet implemented on the backend. Please contact support.",
        );
      }
      throw error;
    }
  },

  async saveStageRules(
    stageId: string,
    rules: PipelineStageRule[],
  ): Promise<void> {
    if (!stageId || String(stageId).startsWith("stage-")) {
      return;
    }

    await http.post(
      `/pipelines/stages/${stageId}/rules/`,
      { rules },
      {
        params: { clinic_id: storedClinicId() },
      },
    );
  },

  async saveStageFields(
    stageId: string,
    fields: PipelineStageField[],
  ): Promise<void> {
    if (!stageId || String(stageId).startsWith("stage-")) {
      return;
    }

    await http.post(
      `/pipelines/stages/${stageId}/fields/`,
      { fields },
      {
        params: { clinic_id: storedClinicId() },
      },
    );
  },
};