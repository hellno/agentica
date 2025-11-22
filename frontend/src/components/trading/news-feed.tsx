'use client';

import React from 'react';
import { NewsItem } from '@/types/trading';
import { Newspaper, ExternalLink } from 'lucide-react';

interface NewsFeedProps {
  news: NewsItem[];
}

const NewsFeed: React.FC<NewsFeedProps> = ({ news }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
             <Newspaper className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
             <h3 className="font-bold text-slate-900">Market Intelligence</h3>
             <p className="text-xs text-slate-500">Real-time global events</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-full border border-green-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-bold text-green-700">LIVE</span>
        </div>
      </div>

      <div className="overflow-y-auto p-4 space-y-3 bg-slate-50/30 max-h-[400px]">
        {news.map((item) => (
          <div
            key={item.id}
            className="group relative bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden"
          >
            {/* Sentiment Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
              item.sentiment === 'positive' ? 'bg-green-500' :
              item.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-300'
            }`} />

            <div className="pl-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                  item.sentiment === 'positive' ? 'bg-green-50 text-green-600' :
                  item.sentiment === 'negative' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.sentiment}
                </span>
                <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{item.timestamp}</span>
              </div>

              <h4 className="text-sm font-semibold text-slate-900 leading-snug mb-2 group-hover:text-indigo-600 transition-colors">
                {item.headline}
              </h4>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  {item.source}
                </span>
                <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-400" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsFeed;
