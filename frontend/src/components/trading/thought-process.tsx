'use client';

import React, { useEffect, useRef } from 'react';
import { Thought } from '@/types/trading';
import { BrainCircuit, Activity, Radio, CheckCircle2, Loader2 } from 'lucide-react';

interface ThoughtProcessProps {
  thoughts: Thought[];
}

const ThoughtProcess: React.FC<ThoughtProcessProps> = ({ thoughts }) => {
  const endRef = useRef<HTMLDivElement>(null);

  // Get the latest thought for the "Hero" section
  const latestThought = thoughts[thoughts.length - 1];

  // Auto scroll to bottom of history
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thoughts]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 flex flex-col max-h-[calc(100vh-8rem)] overflow-hidden relative">
       {/* Background decorative elements */}
       <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
       <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-400 blur opacity-20 rounded-full animate-pulse"></div>
            <BrainCircuit className="w-6 h-6 text-indigo-600 relative z-10" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Agent Neural Core</h3>
            <p className="text-xs text-slate-500">Live decision stream</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
           <span className="text-xs font-mono text-indigo-600 font-medium">ONLINE</span>
        </div>
      </div>

      {/* Active State Hero (The Brain) */}
      <div className="p-5 bg-gradient-to-b from-indigo-50/50 to-white border-b border-slate-100 z-10 transition-all duration-300 shrink-0">
        <div className="flex items-start gap-4">
          <div className={`mt-1 p-3 rounded-xl shadow-sm transition-all duration-500 ${
             latestThought?.action === 'TRADING' ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-200' :
             latestThought?.action === 'ANALYZING' ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200' :
             'bg-slate-100 text-slate-500'
          }`}>
            {latestThought?.action === 'TRADING' ? <Radio className="w-6 h-6 animate-pulse" /> :
             latestThought?.action === 'ANALYZING' ? <Loader2 className="w-6 h-6 animate-spin" /> :
             <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-1 block">
              Current Operation
            </span>
            <p className="text-lg font-semibold text-slate-800 leading-snug animate-fade-in">
              {latestThought ? latestThought.message : "Initializing neural network..."}
            </p>
            {latestThought && (
               <div className="mt-2 flex items-center gap-2">
                 <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${
                   latestThought.action === 'TRADING' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                   latestThought.action === 'ANALYZING' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                   'bg-slate-50 border-slate-200 text-slate-600'
                 }`}>
                   {latestThought.action}
                 </span>
                 <span className="text-xs text-slate-400 font-mono">
                   {latestThought.timestamp.toLocaleTimeString()}
                 </span>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* History Stream */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-4 relative scroll-smooth min-h-0">
        {/* Timeline Line */}
        <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-slate-200" />

        {thoughts.slice(0, -1).reverse().map((thought) => (
          <div key={thought.id} className="relative pl-8 opacity-70 hover:opacity-100 transition-opacity group">
            {/* Timeline Dot */}
            <div className={`absolute left-1 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${
              thought.action === 'TRADING' ? 'bg-amber-400' :
              thought.action === 'ANALYZING' ? 'bg-indigo-400' : 'bg-slate-400'
            }`} />

            <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm group-hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    thought.action === 'TRADING' ? 'bg-amber-50 text-amber-700' :
                    thought.action === 'ANALYZING' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {thought.action}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {thought.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {thought.message}
              </p>
            </div>
          </div>
        ))}

        {thoughts.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-10">
            Awaiting data stream start...
          </div>
        )}
        {/* Invisible element to scroll to */}
        <div ref={endRef} className="h-1" />
      </div>
    </div>
  );
};

export default ThoughtProcess;
