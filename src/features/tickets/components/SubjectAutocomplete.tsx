import React, { useState, useEffect, useRef } from 'react';
import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Input } from '@/components/ui/input';

const DEFAULT_SUBJECTS = [
  'Screen Replacement',
  'Battery Replacement',
  'Charging Port Repair',
  'Water Damage Diagnostics',
  'Data Recovery',
  'Software Issues',
  'Not Turning On',
  'Camera Replacement',
  'Speaker Issue',
  'Back Glass Replacement'
];

export function SubjectAutocomplete({ value, onChange, errorClass }: { value: string, onChange: (v: string) => void, errorClass?: string }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecentSubjects = async () => {
      try {
        const q = query(collection(db, 'crm_tickets'), orderBy('created_at', 'desc'), limit(100));
        const snap = await getDocs(q);
        const subjects = new Set<string>(DEFAULT_SUBJECTS);
        snap.forEach(doc => {
          const s = doc.data().subject;
          if (s) {
            subjects.add(s);
          }
        });
        setAllSubjects(Array.from(subjects));
      } catch (e) {
        console.error("Failed to load past subjects", e);
      }
    };
    fetchRecentSubjects();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value && isOpen) {
      const lower = value.toLowerCase();
      const matched = allSubjects.filter(s => s.toLowerCase().includes(lower) && s !== value);
      setSuggestions(matched.slice(0, 10));
    } else {
      setSuggestions(allSubjects.slice(0, 10));
    }
  }, [value, isOpen, allSubjects]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Input
        placeholder="e.g. Screen Replacement"
        className={`h-12 rounded-xl bg-zinc-100 border-none focus-visible:ring-0 focus-visible:border-zinc-300 font-bold shadow-inner ${errorClass || ''}`}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg max-h-60 overflow-y-auto overflow-x-hidden">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="px-4 py-3 text-sm font-medium hover:bg-zinc-100 cursor-pointer text-zinc-800 transition-colors border-b border-zinc-50 last:border-b-0 whitespace-normal break-words"
              onClick={() => {
                onChange(suggestion);
                setIsOpen(false);
              }}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
