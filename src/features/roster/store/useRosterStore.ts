import { create } from 'zustand';
import { Shift, Task, LeaveRequest } from '../types';

interface RosterState {
  shifts: Shift[];
  tasks: Task[];
  leaveRequests: LeaveRequest[];
  isLoading: boolean;
  setShifts: (shifts: Shift[]) => void;
  setTasks: (tasks: Task[]) => void;
  setLeaveRequests: (requests: LeaveRequest[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useRosterStore = create<RosterState>((set) => ({
  shifts: [],
  tasks: [],
  leaveRequests: [],
  isLoading: true,
  setShifts: (shifts) => set({ shifts }),
  setTasks: (tasks) => set({ tasks }),
  setLeaveRequests: (leaveRequests) => set({ leaveRequests }),
  setLoading: (isLoading) => set({ isLoading }),
}));
