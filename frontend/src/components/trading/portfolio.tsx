'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { PortfolioState } from '@/types/trading';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PortfolioProps {
  data: PortfolioState;
}

const Portfolio: React.FC<PortfolioProps> = ({ data }) => {
  // Calculate daily performance (mocked logic for display)
  const startValue = data.history[0]?.value || data.totalValue;
  const change = data.totalValue - startValue;
  const percentChange = ((change / startValue) * 100).toFixed(2);
  const isPositive = change >= 0;

  return (
    <div className="space-y-6">
      {/* Total Value Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-sm font-medium text-slate-500 mb-1">Total Portfolio Value</h3>
        <div className="flex items-baseline gap-3">
          <h2 className="text-4xl font-bold text-slate-900">
            ${data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{isPositive ? '+' : ''}{percentChange}% (24h)</span>
          </div>
        </div>

        {/* Mini Area Chart */}
        <div className="h-24 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.history}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? "#14F195" : "#EF4444"} stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={isPositive ? "#14F195" : "#EF4444"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip contentStyle={{display:'none'}} cursor={{stroke: '#cbd5e1'}} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "#10B981" : "#EF4444"}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Asset Allocation</h3>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Pie Chart */}
          <div className="w-32 h-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.assets as any[]}
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="currentPrice"
                >
                  {data.assets.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend / List */}
          <div className="w-full space-y-3">
            {data.assets.map((asset) => (
              <div key={asset.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }} />
                  <span className="font-medium text-slate-700">{asset.symbol}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    ${(asset.amount * asset.currentPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-slate-400">{asset.amount} {asset.symbol}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  <span className="font-medium text-slate-700">USD</span>
               </div>
               <div className="text-sm font-semibold text-slate-900">
                  ${data.cashBalance.toFixed(2)}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
