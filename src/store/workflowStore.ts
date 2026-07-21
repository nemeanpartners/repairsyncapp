import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkflowState {
  isTechMode: boolean;
  toggleTechMode: () => void;
  setTechMode: (val: boolean) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      isTechMode: false,
      toggleTechMode: () => set((state) => ({ isTechMode: !state.isTechMode })),
      setTechMode: (val) => set({ isTechMode: val })
    }),
    {
      name: 'repairSync_workflowState', // unique name
    }
  )
);
