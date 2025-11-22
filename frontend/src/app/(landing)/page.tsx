'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Onboarding from '@/components/trading/onboarding';
import Portfolio from '@/components/trading/portfolio';
import NewsFeed from '@/components/trading/news-feed';
import ThoughtProcess from '@/components/trading/thought-process';
import ActivityFeed from '@/components/trading/activity-feed';
import TradeModal from '@/components/trading/trade-modal';
import { Preferences, PortfolioState, Trade, Thought } from '@/types/trading';
import { INITIAL_ASSETS, INITIAL_CASH, MOCK_NEWS, DEFAULT_PREFERENCES } from '@/lib/trading-constants';
import { Bell, Menu, Settings, Sliders } from 'lucide-react';

export default function Page() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  // Portfolio State
  const [portfolio, setPortfolio] = useState<PortfolioState>({
    totalValue: 0,
    cashBalance: INITIAL_CASH,
    assets: INITIAL_ASSETS,
    history: []
  });

  // Feeds State
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  // UI State
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [executingTradeId, setExecutingTradeId] = useState<string | null>(null);

  // Initialize Portfolio Value
  useEffect(() => {
    const assetValue = portfolio.assets.reduce((acc, curr) => acc + (curr.amount * curr.currentPrice), 0);
    const total = assetValue + portfolio.cashBalance;

    setPortfolio(prev => ({
      ...prev,
      totalValue: total,
      history: [...prev.history, { time: new Date().toISOString(), value: total }]
    }));
  }, []);

  const addThought = (message: string, action: Thought['action'] = 'ANALYZING') => {
    const newThought: Thought = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      message,
      action
    };
    setThoughts(prev => [...prev, newThought]);
  };

  const executeTrade = (assetSymbol: string, amountUSD: number, type: 'BUY' | 'SELL', reason: string = "Manual override") => {
    setExecutingTradeId(Math.random().toString());

    setTimeout(() => {
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === assetSymbol);
      if (assetIndex === -1) return;

      const currentPrice = portfolio.assets[assetIndex].currentPrice;
      const assetAmount = amountUSD / currentPrice;

      const newTrade: Trade = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        asset: assetSymbol,
        amount: parseFloat(assetAmount.toFixed(4)),
        price: currentPrice,
        total: amountUSD,
        timestamp: new Date(),
        status: 'COMPLETED'
      };

      // Update Portfolio
      setPortfolio(prev => {
        const newAssets = [...prev.assets];
        let newCash = prev.cashBalance;

        if (type === 'BUY') {
          if (prev.cashBalance < amountUSD) {
            addThought(`Cannot buy ${assetSymbol}. Insufficient cash.`, 'WAITING');
            setExecutingTradeId(null);
            return prev;
          }
          newAssets[assetIndex].amount += assetAmount;
          newCash -= amountUSD;
        } else {
          if (newAssets[assetIndex].amount * currentPrice < amountUSD) {
             addThought(`Cannot sell ${assetSymbol}. Insufficient balance.`, 'WAITING');
             setExecutingTradeId(null);
             return prev;
          }
          newAssets[assetIndex].amount -= assetAmount;
          newCash += amountUSD;
        }

        const newTotalAssetValue = newAssets.reduce((acc, curr) => acc + (curr.amount * curr.currentPrice), 0);

        return {
          ...prev,
          assets: newAssets,
          cashBalance: newCash,
          totalValue: newTotalAssetValue + newCash,
          history: [...prev.history, { time: new Date().toISOString(), value: newTotalAssetValue + newCash }]
        };
      });

      setTrades(prev => [...prev, newTrade]);
      addThought(`Executed ${type} for $${amountUSD} of ${assetSymbol}. ${reason}`, 'TRADING');
      setExecutingTradeId(null);

    }, 1500);
  };

  // Demo: Add initial thought
  useEffect(() => {
    if (isOnboarded && thoughts.length === 0) {
      addThought("Agentica initialized. Monitoring markets...", 'ANALYZING');
    }
  }, [isOnboarded]);

  if (!isOnboarded) {
    return <Onboarding onComplete={(prefs) => { setPreferences(prefs); setIsOnboarded(true); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">A</span>
             </div>
             <span className="text-xl font-bold tracking-tight text-slate-900">Agentica</span>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setIsTradeModalOpen(true)} className="hidden md:block px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
                Manual Trade
             </button>
             <button className="p-2 hover:bg-slate-100 rounded-full relative">
                <Bell className="w-5 h-5 text-slate-600" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
             </button>
             <button className="p-2 hover:bg-slate-100 rounded-full">
                <Settings className="w-5 h-5 text-slate-600" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: News & Portfolio */}
          <div className="lg:col-span-2 space-y-8">
             <NewsFeed news={MOCK_NEWS} />
             <Portfolio data={portfolio} />
             <div className="block lg:hidden">
               <ThoughtProcess thoughts={thoughts} />
             </div>
             <ActivityFeed trades={trades} />
          </div>

          {/* Right Column: AI Brain (Sticky on Desktop) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24 space-y-8">
              <ThoughtProcess thoughts={thoughts} />

              {/* Quick Actions Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                 <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Sliders className="w-4 h-4" /> Agent Controls
                 </h3>
                 <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                       <span className="text-slate-500">Mode</span>
                       <span className="font-medium text-indigo-600">{preferences.strategy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                       <span className="text-slate-500">Risk</span>
                       <span className="font-medium text-amber-500">{preferences.riskLevel}</span>
                    </div>
                    <button
                      onClick={() => setIsTradeModalOpen(true)}
                      className="w-full py-3 mt-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                       Override Agent
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Execution Spinner Overlay */}
      {executingTradeId && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-slate-900">Executing Trade...</h3>
            <p className="text-slate-500">Interacting with exchange</p>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-6 right-6 lg:hidden">
         <button
          onClick={() => setIsTradeModalOpen(true)}
          className="w-14 h-14 bg-indigo-600 rounded-full shadow-xl shadow-indigo-300 flex items-center justify-center text-white"
         >
            <Menu className="w-6 h-6" />
         </button>
      </div>

      <TradeModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onConfirm={(asset, amount, type) => executeTrade(asset, amount, type)}
        assets={portfolio.assets}
      />
    </div>
  );
}
