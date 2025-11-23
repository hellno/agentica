'use client';

import React, { useState } from 'react';
import { Bot, Shield, Zap, ArrowRight, Smartphone, TrendingUp, Bitcoin, Coins } from 'lucide-react';
import { AuthButton } from '@coinbase/cdp-react';
import { useIsSignedIn, useEvmAddress } from '@coinbase/cdp-hooks';
import { Preferences, RiskLevel, Strategy } from '@/types/trading';
import { createRoom, type CreateRoomResponse } from '@/lib/platform-api';
import { MorphingSquare } from '@/components/molecule-ui/morphing-square';

interface OnboardingProps {
  onComplete: (prefs: Preferences, roomData?: CreateRoomResponse['data']) => void;
}

const STRATEGIES = [
  {
    id: 'btc-dca',
    name: 'Bitcoin DCA',
    description: 'Buy Bitcoin when it goes down and hodl',
    prompt: 'Buy $100 of Bitcoin when the price drops more than 5% from the 7-day average. Hold long-term and never sell. Maximum 3 purchases per week. Keep at least 20% cash reserves.',
    icon: Bitcoin,
    color: 'from-orange-500 to-amber-600',
  },
  {
    id: 'base-trending',
    name: 'Base Momentum',
    description: 'Buy what\'s trending on Base with top traders',
    prompt: 'Monitor trending tokens on Base chain. Buy tokens that show 20%+ volume increase and are being accumulated by wallets with >$100k balance. Set 15% stop loss. Take profit at 30% gains.',
    icon: TrendingUp,
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'vitalik-eth',
    name: 'Vitalik Signal',
    description: 'Buy ETH when Vitalik posts',
    prompt: 'Monitor Vitalik\'s Twitter and Farcaster for posts about Ethereum developments. Buy $50 of ETH within 1 hour of significant technical posts. Hold for minimum 7 days. Maximum 2 purchases per week.',
    icon: Coins,
    color: 'from-purple-500 to-pink-600',
  },
];

const LOADING_MESSAGES = [
  { message: "Analyzing your strategy...", delay: 0 },
  { message: "Generating AI trading agent...", delay: 1500 },
  { message: "Creating secure wallet...", delay: 3000 },
  { message: "Setting up smart account...", delay: 4500 },
  { message: "Finalizing portfolio...", delay: 6000 },
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);

  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();

  // Auto-advance to next step when user signs in
  React.useEffect(() => {
    if (step === 0 && isSignedIn && evmAddress) {
      console.log('[Onboarding] User signed in, advancing to next step');
      setStep(1);
    }
  }, [step, isSignedIn, evmAddress]);

  // Cycle through loading messages
  React.useEffect(() => {
    if (!isCreatingRoom) {
      setLoadingMessageIndex(0);
      setShowSkipButton(false);
      return;
    }

    const timers = LOADING_MESSAGES.map((msg, index) => {
      return setTimeout(() => {
        setLoadingMessageIndex(index);
      }, msg.delay);
    });

    // Show skip button after 8 seconds if room was created
    const skipTimer = setTimeout(() => {
      if (roomCreated) {
        setShowSkipButton(true);
      }
    }, 8000);

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      clearTimeout(skipTimer);
    };
  }, [isCreatingRoom, roomCreated]);

  const nextStep = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setStep(s => s + 1);
  };

  const Step0_SignIn = () => (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)] space-y-8">
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)] space-y-8 text-center max-w-md mx-auto">
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

      <button
        onClick={(e) => {
          e.preventDefault();
          nextStep();
        }}
        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:scale-[1.02] transition-transform"
      >
        Allow Agentica to Manage Trades
      </button>
    </div>
  );

  const handleCreateRoom = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!selectedStrategy || !evmAddress) return;

    setIsCreatingRoom(true);
    setError(null);
    setLoadingMessageIndex(0);

    try {
      const strategy = STRATEGIES.find(s => s.id === selectedStrategy);
      if (!strategy) throw new Error('Strategy not found');

      console.log('[Onboarding] Creating room with strategy:', strategy.name);

      const response = await createRoom({
        user_id: evmAddress, // Use wallet address as user_id
        name: strategy.name,
        description: strategy.description,
        prompt: strategy.prompt,
        frequency: 'daily',
      });

      if (response.success && response.data) {
        console.log('[Onboarding] Room created successfully:', response.data);
        setRoomCreated(true);

        // Create mock preferences for backward compatibility
        const prefs: Preferences = {
          riskLevel: RiskLevel.MEDIUM,
          strategy: Strategy.BALANCED,
          dailyTradeLimit: 3,
          maxInvestmentPerTrade: 50,
        };

        // Auto-proceed to dashboard after showing success
        setTimeout(() => {
          onComplete(prefs, response.data);
        }, 2000);
      } else {
        setIsCreatingRoom(false);
        setRoomCreated(false);
        throw new Error(response.error || 'Failed to create room');
      }
    } catch (err) {
      console.error('[Onboarding] Error creating room:', err);
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsCreatingRoom(false);
    }
  };

  const Step2_SelectStrategy = () => (
    <div className="flex flex-col min-h-[calc(100vh-3rem)] max-w-4xl mx-auto py-6">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Choose Your Trading Strategy</h2>
        <p className="text-slate-500">Select a strategy to get started with AI-powered trading</p>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {STRATEGIES.map((strategy) => {
          const Icon = strategy.icon;
          const isSelected = selectedStrategy === strategy.id;

          return (
            <button
              key={strategy.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setSelectedStrategy(strategy.id);
              }}
              disabled={isCreatingRoom}
              className={`
                group relative overflow-hidden rounded-2xl p-8 text-left transition-all duration-300
                ${isSelected
                  ? 'bg-gradient-to-br ' + strategy.color + ' text-white shadow-2xl scale-105 ring-4 ring-white'
                  : 'bg-white hover:shadow-xl hover:scale-102 border-2 border-slate-200 hover:border-slate-300'
                }
                ${isCreatingRoom ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Icon */}
              <div className={`
                w-16 h-16 rounded-xl flex items-center justify-center mb-4
                ${isSelected ? 'bg-white/20' : 'bg-gradient-to-br ' + strategy.color}
              `}>
                <Icon className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-white'}`} />
              </div>

              {/* Content */}
              <h3 className={`text-xl font-bold mb-2 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                {strategy.name}
              </h3>
              <p className={`text-sm leading-relaxed ${isSelected ? 'text-white/90' : 'text-slate-600'}`}>
                {strategy.description}
              </p>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Continue button */}
      <div className="mt-auto space-y-3">
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={!selectedStrategy || isCreatingRoom}
          className={`
            w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold shadow-lg transition-all
            ${selectedStrategy && !isCreatingRoom
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:scale-102'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {isCreatingRoom ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Creating your portfolio...
            </>
          ) : (
            <>
              Create Portfolio & Start Trading <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* Skip button */}
        {!isCreatingRoom && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              const prefs: Preferences = {
                riskLevel: RiskLevel.MEDIUM,
                strategy: Strategy.BALANCED,
                dailyTradeLimit: 3,
                maxInvestmentPerTrade: 50,
              };
              onComplete(prefs, undefined);
            }}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 relative" style={{ WebkitTapHighlightColor: 'transparent' }}>
      {step === 0 && <Step0_SignIn />}
      {step === 1 && <Step1_Permissions />}
      {step === 2 && <Step2_SelectStrategy />}

      {/* Full-Screen Loading Overlay */}
      {isCreatingRoom && (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 z-50 flex items-center justify-center">
          <div className="text-center space-y-8 px-6 max-w-md">
            {/* Large Loading Spinner */}
            <div className="flex justify-center">
              <MorphingSquare className="h-32 w-32 bg-white" />
            </div>

            {/* Title */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {roomCreated ? '✓ Portfolio Created!' : 'Creating Your Portfolio'}
              </h2>
              <p className="text-white/80">
                {roomCreated ? 'Setting up your dashboard...' : 'This will only take a moment...'}
              </p>
            </div>

            {/* Loading Messages */}
            <div className="space-y-3 min-h-[200px]">
              {LOADING_MESSAGES.map((item, index) => (
                <div
                  key={index}
                  className={`
                    flex items-center gap-3 p-4 rounded-xl transition-all duration-500
                    ${index <= loadingMessageIndex
                      ? 'bg-white/10 backdrop-blur-sm opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4'
                    }
                  `}
                >
                  {index < loadingMessageIndex ? (
                    <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : index === loadingMessageIndex ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></div>
                  ) : (
                    <div className="w-6 h-6 bg-white/20 rounded-full flex-shrink-0"></div>
                  )}
                  <span className="text-white font-medium text-left">{item.message}</span>
                </div>
              ))}
            </div>

            {/* Skip Button - appears when room is created */}
            {roomCreated && (
              <div className="mt-8 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    const prefs: Preferences = {
                      riskLevel: RiskLevel.MEDIUM,
                      strategy: Strategy.BALANCED,
                      dailyTradeLimit: 3,
                      maxInvestmentPerTrade: 50,
                    };
                    onComplete(prefs, undefined);
                  }}
                  className="px-8 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-white/90 transition-all"
                >
                  Go to Dashboard →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
