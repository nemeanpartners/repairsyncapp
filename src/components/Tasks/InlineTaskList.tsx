import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Circle, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

interface InlineTaskListProps {
  linkedTicketId?: string;
  linkedConversationPhone?: string;
  linkedConversationId?: string;
}

export function InlineTaskList({ linkedTicketId, linkedConversationPhone, linkedConversationId }: InlineTaskListProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    let q;
    if (linkedTicketId) {
      q = query(collection(db, "tasks"), where("linkedTicketId", "==", linkedTicketId));
    } else if (linkedConversationId) {
      q = query(collection(db, "tasks"), where("linkedConversationId", "==", linkedConversationId));
    } else if (linkedConversationPhone) {
      q = query(collection(db, "tasks"), where("linkedConversationPhone", "==", linkedConversationPhone));
    } else {
      return;
    }

    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
         if (a.status === 'completed' && b.status !== 'completed') return 1;
         if (a.status !== 'completed' && b.status === 'completed') return -1;
         const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
         const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
         return bTime - aTime;
      }));
    }, (error) => {
      console.error("InlineTaskList onSnapshot error:", error);
    });

    return () => unsub();
  }, [linkedTicketId, linkedConversationPhone]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setIsAdding(true);
      await addDoc(collection(db, "tasks"), {
        title: newTaskTitle.trim(),
        description: '',
        status: 'open',
        priority: 'medium',
        createdAt: serverTimestamp(),
        ...(linkedTicketId ? { linkedTicketId } : {}),
        ...(linkedConversationId ? { linkedConversationId } : {}),
        ...(linkedConversationPhone ? { linkedConversationPhone } : {})
      });
      setNewTaskTitle('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    await updateDoc(doc(db, "tasks", taskId), {
      status: currentStatus === 'completed' ? 'open' : 'completed',
    });
  };

  const deleteTask = async (taskId: string) => {
    await deleteDoc(doc(db, "tasks", taskId));
  };

  return (
    <div className="flex flex-col h-full bg-white border outline-none border-zinc-200 rounded-2xl p-4 sm:p-5">
       <div className="flex items-center justify-between mb-4">
         <h3 className="font-bold text-zinc-900">Linked Tasks</h3>
       </div>

       <form onSubmit={addTask} className="flex gap-2 mb-4">
          <Input 
            placeholder="Add a new task..." 
            value={newTaskTitle} 
            onChange={(e) => setNewTaskTitle(e.target.value)}
            disabled={isAdding}
            className="flex-1 bg-zinc-50 border-zinc-200"
          />
          <Button type="submit" disabled={!newTaskTitle.trim() || isAdding}>
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
       </form>

       <div className="flex-1 overflow-y-auto space-y-2">
          {tasks.length === 0 ? (
             <div className="text-center text-zinc-500 py-10 text-sm">No tasks added yet.</div>
          ) : (
             tasks.map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors bg-white group">
                  <button onClick={() => toggleTask(task.id, task.status)} className="mt-0.5 shrink-0">
                    {task.status === 'completed' ? (
                       <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                       <Circle className="w-5 h-5 text-zinc-300 hover:text-blue-500 transition-colors" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>
                      {task.title}
                    </p>
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id)} 
                    className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors p-1.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 ml-2 mt-[1px]"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
             ))
          )}
       </div>
    </div>
  );
}
