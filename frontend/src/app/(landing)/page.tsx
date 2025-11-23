'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Onboarding from '@/components/trading/onboarding';
import Portfolio from '@/components/trading/portfolio';
import ActivityFeed from '@/components/trading/activity-feed';
import TradeModal from '@/components/trading/trade-modal';
import RoomSelector from '@/components/trading/room-selector';
import StrategyChat from '@/components/trading/strategy-chat';
import { Preferences, PortfolioState, Trade } from '@/types/trading';
import { Bell, Menu, LogOut, Wallet } from 'lucide-react';
import { CDPReactProvider } from "@coinbase/cdp-react";
import { useEvmAddress, useSignOut } from '@coinbase/cdp-hooks';
import { getRooms, type Room } from '@/lib/platform-api';
import { MorphingSquare } from '@/components/molecule-ui/morphing-square';

// Separate component for dashboard that uses CDP hooks
function TradingDashboard({
  preferences,
  setPreferences,
  portfolio,
  setPortfolio,
  trades,
  isTradeModalOpen,
  setIsTradeModalOpen,
  executingTradeId,
  executeTrade
}: any) {
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();

  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Fetch user's rooms when wallet is connected
  useEffect(() => {
    if (evmAddress && !isLoadingRooms && rooms.length === 0) {
      const fetchRooms = async () => {
        setIsLoadingRooms(true);
        try {
          const userRooms = await getRooms(evmAddress);
          console.log('[TradingDashboard] Fetched rooms:', userRooms);

          // Ensure userRooms is an array
          const roomsArray = Array.isArray(userRooms) ? userRooms : [];
          setRooms(roomsArray);

          // Set current room to the first one if available
          if (roomsArray.length > 0 && !currentRoom) {
            setCurrentRoom(roomsArray[0]);
            console.log('[TradingDashboard] Set current room:', roomsArray[0].name);
          }
        } catch (error) {
          console.error('[TradingDashboard] Error fetching rooms:', error);
          setRooms([]); // Set empty array on error
        } finally {
          setIsLoadingRooms(false);
        }
      };

      fetchRooms();
    }
  }, [evmAddress, isLoadingRooms, rooms.length, currentRoom]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">A</span>
               </div>
               <span className="text-xl font-bold tracking-tight text-slate-900">Agentica</span>
             </div>

             {/* Room Selector */}
             <div className="hidden md:flex items-center pl-4 border-l border-slate-200">
               <RoomSelector
                 rooms={rooms}
                 currentRoom={currentRoom}
                 onRoomChange={setCurrentRoom}
                 isLoading={isLoadingRooms}
               />
             </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setIsTradeModalOpen(true)} className="hidden md:block px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
                Manual Trade
             </button>
             <button className="p-2 hover:bg-slate-100 rounded-full relative">
                <Bell className="w-5 h-5 text-slate-600" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
             </button>

             {/* User Profile Section */}
             {evmAddress && (
               <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                 <div className="hidden md:flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                   <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                     <Wallet className="w-4 h-4 text-white" />
                   </div>
                   <div className="flex flex-col">
                     <span className="text-xs text-slate-500">Wallet</span>
                     <span className="text-sm font-mono font-semibold text-slate-900">
                       {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
                     </span>
                   </div>
                 </div>
                 <button
                   onClick={() => signOut()}
                   className="p-2 hover:bg-red-50 rounded-full text-slate-600 hover:text-red-600 transition-colors"
                   title="Sign Out"
                 >
                   <LogOut className="w-5 h-5" />
                 </button>
               </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Strategy Chat */}
          <StrategyChat room={currentRoom} userEntity={evmAddress || ''} />

          {/* Portfolio and Activity Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Portfolio data={portfolio} />
            <ActivityFeed trades={trades} />
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

export default function Page() {

  const [isOnboarded, setIsOnboarded] = useState(false);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  // Portfolio State - will be fetched from wallet API
  const [portfolio, setPortfolio] = useState<PortfolioState>({
    totalValue: 0,
    cashBalance: 0,
    assets: [],
    history: []
  });

  // Feeds State
  const [trades, setTrades] = useState<Trade[]>([]);

  // UI State
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [executingTradeId, setExecutingTradeId] = useState<string | null>(null);

  const executeTrade = (assetSymbol: string, amountUSD: number, type: 'BUY' | 'SELL', reason: string = "Manual override") => {
    // TODO: Implement real trade execution via wallet API
    console.log(`Execute ${type} trade:`, { assetSymbol, amountUSD, reason });
    setExecutingTradeId(null);
  };

  return (
    <CDPReactProvider
      config={{
        projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID || '',
        appName: 'Agentica',
        ethereum: {
          createOnLogin: 'smart',
        },
      }}
    >
      {!isOnboarded ? (
        <Onboarding onComplete={(prefs, roomData) => {
          setPreferences(prefs);
          setIsOnboarded(true);

          // Room will be automatically fetched by TradingDashboard
          if (roomData) {
            console.log('[Page] Room created during onboarding:', roomData);
          }
        }} />
      ) : (
        <TradingDashboard
          preferences={preferences}
          setPreferences={setPreferences}
          portfolio={portfolio}
          setPortfolio={setPortfolio}
          trades={trades}
          isTradeModalOpen={isTradeModalOpen}
          setIsTradeModalOpen={setIsTradeModalOpen}
          executingTradeId={executingTradeId}
          executeTrade={executeTrade}
        />
      )}
    </CDPReactProvider>
  );
}
