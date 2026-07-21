import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, AlertTriangle, SpellCheck, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface LanguageToolMatch {
  message: string;
  shortMessage?: string;
  replacements: { value: string }[];
  offset: number;
  length: number;
  context: {
    text: string;
    offset: number;
    length: number;
  };
  rule: {
    id: string;
    description: string;
    issueType: string;
    category: {
      id: string;
      name: string;
    };
  };
}

interface SpellCheckerProps {
  text: string;
  onTextChange: (newText: string) => void;
  className?: string;
}

export function SpellChecker({ text, onTextChange, className = '' }: SpellCheckerProps) {
  const [matches, setMatches] = useState<LanguageToolMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastCheckedText, setLastCheckedText] = useState('');

  const checkSpelling = useCallback(async () => {
    if (!text.trim() || text === lastCheckedText) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: text,
          language: 'auto',
          enabledOnly: 'false',
        }),
      });
      
      const data = await response.json();
      const validMatches = data.matches.filter((m: any) => m.replacements && m.replacements.length > 0);
      setMatches(validMatches);
      setLastCheckedText(text);
      
      if (validMatches.length > 0) {
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Spell check error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [text, lastCheckedText]);

  // Debounced auto-check when popover is open
  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => {
      checkSpelling();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [text, isOpen, checkSpelling]);

  const applyFix = (matchIndex: number, replacement: string) => {
    const match = matches[matchIndex];
    if (!match) return;

    // We must apply the fix and adjust all subsequent matches offsets, or simply re-check.
    // For simplicity, we apply the fix and immediately re-check (since text shifts).
    const start = match.offset;
    const end = match.offset + match.length;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    
    onTextChange(newText);
    
    // Optimistically update
    const newMatches = [...matches];
    newMatches.splice(matchIndex, 1);
    setMatches(newMatches);
    
    // Clear lastCheckedText to force a re-check next time checkSpelling is called
    setLastCheckedText('');
  };

  const ignoreFix = (matchIndex: number) => {
    const newMatches = [...matches];
    newMatches.splice(matchIndex, 1);
    setMatches(newMatches);
  };

  if (!text.trim()) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            onClick={checkSpelling}
            className={`px-2 py-1 h-7 rounded-2xl sm:rounded-2xl text-xs font-medium transition-all ${
              matches.length > 0
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
            } ${className}`}
            title="Check Spelling & Grammar"
          />
        }
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        ) : (
          <SpellCheck className="w-3.5 h-3.5 mr-1.5" />
        )}
        {matches.length > 0 ? (
          <span>{matches.length} issue{matches.length === 1 ? '' : 's'}</span>
        ) : (
          <span>Check</span>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-[320px] p-0 rounded-xl overflow-hidden shadow-xl border-border/40">
        <div className="bg-primary/5 border-b border-primary/10 p-3 flex items-center gap-2">
          <SpellCheck className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold text-primary">Spell Check Suggestions</h4>
          <Badge variant="secondary" className="ml-auto text-xs bg-white">
            {matches.length}
          </Badge>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {matches.length === 0 ? (
            <div className="p-6 text-center text-zinc-500">
              <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-600">Looking good!</p>
              <p className="text-xs text-zinc-400 mt-1">No grammar or spelling issues found.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {matches.map((match, i) => (
                <div key={i} className="p-3 bg-white hover:bg-zinc-50 transition-colors">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-600 mb-2 leading-relaxed">
                        {match.message}
                      </p>
                      <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 mb-3 text-sm">
                        <span className="text-zinc-500">"...</span>
                        <span className="text-zinc-800 line-through decoration-amber-300 decoration-2">
                          {text.substring(match.offset, match.offset + match.length)}
                        </span>
                        <span className="text-zinc-500">..."</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {match.replacements.slice(0, 3).map((rep, j) => (
                          <Button
                            key={j}
                            variant="secondary"
                            onClick={() => applyFix(i, rep.value)}
                            className="h-7 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-0 rounded-2xl sm:rounded-2xl shrink-0"
                          >
                            {rep.value}
                          </Button>
                        ))}
                        <Button
                          variant="ghost"
                          onClick={() => ignoreFix(i)}
                          className="h-7 w-7 p-0 rounded-2xl sm:rounded-2xl text-zinc-400 hover:text-zinc-600 ml-auto shrink-0"
                          title="Ignore"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
