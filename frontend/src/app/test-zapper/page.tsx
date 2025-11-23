"use client";

import { useState } from "react";

export default function TestZapperPage() {
  const [address, setAddress] = useState("0xadcc96b0bd79388ad549edd638a3137587ed07d0");
  const [result, setResult] = useState<any>(null);
  const [swapsResult, setSwapsResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSwaps, setLoadingSwaps] = useState(false);

  async function testZapper() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/test-zapper?address=${address}`);
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function testSwaps() {
    setLoadingSwaps(true);
    setSwapsResult(null);

    try {
      const response = await fetch(`/api/zapper-swaps?address=${address}&timeRange=24h&networks=BASE_MAINNET`);
      const data = await response.json();
      setSwapsResult(data);
    } catch (error) {
      setSwapsResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoadingSwaps(false);
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">🧪 Test Zapper API Only</h1>

      <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="font-semibold text-yellow-800">
          Simple Zapper Test (No AMP)
        </p>
        <p className="text-sm text-yellow-700 mt-2">
          This tests ONLY the Zapper API connection, bypassing AMP entirely.
        </p>
      </div>

      <div className="mb-4">
        <label className="block font-semibold mb-2">Wallet Address:</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
          placeholder="0x..."
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={testZapper}
          disabled={loading}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          {loading ? "Testing..." : "💰 Test Portfolio Balance"}
        </button>

        <button
          onClick={testSwaps}
          disabled={loadingSwaps}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          {loadingSwaps ? "Testing..." : "💱 Test Swap History (24h)"}
        </button>
      </div>

      {loading && (
        <div className="mt-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      )}

      {result && (
        <div className="mt-6">
          {result.success ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-bold">✅ Success!</p>
                <p className="text-sm text-green-700 mt-1">
                  Address: {result.address}
                </p>
                <p className="text-sm text-green-700">
                  Total Balance: ${result.data?.totalBalanceUSD?.toFixed(2) || "0.00"}
                </p>
                <p className="text-sm text-green-700">
                  Total Tokens: {result.data?.byToken?.totalCount || 0}
                </p>
              </div>

              {result.data?.byToken?.edges?.length > 0 && (
                <div className="border rounded-lg">
                  <div className="bg-gray-100 px-4 py-3 font-semibold border-b">
                    💰 Token Balances
                  </div>
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {result.data.byToken.edges.map((edge: any, idx: number) => {
                      const token = edge.node;
                      return (
                        <div key={idx} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {token.imgUrlV2 && (
                                <img
                                  src={token.imgUrlV2}
                                  alt={token.symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                              )}
                              <div>
                                <p className="font-semibold">{token.symbol}</p>
                                <p className="text-xs text-gray-500">{token.name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">
                                ${token.balanceUSD?.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {parseFloat(token.balance).toFixed(4)} {token.symbol}
                              </p>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            <p>Network: {token.network?.name}</p>
                            <p className="font-mono">{token.tokenAddress}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <details className="border rounded-lg">
                <summary className="bg-gray-100 px-4 py-3 font-semibold cursor-pointer">
                  📄 Raw JSON Response
                </summary>
                <pre className="p-4 text-xs overflow-auto max-h-96 bg-gray-50">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-bold mb-2">❌ Error</p>
              {result.errors && (
                <div className="mb-2">
                  <p className="text-sm font-semibold text-red-700">GraphQL Errors:</p>
                  <pre className="text-xs text-red-600 mt-1 overflow-auto">
                    {JSON.stringify(result.errors, null, 2)}
                  </pre>
                </div>
              )}
              {result.error && (
                <p className="text-sm text-red-600">{result.error}</p>
              )}
              <details className="mt-2">
                <summary className="text-xs text-red-700 cursor-pointer">
                  View raw response
                </summary>
                <pre className="text-xs text-red-600 mt-1 overflow-auto max-h-48">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Swaps Result */}
      {swapsResult && (
        <div className="mt-6">
          {swapsResult.success ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-bold">✅ Swap History Success!</p>
                <p className="text-sm text-green-700 mt-1">
                  Address: {swapsResult.address}
                </p>
                <p className="text-sm text-green-700">
                  Found {swapsResult.count} swaps in last {swapsResult.timeRange}
                </p>
              </div>

              {swapsResult.swaps?.length > 0 && (
                <div className="border rounded-lg">
                  <div className="bg-gray-100 px-4 py-3 font-semibold border-b">
                    💱 Recent Swaps ({swapsResult.count})
                  </div>
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {swapsResult.swaps.map((swap: any, idx: number) => (
                      <div key={idx} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">{swap.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(swap.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {swap.appImage && (
                              <img src={swap.appImage} alt={swap.app} className="w-6 h-6 rounded" />
                            )}
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {swap.app}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {swap.tokens.map((token: any, tidx: number) => (
                            <div
                              key={tidx}
                              className={`flex items-center gap-2 text-sm ${
                                token.type === 'sent' ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              <span className="font-mono text-xs">
                                {token.type === 'sent' ? '➡️' : '⬅️'}
                              </span>
                              {token.imageUrl && (
                                <img src={token.imageUrl} alt={token.symbol} className="w-4 h-4 rounded-full" />
                              )}
                              <span className="font-medium">
                                {token.amount} {token.symbol}
                              </span>
                              {token.usdValue && (
                                <span className="text-xs text-gray-500">
                                  (${Math.abs(token.usdValue).toFixed(2)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span>Network: {swap.network}</span>
                          <span className="font-mono">{swap.hash.slice(0, 10)}...</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {swapsResult.count === 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800">
                    No swaps found in the last {swapsResult.timeRange}
                  </p>
                </div>
              )}

              <details className="border rounded-lg">
                <summary className="bg-gray-100 px-4 py-3 font-semibold cursor-pointer">
                  📄 Raw JSON Response
                </summary>
                <pre className="p-4 text-xs overflow-auto max-h-96 bg-gray-50">
                  {JSON.stringify(swapsResult, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-bold mb-2">❌ Error</p>
              {swapsResult.errors && (
                <pre className="text-xs text-red-600 mt-1 overflow-auto">
                  {JSON.stringify(swapsResult.errors, null, 2)}
                </pre>
              )}
              {swapsResult.error && (
                <p className="text-sm text-red-600">{swapsResult.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
