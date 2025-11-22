export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export enum Strategy {
  MOMENTUM = 'Momentum',
  SAFE = 'Safe',
  BALANCED = 'Balanced',
}

export interface Preferences {
  riskLevel: RiskLevel;
  strategy: Strategy;
  dailyTradeLimit: number;
  maxInvestmentPerTrade: number;
}

export interface Asset {
  symbol: string;
  name: string;
  amount: number;
  currentPrice: number;
  avgBuyPrice: number;
  color: string;
}

export interface PortfolioState {
  totalValue: number;
  cashBalance: number;
  assets: Asset[];
  history: { time: string; value: number }[];
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  asset: string;
  amount: number;
  price: number;
  total: number;
  timestamp: Date;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  profit?: number;
}

export interface Thought {
  id: string;
  timestamp: Date;
  message: string;
  action?: 'ANALYZING' | 'TRADING' | 'WAITING';
}
