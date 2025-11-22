'use client';

import React, { useState } from 'react';
import { Bot, Shield, Zap, ArrowRight, Smartphone, Mail } from 'lucide-react';
import { AuthButton } from '@coinbase/cdp-react/components/AuthButton';
import { useIsSignedIn, useEvmAddress } from '@coinbase/cdp-hooks';
import { Preferences, RiskLevel, Strategy } from '@/types/trading';

interface OnboardingProps {
  onComplete: (prefs: Preferences) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>({
    riskLevel: RiskLevel.MEDIUM,
    strategy: Strategy.BALANCED,
    dailyTradeLimit: 3,
    maxInvestmentPerTrade: 50,
  });

  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();

  // Auto-advance to next step when user signs in
  React.useEffect(() => {
    if (step === 0 && isSignedIn && evmAddress) {
      console.log('[Onboarding] User signed in, advancing to next step');
      setStep(1);
    }
  }, [step, isSignedIn, evmAddress]);

  const nextStep = () => setStep(s => s + 1);

  const Step0_SignIn = () => (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)] space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-200">
          <Bot className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Welcome to Agentica</h1>
        <p className="text-slate-500">Let&apos;s get you started with automated AI trading.</p>
      </div>

      <div className="w-full max-w-sm flex justify-center">
        {isSignedIn && evmAddress ? (
          <div className="flex flex-col items-center gap-4 p-6 bg-green-50 border border-green-200 rounded-xl w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-900">Wallet Connected!</p>
                <p className="text-xs text-green-600 font-mono">
                  {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <AuthButton />
          </div>
        )}
      </div>
    </div>
  );

  const Step1_Permissions = () => (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)] space-y-8 text-center max-w-md mx-auto animate-fade-in">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-400 blur-2xl opacity-20 rounded-full"></div>
        <Shield className="w-24 h-24 text-indigo-600 relative z-10" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">Agentica Will Trade for You</h2>
        <p className="text-slate-500 mt-2">
          Agentica will scan the market 24/7 and execute trades based on real-time data and news sentiment.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 w-full text-left space-y-4">
        <div className="flex gap-4">
          <Zap className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <h3 className="font-semibold text-slate-800">Automated Execution</h3>
            <p className="text-sm text-slate-500">Trades happen instantly when signals align.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Smartphone className="w-6 h-6 text-blue-500 shrink-0" />
          <div>
            <h3 className="font-semibold text-slate-800">Always In Control</h3>
            <p className="text-sm text-slate-500">Pause or override Agentica at any time.</p>
          </div>
        </div>
      </div>

      <button onClick={nextStep} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:scale-[1.02] transition-transform">
        Allow Agentica to Manage Trades
      </button>
    </div>
  );

  const Step2_Preferences = () => (
    <div className="flex flex-col min-h-[calc(100vh-3rem)] max-w-lg mx-auto animate-fade-in py-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Set Your Preferences</h2>
        <p className="text-slate-500">How should Agentica trade for you?</p>
      </div>

      <div className="space-y-8 flex-1 overflow-y-auto px-1">
        {/* Risk Level */}
        <div className="space-y-3">
          <label className="font-semibold text-slate-700 flex justify-between">
            Risk Level <span className="text-indigo-600">{prefs.riskLevel}</span>
          </label>
          <input
            type="range"
            min="0" max="2" step="1"
            className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            value={prefs.riskLevel === RiskLevel.LOW ? 0 : prefs.riskLevel === RiskLevel.MEDIUM ? 1 : 2}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setPrefs({...prefs, riskLevel: val === 0 ? RiskLevel.LOW : val === 1 ? RiskLevel.MEDIUM : RiskLevel.HIGH})
            }}
          />
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>Safe</span>
            <span>Balanced</span>
            <span>Aggressive</span>
          </div>
        </div>

        {/* Strategy */}
        <div className="space-y-3">
          <label className="font-semibold text-slate-700">Trading Strategy</label>
          <div className="grid grid-cols-3 gap-3">
            {Object.values(Strategy).map((s) => (
              <button
                key={s}
                onClick={() => setPrefs({...prefs, strategy: s})}
                className={`p-3 rounded-xl text-sm font-medium border transition-all ${
                  prefs.strategy === s
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Trade Limits */}
        <div className="space-y-3">
          <label className="font-semibold text-slate-700">Daily Trade Limit</label>
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-slate-600">Trades per day</span>
            <input
              type="number"
              value={prefs.dailyTradeLimit}
              onChange={(e) => setPrefs({...prefs, dailyTradeLimit: parseInt(e.target.value)})}
              className="w-20 text-right p-2 bg-slate-50 rounded-lg font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Investment Amount */}
        <div className="space-y-3">
          <label className="font-semibold text-slate-700">Max Investment Per Trade</label>
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-slate-600">USD Amount</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">$</span>
              <input
                type="number"
                value={prefs.maxInvestmentPerTrade}
                onChange={(e) => setPrefs({...prefs, maxInvestmentPerTrade: parseInt(e.target.value)})}
                className="w-20 text-right p-2 bg-slate-50 rounded-lg font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={() => onComplete(prefs)}
          className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
        >
          Save Preferences & Proceed <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {step === 0 && <Step0_SignIn />}
      {step === 1 && <Step1_Permissions />}
      {step === 2 && <Step2_Preferences />}
    </div>
  );
};

export default Onboarding;
