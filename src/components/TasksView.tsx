import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, CheckCircle2, Search, Plus, Trash2, Wrench, MessageSquare, 
  Star, Calendar, Sunrise, ListTodo, User, X, ChevronRight, Menu, Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { format, isToday, isFuture, isPast } from 'date-fns';

type Task = any;

import { db } from '../firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';

export interface TasksViewProps {
  tasks: Task[];
  user: any;
  createTask: (payload: any) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  customers: any[];
  fetchTickets: (customerId: string) => Promise<any[]>;
  setSelectedCustomer: (c: any) => void;
  setSelectedTicket: (t: any) => void;
  setTickets: (t: any[]) => void;
  handleNavigate: (v: string) => void;
  categories: any[];
  isLoadingCategories?: boolean;
  createCategory: (name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

type SmartListMode = string;

export function TasksView({
  tasks,
  user,
  createTask,
  updateTask,
  deleteTask,
  customers,
  fetchTickets,
  setSelectedCustomer,
  setSelectedTicket,
  setTickets,
  handleNavigate,
  categories = [],
  isLoadingCategories = false,
  createCategory,
  deleteCategory,
}: TasksViewProps) {
  const [activeList, setActiveList] = useState<SmartListMode>('my_day');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; display: string }[]>([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [quickAddCategory, setQuickAddCategory] = useState<string>("");

  useEffect(() => {
    if (!['my_day', 'important', 'planned', 'assigned', 'all'].includes(activeList)) {
      setQuickAddCategory(activeList);
    } else {
      setQuickAddCategory("");
    }
  }, [activeList]);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "!=", ""));
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map((doc) => ({
            id: doc.data().uid || '',
            display: doc.data().displayName || doc.id.split("@")[0],
          }))
          .filter(m => m.id !== ''); // only users who have logged in and got a UID
        setTeamMembers(data);
      } catch (error) {
        console.error("Error fetching team members:", error);
      }
    };
    fetchTeamMembers();
  }, []);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) || null, [tasks, selectedTaskId]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        (t.title || '').toLowerCase().includes(q) || 
        (t.description || '').toLowerCase().includes(q)
      );
    }

    // Smart List filter
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    switch (activeList) {
      case 'my_day':
        result = result.filter(t => t.dueDate === todayStr);
        break;
      case 'important':
        result = result.filter(t => t.priority === 'urgent' || t.priority === 'high');
        break;
      case 'planned':
        result = result.filter(t => t.dueDate && t.dueDate > todayStr);
        break;
      case 'assigned':
        result = result.filter(t => t.uid === user?.uid);
        break;
      case 'all':
        break;
      default:
        // Filter by dynamic category
        result = result.filter(t => t.category === activeList);
        break;
    }

    // Sort: open first, then by date, newer items closer
    return result.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'open' ? -1 : 1;
      }
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    });
  }, [tasks, activeList, searchQuery, user]);

  const openTasks = filteredTasks.filter(t => t.status === 'open');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');

  return (
    <section className="flex-1 flex flex-row min-h-0 relative bg-zinc-50 overflow-hidden w-full h-full text-zinc-900">
      
      {/* LEFT SIDEBAR (Smart Lists) */}
      <div className={`
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        absolute md:relative z-40 md:z-auto w-[260px] flex-shrink-0 border-r border-zinc-200 bg-zinc-50/90 backdrop-blur-md h-full flex flex-col transition-transform duration-300
      `}>
        <div className="p-4 pt-6 px-4 flex flex-col flex-1 min-h-0">
          <h2 className="text-xl font-bold tracking-tight mb-6 px-2 shrink-0">Tasks</h2>
          <div className="space-y-1 flex flex-col flex-1 min-h-0">
            <SidebarItem 
              icon={<Sunrise className="w-5 h-5" />} 
              label="My Day" 
              active={activeList === 'my_day'} 
              onClick={() => { setActiveList('my_day'); setIsMobileSidebarOpen(false); }} 
              count={tasks.filter(t => t.dueDate === format(new Date(), 'yyyy-MM-dd') && t.status === 'open').length}
              color="text-blue-500" 
            />
            <SidebarItem 
              icon={<Star className="w-5 h-5" />} 
              label="Important" 
              active={activeList === 'important'} 
              onClick={() => { setActiveList('important'); setIsMobileSidebarOpen(false); }} 
              count={tasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status === 'open').length}
              color="text-pink-500" 
            />
            <SidebarItem 
              icon={<Calendar className="w-5 h-5" />} 
              label="Planned" 
              active={activeList === 'planned'} 
              onClick={() => { setActiveList('planned'); setIsMobileSidebarOpen(false); }} 
              count={tasks.filter(t => t.dueDate && t.dueDate > format(new Date(), 'yyyy-MM-dd') && t.status === 'open').length}
              color="text-emerald-500" 
            />
            <SidebarItem 
              icon={<User className="w-5 h-5" />} 
              label="Assigned to me" 
              active={activeList === 'assigned'} 
              onClick={() => { setActiveList('assigned'); setIsMobileSidebarOpen(false); }} 
              count={tasks.filter(t => t.uid === user?.uid && t.status === 'open').length}
              color="text-purple-500" 
            />
            <div className="my-3 mx-4 border-t border-zinc-200" />
            <SidebarItem 
              icon={<ListTodo className="w-5 h-5" />} 
              label="Tasks" 
              active={activeList === 'all'} 
              onClick={() => { setActiveList('all'); setIsMobileSidebarOpen(false); }} 
              count={tasks.filter(t => t.status === 'open').length}
              color="text-zinc-500" 
            />

            <div className="my-3 mx-4 border-t border-zinc-200 shrink-0" />
            
            <div className="px-4 mb-2 flex items-center justify-between shrink-0">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Categories</span>
              <button 
                onClick={() => setIsCreatingCategory(true)}
                className="p-1 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 rounded transition-colors"
                title="Create Category"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {isCreatingCategory && (
              <div className="px-3 mb-3 shrink-0">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (newCategoryName.trim()) {
                      await createCategory(newCategoryName.trim());
                      setNewCategoryName("");
                      setIsCreatingCategory(false);
                    }
                  }}
                  className="flex gap-1 items-center"
                >
                  <Input
                    autoFocus
                    placeholder="New category..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-8 text-xs px-2 py-1 flex-1 bg-white border border-zinc-200 focus-visible:ring-1 focus-visible:ring-zinc-400"
                    onBlur={() => {
                      setTimeout(() => {
                        if (!newCategoryName.trim()) {
                          setIsCreatingCategory(false);
                        }
                      }, 200);
                    }}
                  />
                  <Button type="submit" size="sm" className="h-8 px-2 text-xs bg-zinc-800 hover:bg-zinc-900 text-white">
                    Save
                  </Button>
                </form>
              </div>
            )}

            <div className="space-y-0.5 px-2 mb-4 overflow-y-auto flex-1 min-h-0 ">
              {isLoadingCategories ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                </div>
              ) : categories.map((cat) => {
                const isActive = activeList === cat.id;
                const openCount = tasks.filter(t => t.category === cat.id && t.status === 'open').length;
                return (
                  <div key={cat.id} className="relative group/cat">
                    <button
                      onClick={() => {
                        setActiveList(cat.id);
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                        isActive ? 'bg-white shadow-sm border border-zinc-200/50 text-zinc-900 font-semibold' : 'hover:bg-zinc-200/50 text-zinc-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate max-w-[150px]">
                        <span className={`text-xs ${isActive ? 'text-blue-500 font-bold' : 'text-zinc-400'}`}>#</span>
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {openCount > 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-200 text-zinc-600'}`}>
                            {openCount}
                          </span>
                        )}
                        <span
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
                              await deleteCategory(cat.id);
                              if (activeList === cat.id) {
                                setActiveList('all');
                              }
                            }
                          }}
                          className="p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 rounded opacity-0 group-hover/cat:opacity-100 transition-opacity cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/20 z-30 md:hidden" 
          onClick={() => setIsMobileSidebarOpen(false)} 
        />
      )}

      {/* CENTER COLUMN (Task List) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex items-center gap-3 p-4 md:px-8 md:pt-8 md:pb-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight capitalize flex items-center gap-2 text-zinc-800">
              {['my_day', 'important', 'planned', 'assigned', 'all'].includes(activeList)
                ? activeList.replace('_', ' ')
                : (categories.find(c => c.id === activeList)?.name || 'Category')}
            </h1>
            <p className="text-sm text-zinc-500 mt-1 font-medium">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-8  min-h-0">
          <div className="max-w-3xl mx-auto pb-12 pt-4">
            
            {activeList !== 'all' ? (
              <>
                {/* Quick Add Task */}
                <div className="mb-6 bg-zinc-50 rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex items-center p-1.5 gap-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                  <div className="pl-2 opacity-50">
                    <Plus className="w-5 h-5 text-zinc-500" />
                  </div>
                  <Input
                    placeholder="Add a task"
                    className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-[15px] font-medium placeholder:text-zinc-500 h-10"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        const title = e.currentTarget.value.trim();
                        e.currentTarget.value = "";
                        
                        // Context-aware creation
                        let priority = "medium";
                        let dueDate = format(new Date(), 'yyyy-MM-dd'); // default to today for My Day
                        let category = quickAddCategory;

                        if (activeList === 'important') priority = 'high';
                        if (activeList === 'planned') {
                          const tmr = new Date();
                          tmr.setDate(tmr.getDate() + 1);
                          dueDate = format(tmr, 'yyyy-MM-dd');
                        }

                        await createTask({
                          title,
                          description: "",
                          priority,
                          status: "open",
                          dueDate,
                          category,
                          linkedCustomerId: "",
                          linkedTicketId: "",
                          linkedTicketNumber: "",
                          linkedConversationPhone: "",
                          uid: user?.uid,
                          userId: user?.uid,
                          userName: user?.displayName || user?.email || "Me",
                        });
                      }
                    }}
                  />
                  <div className="flex items-center gap-1.5 shrink-0 mr-1.5">
                    <span className="text-xs text-zinc-400 font-medium hidden sm:inline">Category:</span>
                    <select
                      className="text-xs bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg px-2 text-zinc-700 outline-none focus:ring-1 focus:ring-zinc-400 font-medium cursor-pointer transition-colors max-w-[120px] sm:max-w-[150px] truncate h-8"
                      value={quickAddCategory}
                      onChange={(e) => setQuickAddCategory(e.target.value)}
                    >
                      <option value="">None</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Incomplete Tasks */}
                <div className="space-y-1 mb-8">
                  {openTasks.map(task => (
                    <TaskRow 
                      key={task.id} 
                      task={task} 
                      selected={selectedTaskId === task.id}
                      onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                      onToggleStatus={() => updateTask(task.id, { status: 'completed' })}
                      onTogglePriority={() => updateTask(task.id, { priority: task.priority === 'urgent' || task.priority === 'high' ? 'medium' : 'high' })}
                      onDelete={() => {
                        deleteTask(task.id);
                        if (selectedTaskId === task.id) setSelectedTaskId(null);
                      }}
                      teamMembers={teamMembers}
                      user={user}
                      customers={customers}
                    />
                  ))}
                  {openTasks.length === 0 && (
                    <div className="py-8 text-center bg-zinc-50/50 rounded-xl border border-zinc-100 border-dashed">
                      <p className="text-zinc-400 text-sm">No tasks pending for this view.</p>
                    </div>
                  )}
                </div>

                {/* Completed Tasks */}
                {completedTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                      Completed
                      <div className="h-px bg-zinc-200 flex-1 ml-2" />
                    </h3>
                    <div className="space-y-1 opacity-70 transition-opacity hover:opacity-100">
                      {completedTasks.map(task => (
                        <TaskRow 
                          key={task.id} 
                          task={task} 
                          selected={selectedTaskId === task.id}
                          onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                          onToggleStatus={() => updateTask(task.id, { status: 'open' })}
                          onTogglePriority={() => updateTask(task.id, { priority: task.priority === 'urgent' || task.priority === 'high' ? 'medium' : 'high' })}
                          onDelete={() => {
                            deleteTask(task.id);
                            if (selectedTaskId === task.id) setSelectedTaskId(null);
                          }}
                          teamMembers={teamMembers}
                          user={user}
                          customers={customers}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // grouped by staff view
              <div className="space-y-10">
                {/* My Tasks Section */}
                <div>
                   <h2 className="text-xl font-bold text-zinc-800 mb-4 flex items-center gap-2 border-b border-zinc-200 pb-2">
                     <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-sm">Me</span>
                     My Tasks
                   </h2>
                   
                   {/* Quick Add Task for Me */}
                   <div className="mb-4 bg-zinc-50 rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col sm:flex-row sm:items-center p-1.5 pl-3 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all gap-2">
                     <Input
                       placeholder="Add a task to my list..."
                       className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-[15px] font-medium placeholder:text-zinc-500 h-10 px-0"
                       onKeyDown={async (e) => {
                         if (e.key === "Enter" && e.currentTarget.value.trim()) {
                           const title = e.currentTarget.value.trim();
                           e.currentTarget.value = "";
                           await createTask({
                             title,
                             description: "",
                             priority: "medium",
                             status: "open",
                             dueDate: format(new Date(), 'yyyy-MM-dd'),
                             category: "",
                             uid: user?.uid,
                             userId: user?.uid,
                             userName: user?.displayName || user?.email || "Me",
                           });
                         }
                       }}
                     />
                     <Button size="sm" variant="ghost" className="sm:inline-flex hidden h-8 px-3 text-zinc-400">Enter to add</Button>
                   </div>

                   <div className="space-y-1">
                     {openTasks.filter(t => t.uid === user?.uid).map(task => (
                       <TaskRow 
                          key={task.id} 
                          task={task} 
                          selected={selectedTaskId === task.id}
                          onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                          onToggleStatus={() => updateTask(task.id, { status: 'completed' })}
                          onTogglePriority={() => updateTask(task.id, { priority: task.priority === 'urgent' || task.priority === 'high' ? 'medium' : 'high' })}
                          onDelete={() => {
                            deleteTask(task.id);
                            if (selectedTaskId === task.id) setSelectedTaskId(null);
                          }}
                          teamMembers={teamMembers}
                          user={user}
                          customers={customers}
                        />
                     ))}
                     {openTasks.filter(t => t.uid === user?.uid).length === 0 && (
                       <div className="py-4 text-center bg-zinc-50/50 rounded-xl border border-zinc-100 border-dashed">
                         <p className="text-zinc-400 text-sm">No tasks assigned to you right now.</p>
                       </div>
                     )}
                   </div>
                </div>

                {/* Team Members Section */}
                {teamMembers.filter(m => m.id !== user?.uid).map(member => (
                   <div key={member.id} className="pt-2">
                      <h2 className="text-xl font-bold text-zinc-800 mb-4 flex items-center gap-2 border-b border-zinc-200 pb-2">
                        {member.display}'s Tasks
                      </h2>
                      
                      {/* Quick Add Task for Staff */}
                      <div className="mb-4 bg-zinc-50 rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col sm:flex-row sm:items-center p-1.5 pl-3 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all gap-2">
                        <Input
                          placeholder={`Add a task for ${member.display}...`}
                          className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-[15px] font-medium placeholder:text-zinc-500 h-10 px-0"
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && e.currentTarget.value.trim()) {
                              const title = e.currentTarget.value.trim();
                              e.currentTarget.value = "";
                              await createTask({
                                title,
                                description: "",
                                priority: "medium",
                                status: "open",
                                dueDate: format(new Date(), 'yyyy-MM-dd'),
                                category: "",
                                uid: member.id,
                                userId: member.id,
                                userName: member.display,
                              });
                            }
                          }}
                        />
                        <Button size="sm" variant="ghost" className="sm:inline-flex hidden h-8 px-3 text-zinc-400">Enter to add</Button>
                      </div>

                      <div className="space-y-1">
                        {openTasks.filter(t => t.uid === member.id).map(task => (
                          <TaskRow 
                             key={task.id} 
                             task={task} 
                             selected={selectedTaskId === task.id}
                             onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                             onToggleStatus={() => updateTask(task.id, { status: 'completed' })}
                             onTogglePriority={() => updateTask(task.id, { priority: task.priority === 'urgent' || task.priority === 'high' ? 'medium' : 'high' })}
                             onDelete={() => {
                               deleteTask(task.id);
                               if (selectedTaskId === task.id) setSelectedTaskId(null);
                             }}
                             teamMembers={teamMembers}
                             user={user}
                             customers={customers}
                           />
                        ))}
                        {openTasks.filter(t => t.uid === member.id).length === 0 && (
                          <div className="py-4 text-center bg-zinc-50/50 rounded-xl border border-zinc-100 border-dashed">
                            <p className="text-zinc-400 text-sm">No tasks for {member.display}.</p>
                          </div>
                        )}
                      </div>
                   </div>
                ))}
                
                {/* Unassigned Section */}
                <div className="pt-2">
                   <h2 className="text-xl font-bold text-zinc-800 mb-4 flex items-center gap-2 border-b border-zinc-200 pb-2">
                     <span className="bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-md text-sm">Unassigned</span>
                     Unassigned Tasks
                   </h2>
                   
                   {/* Quick Add Task Unassigned */}
                   <div className="mb-4 bg-zinc-50 rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col sm:flex-row sm:items-center p-1.5 pl-3 focus-within:ring-2 focus-within:ring-zinc-500/20 focus-within:border-zinc-500 transition-all gap-2">
                     <Input
                       placeholder="Add an unassigned task..."
                       className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-[15px] font-medium placeholder:text-zinc-500 h-10 px-0"
                       onKeyDown={async (e) => {
                         if (e.key === "Enter" && e.currentTarget.value.trim()) {
                           const title = e.currentTarget.value.trim();
                           e.currentTarget.value = "";
                           await createTask({
                             title,
                             description: "",
                             priority: "medium",
                             status: "open",
                             dueDate: format(new Date(), 'yyyy-MM-dd'),
                             category: "",
                             uid: "",
                             userId: "",
                             userName: "",
                           });
                         }
                       }}
                     />
                     <Button size="sm" variant="ghost" className="sm:inline-flex hidden h-8 px-3 text-zinc-400">Enter to add</Button>
                   </div>

                   <div className="space-y-1">
                     {openTasks.filter(t => !t.uid).map(task => (
                       <TaskRow 
                          key={task.id} 
                          task={task} 
                          selected={selectedTaskId === task.id}
                          onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                          onToggleStatus={() => updateTask(task.id, { status: 'completed' })}
                          onTogglePriority={() => updateTask(task.id, { priority: task.priority === 'urgent' || task.priority === 'high' ? 'medium' : 'high' })}
                          onDelete={() => {
                            deleteTask(task.id);
                            if (selectedTaskId === task.id) setSelectedTaskId(null);
                          }}
                          teamMembers={teamMembers}
                          user={user}
                          customers={customers}
                        />
                     ))}
                     {openTasks.filter(t => !t.uid).length === 0 && (
                       <div className="py-4 text-center bg-zinc-50/50 rounded-xl border border-zinc-100 border-dashed">
                         <p className="text-zinc-400 text-sm">No unassigned tasks.</p>
                       </div>
                     )}
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR (Task Detail Pane) */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0, x: 50, flexBasis: 0 }}
            animate={{ opacity: 1, x: 0, flexBasis: '320px' }}
            exit={{ opacity: 0, x: 50, flexBasis: 0 }}
            className="flex-shrink-0 border-l border-zinc-200 bg-zinc-50 flex flex-col z-20 overflow-hidden shadow-xl md:shadow-none absolute md:relative right-0 h-full"
            style={{ width: '320px' }}
          >
            {/* Header */}
            <div className="h-14 border-b border-zinc-200 flex items-center justify-between px-4 bg-white/50">
              <Button variant="ghost" size="sm" onClick={() => updateTask(selectedTask.id, { status: selectedTask.status === 'completed' ? 'open' : 'completed' })} className="h-8 gap-2 px-2 text-zinc-600 hover:text-zinc-900 border border-zinc-200 bg-white">
                <CheckCircle2 className={`w-4 h-4 ${selectedTask.status === 'completed' ? 'text-green-500 fill-green-500' : 'text-zinc-400'}`} />
                {selectedTask.status === 'completed' ? 'Completed' : 'Mark Complete'}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" onClick={() => setSelectedTaskId(null)} className="h-8 bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-3 rounded-md shadow-sm">
                  Save
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900" onClick={() => setSelectedTaskId(null)}>
                   <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-5 py-6  min-h-0">
              <div className="space-y-6 flex flex-col items-stretch">
                
                {/* Title Edit */}
                <div>
                  <textarea
                    className="w-full bg-transparent border-none text-xl font-bold focus:ring-2 focus:ring-blue-500/20 rounded-2xl sm:rounded-2xl resize-none overflow-hidden placeholder:text-zinc-400 text-zinc-800 p-1 -ml-1 transition-colors"
                    value={selectedTask.title}
                    onChange={(e) => updateTask(selectedTask.id, { title: e.target.value })}
                    rows={Math.max(1, Math.ceil(selectedTask.title.length / 30))}
                    placeholder="Task title"
                  />
                </div>

                {/* Sub-attributes */}
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col divide-y divide-zinc-100/60">
                 
                 {/* Priority Row */}
                  <div className="flex items-center justify-between p-3">
                     <div className="flex items-center gap-3 text-sm font-medium text-zinc-600">
                      <Star className="w-4 h-4 text-zinc-400" />
                      Priority
                     </div>
                     <select 
                      className="text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedTask.priority}
                      onChange={(e) => updateTask(selectedTask.id, { priority: e.target.value as any })}
                     >
                       <option value="low">Low</option>
                       <option value="medium">Medium</option>
                       <option value="high">High</option>
                       <option value="urgent">Urgent</option>
                     </select>
                  </div>

                  {/* Due Date Row */}
                  <div className="flex items-center justify-between p-3">
                     <div className="flex items-center gap-3 text-sm font-medium text-zinc-600">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      Due Date
                     </div>
                     <input 
                      type="date"
                      className="text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 max-w-[130px]"
                      value={selectedTask.dueDate || ''}
                      onChange={(e) => updateTask(selectedTask.id, { dueDate: e.target.value })}
                     />
                  </div>

                  {/* Category Row */}
                  <div className="flex items-center justify-between p-3">
                     <div className="flex items-center gap-3 text-sm font-medium text-zinc-600">
                      <ListTodo className="w-4 h-4 text-zinc-400" />
                      Category
                     </div>
                     <select
                       className="text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
                       value={selectedTask.category || ''}
                       onChange={(e) => updateTask(selectedTask.id, { category: e.target.value })}
                     >
                       <option value="">None</option>
                       {categories.map((cat) => (
                         <option key={cat.id} value={cat.id}>{cat.name}</option>
                       ))}
                     </select>
                  </div>

                  {/* Assignee Row */}
                  <div className="flex items-center justify-between p-3">
                     <div className="flex items-center gap-3 text-sm font-medium text-zinc-600">
                      <User className="w-4 h-4 text-zinc-400" />
                      Assignee
                     </div>
                     <select
                       className="text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
                       value={selectedTask.userId || selectedTask.uid || ''}
                       onChange={(e) => {
                         const val = e.target.value;
                         let userName = "";
                         if (val) {
                           if (val === user?.uid) userName = user?.displayName || user?.email || "Me";
                           else userName = teamMembers.find(m => m.id === val)?.display || "";
                         }
                         updateTask(selectedTask.id, { uid: val, userId: val, userName });
                       }}
                     >
                       <option value="">Unassigned</option>
                       {user?.uid && !teamMembers.find(m => m.id === user.uid) && (
                         <option value={user.uid}>Me</option>
                       )}
                       {teamMembers.map((m) => (
                         <option key={m.id} value={m.id}>{m.display}</option>
                       ))}
                     </select>
                  </div>
                </div>

                {/* Optional Links section if we have linked ticket/customer */}
                {(selectedTask.linkedTicketNumber || selectedTask.linkedConversationPhone || selectedTask.linkedCustomerId) && (
                  <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 space-y-2">
                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Associations</h4>
                    {selectedTask.linkedTicketNumber && (
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <Wrench className="w-4 h-4" />
                        <span className="font-medium">Job #{selectedTask.linkedTicketNumber}</span>
                      </div>
                    )}
                    {selectedTask.linkedConversationPhone && (
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <MessageSquare className="w-4 h-4" />
                        <span className="font-medium">Chat: {selectedTask.linkedConversationPhone}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Edit */}
                <div>
                  <textarea
                    className="w-full bg-white border border-zinc-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl resize-y min-h-[120px] placeholder:text-zinc-400 text-zinc-700 p-3 transition-colors shadow-sm"
                    value={selectedTask.description || ''}
                    spellCheck={true}
                    onChange={(e) => updateTask(selectedTask.id, { description: e.target.value })}
                    placeholder="Add note"
                  />
                </div>
                
              </div>
            </div>
            
            {/* Footer Footer */}
            <div className="h-14 border-t border-zinc-200 flex items-center justify-between px-4 bg-white/50 text-xs text-zinc-400">
              {selectedTask.createdAt ? `Created ${format(selectedTask.createdAt?.toDate?.() || new Date(selectedTask.createdAt), 'MMM d, yyyy')}` : ''}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50" onClick={() => { deleteTask(selectedTask.id); setSelectedTaskId(null); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
}

// Subcomponents
function SidebarItem({ icon, label, count, active, onClick, color }: { icon: React.ReactNode, label: string, count: number, active: boolean, onClick: () => void, color: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${
        active ? 'bg-white shadow-sm border border-zinc-200/50 text-zinc-900 group' : 'hover:bg-zinc-200/50 text-zinc-600'
      }`}
    >
      <div className={`flex items-center gap-3 ${active ? color : ''}`}>
        {icon}
        {label}
      </div>
      {count > 0 && (
        <span className={`${active ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-200 text-zinc-600'} text-[11px] px-2 py-0.5 rounded-full font-bold`}>
          {count}
        </span>
      )}
    </button>
  );
}

function TaskRow({ 
  task, 
  selected, 
  onClick, 
  onToggleStatus, 
  onTogglePriority, 
  onDelete,
  teamMembers, 
  user, 
  customers 
}: { 
  task: Task, 
  selected: boolean, 
  onClick: () => void, 
  onToggleStatus: () => void, 
  onTogglePriority: () => void, 
  onDelete: () => void,
  teamMembers: any[], 
  user: any, 
  customers?: any[] 
}) {
  const isHighPriority = task.priority === 'high' || task.priority === 'urgent';
  
  const assignedMember = teamMembers.find(m => m.id === task.uid);
  const assigneeDisplay = assignedMember ? assignedMember.display : (task.uid === user?.uid ? 'Me' : null);
  const linkedCustomer = customers?.find(c => c.id === task.linkedCustomerId);
  const customerNameDisplay = linkedCustomer ? (linkedCustomer.fullname || `${linkedCustomer.firstname} ${linkedCustomer.lastname}`.trim()) : task.linkedCustomerName;

  return (
    <div 
      className={`group flex items-center p-2 md:p-3 rounded-lg transition-all border border-transparent cursor-pointer ${
        selected ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-zinc-50 border-b-zinc-100 border-b'
      }`}
      onClick={onClick}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors mr-3 mt-0.5 self-start ${
          task.status === 'completed'
            ? 'bg-blue-500 border-blue-500'
            : 'border-zinc-300 hover:border-blue-500'
        }`}
      >
        {task.status === 'completed' && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
      </button>
      
      <div className="flex-1 min-w-0 pr-4">
        <h3 className={`font-medium text-[15px] truncate transition-colors ${
          task.status === 'completed' ? 'line-through text-zinc-400' : 'text-zinc-800'
        }`}>
          {task.title}
        </h3>
        {/* Subtle metadata line below title */}
        {((task.dueDate && task.status !== 'completed') || task.linkedTicketNumber || task.description || assigneeDisplay || customerNameDisplay || task.category) && (
          <div className="flex items-center flex-wrap gap-2 mt-0.5 text-xs">
            {task.dueDate && task.status !== 'completed' && (
              <span className={`flex items-center gap-1 ${
                task.dueDate < format(new Date(), 'yyyy-MM-dd') ? 'text-red-500 font-medium' : 'text-zinc-400'
              }`}>
                {task.dueDate < format(new Date(), 'yyyy-MM-dd') && <Calendar className="w-3 h-3" />}
                {task.dueDate === format(new Date(), 'yyyy-MM-dd') ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
              </span>
            )}
            {assigneeDisplay && (
              <>
                <span className="text-zinc-300">•</span>
                <span className="text-zinc-400">{assigneeDisplay}</span>
              </>
            )}
            {(task.linkedTicketNumber || customerNameDisplay) && (
              <>
                <span className="text-zinc-300">•</span>
                <span className="text-zinc-400">
                  {task.linkedTicketNumber ? `Job #${task.linkedTicketNumber}` : ''}
                  {task.linkedTicketNumber && customerNameDisplay ? ' - ' : ''}
                  {customerNameDisplay}
                </span>
              </>
            )}
            {task.description && (
               <>
                 <span className="text-zinc-300">•</span>
                 <span className="text-zinc-400 truncate max-w-[200px] inline-block align-bottom" title={task.description}>
                   {task.description}
                 </span>
               </>
            )}
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="shrink-0 w-8 h-8 flex items-center justify-center transition-all md:opacity-0 group-hover:opacity-100 mr-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100"
        title="Delete Task"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onTogglePriority(); }}
        className={`shrink-0 w-8 h-8 flex items-center justify-center transition-opacity md:opacity-100 ${isHighPriority ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <Star className={`w-5 h-5 transition-colors ${
          isHighPriority 
            ? (task.priority === 'urgent' ? 'text-red-500 fill-red-500' : 'text-blue-500 fill-blue-500') 
            : 'text-zinc-300 hover:text-zinc-400'
        }`} />
      </button>
    </div>
  );
}
