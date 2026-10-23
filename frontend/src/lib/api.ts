import axios from "axios";
import type { InteractionReport, ProgressEvent } from "@/lib/report";

const api = axios.create({
  // baseURL: "http://localhost:8000",
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export interface DrugInteraction {
  drug: string;
  condition: string;
}

export interface QueryResponse {
  answer: string;
  timestamp: string;
}

export interface StatsResponse {
  drugs: number;
  interactions: number;
  sessions: number;
}

export interface DrugNamesFromImageResponse {
  /** Flat ingredient names (kept for older clients). */
  result: string[];
  /** The one product on the packaging, when its name is legible. */
  product_name?: string | null;
  ingredients?: { name: string; strength?: string }[];
  evidences?: { url: string; title: string; query: string }[];
  timestamp: string;
}

export interface ChatRequest {
  question: string;
  session_id?: string;
}

export interface ChatResponse {
  answer: string;
  session_id: string;
  timestamp: string;
}

// Medicine Cabinet APIs
export interface AddDrugRequest {
  drug_name: string;
  user_id: string;
}

export interface AddDrugResponse {
  message: string;
}

export interface DrugInCabinet {
  drug_name: string;
  interactions: string;
}

export interface MedicineCabinetListResponse {
  user_id: string;
  drugs: DrugInCabinet[];
  count: number;
  timestamp: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
}

export interface DrugInteractionsResponse {
  drug_name: string;
  user_id: string;
  interactions: DrugInteraction[];
}

export const drugInteractionAPI = {
  // Query for drug interactions
  query: async (question: string): Promise<QueryResponse> => {
    const response = await api.post<QueryResponse>("/query", { question });
    return response.data;
  },

  // Get statistics
  getStats: async (): Promise<StatsResponse> => {
    const response = await api.get<StatsResponse>("/stats");
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get("/health");
    return response.data;
  },

  // Extract drug names from image
  extractDrugNamesFromImage: async (file: File): Promise<DrugNamesFromImageResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<DrugNamesFromImageResponse>("/drug-name-extract/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Chat with session
  chat: async (question: string, sessionId?: string): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>("/chat", {
      question,
      session_id: sessionId,
    });
    return response.data;
  },

  // Medicine Cabinet APIs
  addDrugToCabinet: async (drugName: string, userId: string): Promise<AddDrugResponse> => {
    const response = await api.post<AddDrugResponse>("/medicine-cabinet/add", {
      drug_name: drugName,
      user_id: userId,
    });
    return response.data;
  },

  getMedicineCabinet: async (userId: string): Promise<MedicineCabinetListResponse> => {
    const response = await api.get<MedicineCabinetListResponse>("/medicine-cabinet/list", {
      params: { user_id: userId },
    });
    return response.data;
  },

  removeDrugFromCabinet: async (drugName: string, userId: string): Promise<string> => {
    const response = await api.delete<string>(`/medicine-cabinet/remove/${drugName}`, {
      params: { user_id: userId },
    });
    return response.data;
  },

  getDrugInteractions: async (drugName: string, userId: string): Promise<DrugInteractionsResponse> => {
    const response = await api.get<DrugInteractionsResponse>(`/medicine-cabinet/interactions/${drugName}`, {
      params: { user_id: userId },
    });
    return response.data;
  },

  clearMedicineCabinet: async (userId: string): Promise<string> => {
    const response = await api.delete<string>("/medicine-cabinet/clear", {
      params: { user_id: userId },
    });
    return response.data;
  },
};

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Parses a fetch body as Server-Sent Events, calling onEvent for each complete event. */
async function readSSE(body: ReadableStream<Uint8Array>, onEvent: (event: string, data: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length) onEvent(event, data.join("\n"));
    }
  }
}

/** A drug name, or a product (e.g. a supplement read from a photo) whose ingredients are checked as one drug. */
export type DrugInput = string | { name: string; ingredients: string[] };

export const v2API = {
  /** Runs the interaction agent and streams progress; resolves with the final report. */
  checkInteractions: async (
    drugs: DrugInput[],
    onProgress: (e: ProgressEvent) => void,
    signal?: AbortSignal,
  ): Promise<InteractionReport> => {
    const res = await fetch("/api/v2/interactions/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drugs }),
      signal,
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null);
      throw new ApiError(body?.error?.code ?? "HTTP", body?.error?.message ?? `Máy chủ trả lỗi ${res.status}`);
    }
    let report: InteractionReport | null = null;
    let error: ApiError | null = null;
    await readSSE(res.body, (event, data) => {
      const parsed = JSON.parse(data);
      if (event === "progress") onProgress(parsed as ProgressEvent);
      else if (event === "report") report = parsed as InteractionReport;
      else if (event === "error") error = new ApiError(parsed.error?.code ?? "UNKNOWN", parsed.error?.message ?? "Lỗi không xác định");
    });
    if (error) throw error;
    if (!report) throw new ApiError("AGENT_NO_REPORT", "Không nhận được kết quả từ máy chủ");
    return report;
  },

  chat: async (question: string, sessionId?: string): Promise<{ answer: string; session_id: string }> => {
    const response = await api.post<{ answer: string; session_id: string }>("/v2/chat", {
      question,
      ...(sessionId ? { session_id: sessionId } : {}),
    });
    return response.data;
  },
};

export default api;
