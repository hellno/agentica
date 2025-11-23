'use client';

import { DaimoPayButton } from '@daimo/pay';
import { baseUSDC } from '@daimo/pay-common';
import { X, Copy, Check } from 'lucide-react';
import { getAddress } from 'viem';
import { useState } from 'react';

interface SimpleDaimoModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartAccountAddress: string | undefined;
}

export default function SimpleDaimoModal({
  isOpen,
  onClose,
  smartAccountAddress,
}: SimpleDaimoModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!smartAccountAddress) return;

    try {
      await navigator.clipboard.writeText(smartAccountAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  if (!isOpen || !smartAccountAddress) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Deposit Funds
            </h2>
            <p className="text-sm text-slate-600">
              Deposit from any chain. Funds will be bridged to your strategy on Base.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Daimo Pay Button */}
            <div className="[&>button]:!w-full [&>button]:!bg-indigo-600 [&>button]:!hover:bg-indigo-700 [&>button]:!text-white [&>button]:!font-medium [&>button]:!py-3 [&>button]:!px-4 [&>button]:!rounded-lg [&>button]:!transition-colors [&>button]:!border-0 [&>button]:h-full">
              <DaimoPayButton
                appId="pay-demo"
                refundAddress={getAddress(smartAccountAddress)}
                toAddress={getAddress(smartAccountAddress)}
                toChain={baseUSDC.chainId}
                toToken={getAddress(baseUSDC.token)}
                toUnits="1.00"
                intent="Deposit"
                onPaymentStarted={(e) => {
                  console.log('[Daimo Pay] Payment started:', e);
                }}
                onPaymentCompleted={(e) => {
                  console.log('[Daimo Pay] Payment completed:', e);
                  setTimeout(() => {
                    onClose();
                  }, 2000);
                }}
              />
            </div>

            {/* Copy Wallet Address Button */}
            <button
              onClick={handleCopyAddress}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors border-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
