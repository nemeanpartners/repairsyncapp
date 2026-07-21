import re

with open('src/pages/AppShell.tsx', 'r') as f:
    content = f.read()

pattern = r'<nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-6">.*?</nav>'
replacement = """<DragDropContext onDragEnd={onDragEnd}>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-6">
          {navGroups.map((group) => {
            return (
              <div key={group.title} className="space-y-1">
                {!isDesktopCollapsed && (
                  <h3 className="px-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    {group.title}
                  </h3>
                )}
                {group.title === "Repairs" && approvedWaitingCount > 0 && (
                  <button
                    onClick={() => navigate("/tickets?status=Waiting for Parts")}
                    title="Approved: Order Parts"
                    className={`w-full flex items-center px-3 py-2.5 text-sm rounded-xl transition-all outline-none relative ${
                      isDesktopCollapsed
                        ? "md:justify-center justify-start gap-3 md:gap-0"
                        : "justify-start gap-3"
                    } text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 font-medium`}
                  >
                    <ClipboardCheck className={`w-5 h-5 shrink-0 text-zinc-400`} />
                    <span className={`tracking-wide whitespace-nowrap text-left transition-all duration-300 ${isDesktopCollapsed ? "md:w-0 md:opacity-0 md:hidden opacity-100" : "flex-1 opacity-100 block"}`}>
                      Approved: Order Parts
                    </span>
                    <span className={`ml-auto shrink-0 bg-amber-500 text-white text-xs font-medium px-2 py-0.5 rounded-full shadow-sm transition-all duration-300 ${isDesktopCollapsed ? "md:hidden" : "block"}`}>
                      {approvedWaitingCount}
                    </span>
                  </button>
                )}
                <Droppable droppableId={group.title}>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-1 min-h-[10px]"
                    >
                      {group.items.map((item: any, index: number) => {
                        let active = false;
                        if (item.href.includes("?")) {
                          const [basePath, searchStr] = item.href.split("?");
                          const itemParams = new URLSearchParams(searchStr);
                          const locParams = new URLSearchParams(location.search);
                          
                          const pathMatch = location.pathname === basePath;
                          let paramsMatch = true;
                          itemParams.forEach((val, key) => {
                            if (locParams.get(key) !== val) {
                              paramsMatch = false;
                            }
                          });
                          active = pathMatch && paramsMatch;
                        } else {
                          const isApprovedView = location.pathname === "/tickets" && new URLSearchParams(location.search).get("status") === "Approved";
                          if (isApprovedView && item.href === "/tickets") {
                            active = false;
                          } else {
                            active =
                              location.pathname === item.href ||
                              (location.pathname.startsWith(item.href) && item.href !== "/");
                          }
                        }

                        return (
                          <Draggable key={item.label} draggableId={item.label} index={index}>
                            {(provided, snapshot) => (
                              <button
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => navigate(item.href)}
                                title={item.label}
                                className={`w-full flex items-center px-3 py-2.5 text-sm rounded-xl transition-all outline-none relative ${
                                  isDesktopCollapsed
                                    ? "md:justify-center justify-start gap-3 md:gap-0"
                                    : "justify-start gap-3"
                                } ${
                                  active
                                    ? "bg-zinc-100 text-zinc-900 font-semibold shadow-sm"
                                    : snapshot.isDragging 
                                      ? "bg-white shadow-md z-50 ring-1 ring-zinc-200"
                                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 font-medium"
                                }`}
                              >
                                <item.icon
                                  className={`w-5 h-5 shrink-0 ${active ? "text-zinc-900" : "text-zinc-400"}`}
                                />
                                <span
                                  className={`tracking-wide whitespace-nowrap text-left transition-all duration-300 ${isDesktopCollapsed ? "md:w-0 md:opacity-0 md:hidden opacity-100" : "flex-1 opacity-100 block"}`}
                                >
                                  {item.label}
                                </span>

                                {item.label === "Messages" && unreadCount > 0 && (
                                  <>
                                    <span
                                      className={`ml-auto shrink-0 bg-red-50 text-red-600 border border-red-200 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm transition-all duration-300 ${isDesktopCollapsed ? "md:hidden" : "block"}`}
                                    >
                                      {unreadCount > 99 ? "99+" : unreadCount}
                                    </span>
                                    <span
                                      className={`absolute right-1 top-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white block transition-all duration-300 ${isDesktopCollapsed ? "md:block hidden" : "hidden"}`}
                                    />
                                  </>
                                )}
                              </button>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </nav>
        </DragDropContext>"""

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/pages/AppShell.tsx', 'w') as f:
    f.write(content)
