import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Ticket, MessageSquare, Users, Settings } from "lucide-react";

export function BottomNav({ unreadCount }: { unreadCount: number }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Tickets", href: "/tickets", icon: Ticket },
    { label: "Messages", href: "/messages", icon: MessageSquare, badge: unreadCount },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings }
  ];

  return (
    <div className="md:hidden sticky bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] bg-white border-t border-zinc-200 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] z-[60] shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.href)}
            className={`flex flex-col items-center justify-center p-1 relative w-16 h-12 transition-all group outline-none ${isActive ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${isActive ? 'bg-zinc-100' : 'group-hover:bg-zinc-50'}`}>
              <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            
            {/* Minimal label or indicator instead of large text */}
            <span className={`text-[9px] font-medium transition-colors ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
               {item.label}
            </span>

            {item.badge ? (
              <span className="absolute top-0 right-1.5 bg-red-50 text-red-600 border border-red-200 min-w-[16px] h-4 rounded-full text-xs font-medium flex items-center justify-center px-1 border border-white shadow-sm ring-1 ring-black/5">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
