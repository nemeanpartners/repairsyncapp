export interface Shift {
  id: string;
  userId?: string;
  userName?: string;
  startTime: any;
  endTime: any;
  role: string;
  status: 'draft' | 'published' | 'assigned' | 'on_swap';
  isSwapRequested?: boolean;
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'completed';
  uid: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  startDate: any;
  endDate: any;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}
