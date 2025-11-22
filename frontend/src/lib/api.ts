import axios from "axios";

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
    result: string[];
    timestamp: string;
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
    extractDrugNamesFromImage: async (
        file: File
    ): Promise<DrugNamesFromImageResponse> => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await api.post<DrugNamesFromImageResponse>(
            "/drug-name-extract/upload",
            formData,
            {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            }
        );
        return response.data;
    },
};

export default api;
