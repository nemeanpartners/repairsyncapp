import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, LucideIcon } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  id?: string;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  defaultExpanded = false,
  children,
  id
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div 
      id={id} 
      className="bg-white border text-zinc-900 border-zinc-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-200"
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 hover:bg-zinc-50/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
          <span className="font-bold text-sm tracking-tight text-zinc-900">{title}</span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-zinc-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
