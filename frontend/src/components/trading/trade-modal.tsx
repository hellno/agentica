'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Asset } from '@/types/trading';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (asset: string, amount: number, type: 'BUY' | 'SELL') => void;
  assets: Asset[];
}

const TradeModal: React.FC<TradeModalProps> = ({ isOpen, onClose, onConfirm, assets }) => {
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [amount, setAmount] = useState(50);
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-900">Manual Trade Override</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Type Selection */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setType('BUY')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                type === 'BUY' ? 'bg-green-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setType('SELL')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                type === 'SELL' ? 'bg-red-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Asset Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select Asset</label>
            <div className="grid grid-cols-3 gap-3">
              {assets.map(a => (
                <button
                  key={a.symbol}
                  onClick={() => setSelectedAsset(a.symbol)}
                  className={`p-3 border rounded-xl text-center transition-all ${
                    selectedAsset === a.symbol
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold">{a.symbol}</div>
                  <div className="text-xs text-slate-500">${a.currentPrice.toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 font-medium text-slate-600 hover:bg-slate-200 rounded-xl">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(selectedAsset, amount, type); onClose(); }}
            className="flex-1 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200"
          >
            Confirm Trade
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeModal;
