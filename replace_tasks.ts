import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const startMatch = '{activeView === "tasks" && (';
const endMatch = '          {activeView === "settings" && (';

const startIndex = content.indexOf(startMatch);
const endIndex = content.indexOf(endMatch);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `          {activeView === "tasks" && (
            <TasksView
              groupedTasks={groupedTasks}
              taskSearchQuery={taskSearchQuery}
              setTaskSearchQuery={setTaskSearchQuery}
              taskFilter={taskFilter}
              setTaskFilter={setTaskFilter}
              taskSort={taskSort}
              setTaskSort={setTaskSort}
              setTaskDraft={setTaskDraft}
              setIsTaskModalOpen={setIsTaskModalOpen}
              setTaskToDelete={setTaskToDelete}
              updateTaskStatus={async (id, status) => {
                const { updateDoc, doc } = await import("firebase/firestore");
                await updateDoc(doc(db, "tasks", id), { status });
              }}
              customers={customers}
              fetchTickets={fetchTickets}
              setSelectedCustomer={setSelectedCustomer}
              setSelectedTicket={setSelectedTicket}
              setTickets={setTickets}
              handleNavigate={handleNavigate}
            />
          )}

`;
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  content = "import { TasksView } from './components/TasksView';\n" + content;
  fs.writeFileSync('src/App.tsx', content, 'utf-8');
  console.log("Tasks replaced");
} else {
  console.log("Could not find bounds");
}
