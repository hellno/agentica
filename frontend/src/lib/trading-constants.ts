import { Asset, NewsItem, RiskLevel, Strategy } from '@/types/trading';

export const DEFAULT_PREFERENCES = {
  riskLevel: RiskLevel.MEDIUM,
  strategy: Strategy.BALANCED,
  dailyTradeLimit: 3,
  maxInvestmentPerTrade: 50,
};

export const INITIAL_ASSETS: Asset[] = [
  { symbol: 'BTC', name: 'Bitcoin', amount: 0.05, currentPrice: 65000, avgBuyPrice: 62000, color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', amount: 1.2, currentPrice: 3500, avgBuyPrice: 3200, color: '#627EEA' },
  { symbol: 'SOL', name: 'Solana', amount: 15, currentPrice: 145, avgBuyPrice: 110, color: '#14F195' },
];

export const MOCK_NEWS: NewsItem[] = [
  { id: '1', headline: "Bitcoin ETF sees record inflows as institutions double down.", source: "CryptoDaily", timestamp: "10m ago", sentiment: 'positive' },
  { id: '2', headline: "Fed signals potential rate cut next quarter, boosting risk assets.", source: "GlobalFinance", timestamp: "30m ago", sentiment: 'positive' },
  { id: '3', headline: "Minor network congestion reported on Ethereum mainnet.", source: "TechBlock", timestamp: "1h ago", sentiment: 'neutral' },
  { id: '4', headline: "Regulatory uncertainty in Asia causes short-term dip.", source: "AsiaMarkets", timestamp: "2h ago", sentiment: 'negative' },
];

export const INITIAL_CASH = 1000;
