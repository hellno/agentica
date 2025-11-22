'use client';

import React from 'react';
import { Trade } from '@/types/trading';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

interface ActivityFeedProps {
  trades: Trade[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ trades }) => {
  if (trades.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-100 border-dashed">
        <p>No trades executed yet today.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-50">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {trades.slice().reverse().map((trade) => (
          <div key={trade.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                trade.type === 'BUY' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}>
                {trade.type === 'BUY' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {trade.type === 'BUY' ? 'Bought' : 'Sold'} {trade.amount} {trade.asset}
                </p>
                <p className="text-xs text-slate-500">
                  @ ${trade.price.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${trade.type === 'BUY' ? 'text-slate-900' : 'text-green-600'}`}>
                {trade.type === 'BUY' ? '-' : '+'}${trade.total.toFixed(2)}
              </p>
              <div className="flex items-center justify-end gap-1 text-xs text-slate-400 mt-1">
                <Clock className="w-3 h-3" />
                {trade.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 text-center border-t border-slate-50">
        <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
          View Full Trade History
        </button>
      </div>
    </div>
  );
};

export default ActivityFeed;
