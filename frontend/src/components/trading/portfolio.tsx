"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { PortfolioState } from "@/types/trading";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Room } from "@/lib/platform-api";

// Dynamically import SimpleDaimoModal
const SimpleDaimoModal = dynamic(() => import("./simple-daimo-modal"), {
  ssr: false,
});

interface PortfolioProps {
  data: PortfolioState;
  currentRoom: Room | null;
}

const Portfolio: React.FC<PortfolioProps> = ({ data, currentRoom }) => {
  const [isDaimoModalOpen, setIsDaimoModalOpen] = useState(false);

  // Calculate daily performance (mocked logic for display)
  const startValue = data.history[0]?.value || data.totalValue;
  const change = data.totalValue - startValue;
  const percentChange = ((change / startValue) * 100).toFixed(2);
  const isPositive = change >= 0;

  return (
    <div className="space-y-6">
      {/* Total Value Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-slate-500">
            Total Portfolio Value
          </h3>
          <button
            onClick={() => setIsDaimoModalOpen(true)}
            className="p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
            title="Deposit Funds"
          >
            <Plus className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </button>
        </div>
        <div className="flex items-baseline gap-3">
          <h2 className="text-4xl font-bold text-slate-900">
            $
            {data.totalValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </h2>
          <div
            className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`}
          >
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {percentChange}% (24h)
            </span>
          </div>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Asset Allocation
        </h3>
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
              <div
                key={asset.symbol}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: asset.color }}
                  />
                  <span className="font-medium text-slate-700">
                    {asset.symbol}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    $
                    {(asset.amount * asset.currentPrice).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 0 },
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {asset.amount} {asset.symbol}
                  </div>
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

      {/* Daimo Deposit Modal */}
      <SimpleDaimoModal
        isOpen={isDaimoModalOpen}
        onClose={() => setIsDaimoModalOpen(false)}
        smartAccountAddress={currentRoom?.smart_account_address}
      />
    </div>
  );
};

export default Portfolio;
