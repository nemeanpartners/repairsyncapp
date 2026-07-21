import React, { useState, useEffect } from 'react';
import { collection, query, where, doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../providers/AuthProvider';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, CheckSquare, Sun, Moon, CalendarCheck, Save, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

const CHECKLIST_TEMPLATES = {
  opening: [
    "Opening the doors",
    "Turning the lights on",
    "Checking the products on the front shelf",
    "Turning on displays and TVs",
    "Checking the emails",
    "Checking the leads",
    "Going over the tickets for the day",
    "Preparing the cash register"
  ],
  closing: [
    "Vacuuming the floors",
    "Emptying the trash bins",
    "Wiping down counters and displays",
    "Turning off all non-essential lights and displays",
    "Locking the front doors",
    "Setting the security alarm"
  ],
  end_of_day: [
    "Contacting any customers with updates",
    "Following up on pending invoices",
    "Reconciling the till/register",
    "Reviewing unresolved tickets",
    "Sending daily summary report to management"
  ]
};

const TILL_DENOMINATIONS = [
  { value: 100, label: "$100 Notes" },
  { value: 50, label: "$50 Notes" },
  { value: 20, label: "$20 Notes" },
  { value: 10, label: "$10 Notes" },
  { value: 5, label: "$5 Notes" },
  { value: 2, label: "$2 Coins" },
  { value: 1, label: "$1 Coins" },
  { value: 0.5, label: "50c Coins" },
  { value: 0.2, label: "20c Coins" },
  { value: 0.1, label: "10c Coins" },
  { value: 0.05, label: "5c Coins" }
];

export function ChecklistsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("opening");
  const [dailyData, setDailyData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Extra fields for opening
  const [tillCounts, setTillCounts] = useState<Record<string, number>>({});
  const [staffOnDuty, setStaffOnDuty] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const q = query(
      collection(db, 'daily_checklists'),
      where('date', '==', todayStr)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, any> = {};
      snapshot.forEach(doc => {
        data[doc.data().type] = doc.data();
      });
      setDailyData(data);
      
      if (data.opening) {
        if (data.opening.tillCounts) setTillCounts(data.opening.tillCounts);
        if (data.opening.staffOnDuty) setStaffOnDuty(data.opening.staffOnDuty);
        if (data.opening.submittedBy) setSubmittedBy(data.opening.submittedBy);
        if (data.opening.dailyBudget) setDailyBudget(data.opening.dailyBudget);
      }
      
      setLoading(false);
    }, (error) => {
      console.error("Error fetching checklists:", error);
      toast.error("Failed to load checklists");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [todayStr]);

  const saveOpeningDetails = async () => {
    if (!user) return;
    const docId = `${todayStr}_opening`;
    try {
      await setDoc(doc(db, 'daily_checklists', docId), {
        date: todayStr,
        type: 'opening',
        tillCounts,
        staffOnDuty,
        submittedBy: submittedBy || user.displayName || user.email || 'Unknown User',
        dailyBudget,
        lastUpdatedBy: user.displayName || user.email || 'Unknown User',
        lastUpdatedAt: serverTimestamp()
      }, { merge: true });
      toast.success("Opening details saved successfully");
    } catch (error) {
      console.error("Error updating opening details:", error);
      toast.error("Failed to update opening details");
    }
  };

  const handleTillCountChange = (value: number, countStr: string) => {
    const count = parseInt(countStr) || 0;
    setTillCounts(prev => ({
      ...prev,
      [value.toString()]: count
    }));
  };

  const calculateTotalTill = () => {
    return TILL_DENOMINATIONS.reduce((total, den) => {
      const count = tillCounts[den.value.toString()] || 0;
      return total + (den.value * count);
    }, 0);
  };

  const toggleItem = async (type: string, item: string) => {
    if (!user) return;
    
    const docId = `${todayStr}_${type}`;
    const currentData = dailyData[type] || { completedItems: [] };
    const currentItems = currentData.completedItems || [];
    
    let newItems;
    if (currentItems.includes(item)) {
      newItems = currentItems.filter((i: string) => i !== item);
    } else {
      newItems = [...currentItems, item];
    }

    try {
      await setDoc(doc(db, 'daily_checklists', docId), {
        date: todayStr,
        type,
        completedItems: newItems,
        lastUpdatedBy: user.displayName || user.email || 'Unknown User',
        lastUpdatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error updating checklist:", error);
      toast.error("Failed to update checklist");
    }
  };

  const renderChecklist = (type: 'opening' | 'closing' | 'end_of_day', items: string[]) => {
    const completedItems = dailyData[type]?.completedItems || [];
    const progress = Math.round((completedItems.length / items.length) * 100);
    const lastUpdatedBy = dailyData[type]?.lastUpdatedBy;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-zinc-900">
              {progress === 100 ? 'All tasks completed! 🎉' : `${completedItems.length} of ${items.length} tasks completed`}
            </h3>
            {lastUpdatedBy && (
              <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5" />
                Last updated by {lastUpdatedBy}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-zinc-700">{progress}%</span>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          {items.map((item, index) => {
            const isCompleted = completedItems.includes(item);
            return (
              <div 
                key={index}
                onClick={() => toggleItem(type, item)}
                className={`flex items-start gap-3 p-4 cursor-pointer transition-colors border-b border-zinc-100 last:border-0 hover:bg-zinc-50 ${isCompleted ? 'bg-zinc-50/50' : ''}`}
              >
                <button className={`mt-0.5 shrink-0 transition-colors ${isCompleted ? 'text-emerald-500' : 'text-zinc-300 hover:text-zinc-400'}`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <span className={`text-sm md:text-base transition-colors ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-700'}`}>
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOpeningDetails = () => {
    return (
      <div className="mt-8 pt-8 border-t border-zinc-200">
        <h4 className="text-lg font-medium text-zinc-900 mb-6 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-500" />
          Till Count & Daily Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-4">
            <h5 className="font-medium text-zinc-700 text-sm">Denominations (Count)</h5>
            <div className="grid grid-cols-2 gap-3">
              {TILL_DENOMINATIONS.map((den) => (
                <div key={den.value} className="flex items-center gap-3">
                  <label className="text-sm text-zinc-500 w-20 shrink-0">{den.label}</label>
                  <Input 
                    type="number" 
                    min="0"
                    placeholder="0"
                    className="h-9"
                    value={tillCounts[den.value.toString()] || ''}
                    onChange={(e) => handleTillCountChange(den.value, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="pt-4 flex items-center justify-between border-t border-zinc-100">
              <span className="font-semibold text-zinc-700">Total Till:</span>
              <span className="font-bold text-lg text-emerald-600">${calculateTotalTill().toFixed(2)}</span>
            </div>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-700">Staff on Duty</label>
              <Input 
                placeholder="E.g. Alice, Bob" 
                value={staffOnDuty}
                onChange={(e) => setStaffOnDuty(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-700">Submitted By</label>
              <Input 
                placeholder="Name" 
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-700">Daily Budget</label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
              />
            </div>
            <button 
              onClick={saveOpeningDetails}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 transition-colors py-2.5 rounded-lg font-medium text-sm mt-4"
            >
              <Save className="w-4 h-4" />
              Save Details
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50/50">
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
              Daily Checklists
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Store operations and procedures for {format(new Date(), 'EEEE, MMMM do')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-zinc-200/50 rounded-xl">
                <TabsTrigger value="opening" className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    <span className="font-medium">Opening</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="closing" className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    <span className="font-medium">Closing</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="end_of_day" className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4" />
                    <span className="font-medium hidden sm:inline">End of Day</span>
                    <span className="font-medium sm:hidden">EOD</span>
                  </div>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="opening" className="focus:outline-none">
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-orange-100/50">
                    <CardTitle className="text-amber-900">Opening Checklist</CardTitle>
                    <CardDescription className="text-amber-700/80">Tasks to complete before opening the store</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {renderChecklist('opening', CHECKLIST_TEMPLATES.opening)}
                    {renderOpeningDetails()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="closing" className="focus:outline-none">
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-blue-100/50">
                    <CardTitle className="text-indigo-900">Closing Checklist</CardTitle>
                    <CardDescription className="text-indigo-700/80">Physical tasks to secure the store</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {renderChecklist('closing', CHECKLIST_TEMPLATES.closing)}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="end_of_day" className="focus:outline-none">
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-teal-100/50">
                    <CardTitle className="text-emerald-900">End of Day Procedures</CardTitle>
                    <CardDescription className="text-emerald-700/80">Administrative and follow-up tasks</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {renderChecklist('end_of_day', CHECKLIST_TEMPLATES.end_of_day)}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
