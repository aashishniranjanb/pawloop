'use client';

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Bot } from 'lucide-react';
import type { Insight } from '@/lib/intelligence';

interface InsightsPanelProps {
  insights: Insight[];
}

const TYPE_STYLES: Record<Insight['type'], string> = {
  urgent: 'border-red-200 bg-red-50 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
  alert: 'border-red-200 bg-red-50 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
  warning: 'border-amber-200 bg-amber-50 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
  info: 'border-sky-200 bg-sky-50 shadow-[0_0_10px_rgba(14,165,233,0.1)]',
  system: 'border-gray-200 bg-gray-50 shadow-sm',
  positive: 'border-green-200 bg-green-50 shadow-[0_0_10px_rgba(34,197,94,0.1)]',
  success: 'border-green-200 bg-green-50 shadow-[0_0_10px_rgba(34,197,94,0.1)]',
};

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Auto-rotate through insights
  useEffect(() => {
    if (expanded || insights.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % insights.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [expanded, insights.length]);

  if (insights.length === 0) {
    return (
      <div className="pointer-events-auto">
        <div className="surface-glass rounded-2xl shadow-float overflow-hidden animate-scale-in px-4 py-3 border border-gray-100">
          <div className="flex flex-col gap-1 items-center justify-center text-center">
            <Bot size={24} className="text-gray-500 mb-1" />
            <p className="text-xs font-semibold text-gray-800">No active insights</p>
            <p className="text-[10px] text-gray-500">The ecosystem is stable at the moment.</p>
          </div>
        </div>
      </div>
    );
  }

  const current = insights[currentIdx];
  if (!current) return null;

  return (
    <div className="pointer-events-auto">
      {expanded ? (
        /* Expanded — show all insights */
        <div className="surface-glass rounded-2xl shadow-float overflow-hidden max-h-[300px] animate-scale-in">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Intelligence Feed
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronDown size={14} className="text-gray-500" />
            </button>
          </div>
          <div className="scroll-area max-h-[250px] px-3 py-2 space-y-2">
            {insights.slice(0, 6).map((insight) => (
              <div
                key={insight.id}
                className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${TYPE_STYLES[insight.type]}`}
              >
                <span className="text-base flex-shrink-0 mt-0.5">{insight.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-tight">
                    {insight.title}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5 leading-snug">{insight.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Collapsed — single rotating insight */
        <button
          onClick={() => setExpanded(true)}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-float backdrop-blur-md
            transition-all duration-300 hover:brightness-95 ${TYPE_STYLES[current.type]}`}
        >
          <span className="text-base flex-shrink-0">{current.icon}</span>
          <div className="min-w-0 text-left">
            <p className="text-[11px] font-semibold text-gray-800 leading-tight truncate max-w-[220px]">
              {current.title}
            </p>
            <p className="text-[9px] text-gray-600 truncate max-w-[220px]">{current.body}</p>
          </div>
          <ChevronUp size={12} className="text-gray-500 flex-shrink-0 ml-1" />
        </button>
      )}
    </div>
  );
}
