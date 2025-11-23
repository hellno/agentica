import { useState, useEffect } from 'react';
import { PortfolioState } from '@/types/trading';

interface ZapperTokenBalance {
  symbol: string;
  tokenAddress: string;
  balance: string;
  balanceUSD: number;
  price: number;
  name: string;
  network: {
    name: string;
  };
}

interface ZapperPortfolioResponse {
  success: boolean;
  data?: {
    tokenBalances: {
      totalBalanceUSD: number;
      byToken: {
        edges: Array<{
          node: ZapperTokenBalance;
        }>;
      };
    };
    appBalances: {
      totalBalanceUSD: number;
    };
    nftBalances: {
      totalBalanceUSD: number;
    };
  };
}

const ASSET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f97316', // orange
  '#14b8a6', // teal
];

export function useZapperPortfolio(address: string | undefined) {
  const [portfolio, setPortfolio] = useState<PortfolioState>({
    totalValue: 0,
    cashBalance: 0,
    assets: [],
    history: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      console.log('[useZapperPortfolio] No address provided');
      return;
    }

    const fetchPortfolio = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('[useZapperPortfolio] Fetching portfolio for:', address);

        const response = await fetch(`/api/zapper?address=${address}`);
        const result: ZapperPortfolioResponse = await response.json();

        if (!result.success || !result.data) {
          throw new Error('Failed to fetch portfolio data');
        }

        const { tokenBalances, appBalances, nftBalances } = result.data;

        // Calculate total portfolio value
        const totalValue =
          tokenBalances.totalBalanceUSD +
          appBalances.totalBalanceUSD +
          nftBalances.totalBalanceUSD;

        // Get token balances
        const tokens = tokenBalances.byToken?.edges || [];

        // Find USDC for cash balance
        const usdcToken = tokens.find(
          (edge) => edge.node.symbol === 'USDC' || edge.node.symbol === 'USDC.e'
        );
        const cashBalance = usdcToken?.node.balanceUSD || 0;

        // Create assets array (excluding USDC)
        const assets = tokens
          .filter((edge) => edge.node.symbol !== 'USDC' && edge.node.symbol !== 'USDC.e')
          .filter((edge) => edge.node.balanceUSD > 0.01) // Filter dust
          .slice(0, 6) // Top 6 assets
          .map((edge, index) => ({
            symbol: edge.node.symbol,
            name: edge.node.name,
            amount: parseFloat(edge.node.balance),
            currentPrice: edge.node.price,
            avgBuyPrice: edge.node.price, // Use current price as placeholder (no historical data)
            color: ASSET_COLORS[index % ASSET_COLORS.length],
          }));

        // Create simple history (just current value)
        const history = [
          {
            time: new Date().toISOString(),
            value: totalValue,
          }
        ];

        console.log('[useZapperPortfolio] Portfolio data:', {
          totalValue,
          cashBalance,
          assetsCount: assets.length,
        });

        setPortfolio({
          totalValue,
          cashBalance,
          assets,
          history,
        });
      } catch (err) {
        console.error('[useZapperPortfolio] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();

    // Refresh every 30 seconds
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, [address]);

  return { portfolio, loading, error };
}
