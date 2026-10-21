import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { drugInteractionAPI } from "@/lib/api";

export interface InteractionCheckRecord {
  id: string;
  timestamp: string;
  drugs: string[];
  result: any; // Can be string or object with parsed_result
  summary?: string;
}

export interface DrugInCabinet {
  drug_name: string;
  interactions?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  // Tủ thuốc cá nhân - danh sách thuốc đã sử dụng với interactions
  personalMedicineCabinet?: DrugInCabinet[];
  // Interaction check history
  interactionHistory?: InteractionCheckRecord[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profile: Partial<User>) => void;
  addInteractionCheck: (drugs: string[], result: any) => void;
  addToMedicineCabinet: (drugs: string[]) => Promise<number>; // Returns number of new drugs added
  fetchMedicineCabinet: () => Promise<void>; // Fetch from API
  removeDrugFromCabinet: (drugName: string) => Promise<void>; // Remove drug from API
  clearMedicineCabinet: () => Promise<void>; // Clear all drugs from API
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email: string, _password: string) => {
        // Mock login - chỉ FE, chưa có API
        // Tạo user mới hoặc lấy từ localStorage
        const mockUser: User = {
          id: email, // Use email as user_id for API
          name: email.split("@")[0],
          email: email,
        };
        set({ user: mockUser, isAuthenticated: true });
        // Fetch medicine cabinet from API after login
        try {
          await useAuthStore.getState().fetchMedicineCabinet();
        } catch (error) {
          console.error("Error fetching medicine cabinet after login:", error);
        }
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
      updateProfile: (profile: Partial<User>) => {
        set((state) => {
          if (state.user) {
            return {
              user: { ...state.user, ...profile },
            };
          }
          return state;
        });
      },
      addInteractionCheck: (drugs: string[], result: any) => {
        set((state) => {
          if (state.user) {
            const newRecord: InteractionCheckRecord = {
              id: `check-${Date.now()}`,
              timestamp: new Date().toISOString(),
              drugs,
              result,
            };
            const history = state.user.interactionHistory || [];
            return {
              user: {
                ...state.user,
                interactionHistory: [newRecord, ...history].slice(0, 50), // Keep last 50 records
              },
            };
          }
          return state;
        });
      },
      addToMedicineCabinet: async (drugs: string[]) => {
        const state = useAuthStore.getState();
        if (!state.user) {
          return 0;
        }
        const userId = state.user.id;
        const currentDrugs = state.user.personalMedicineCabinet || [];
        const currentDrugNames = currentDrugs.map((d) => d.drug_name);
        const newDrugs = drugs.filter((drug) => !currentDrugNames.includes(drug));
        let newCount = 0;

        // Add each new drug to API
        for (const drug of newDrugs) {
          try {
            await drugInteractionAPI.addDrugToCabinet(drug, userId);
            newCount++;
          } catch (error) {
            console.error(`Error adding drug ${drug} to cabinet:`, error);
            // Continue with other drugs even if one fails
          }
        }

        // Refresh from API after adding
        if (newCount > 0) {
          await state.fetchMedicineCabinet();
        }

        return newCount;
      },
      fetchMedicineCabinet: async () => {
        const state = useAuthStore.getState();
        if (!state.user) return;

        try {
          const response = await drugInteractionAPI.getMedicineCabinet(state.user.id);
          // Map API response to DrugInCabinet format
          const drugs: DrugInCabinet[] = response.drugs.map((drug) => ({
            drug_name: drug.drug_name,
            interactions: drug.interactions,
          }));
          set((state) => {
            if (state.user) {
              return {
                user: {
                  ...state.user,
                  personalMedicineCabinet: drugs,
                },
              };
            }
            return state;
          });
        } catch (error) {
          console.error("Error fetching medicine cabinet:", error);
        }
      },
      removeDrugFromCabinet: async (drugName: string) => {
        const state = useAuthStore.getState();
        if (!state.user) return;

        try {
          await drugInteractionAPI.removeDrugFromCabinet(drugName, state.user.id);
          // Refresh from API after removing
          await state.fetchMedicineCabinet();
        } catch (error) {
          console.error("Error removing drug from cabinet:", error);
          throw error;
        }
      },
      clearMedicineCabinet: async () => {
        const state = useAuthStore.getState();
        if (!state.user) return;

        try {
          await drugInteractionAPI.clearMedicineCabinet(state.user.id);
          // Update local state
          set((state) => {
            if (state.user) {
              return {
                user: {
                  ...state.user,
                  personalMedicineCabinet: [],
                },
              };
            }
            return state;
          });
        } catch (error) {
          console.error("Error clearing medicine cabinet:", error);
          throw error;
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useAuthStore;
