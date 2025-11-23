"use client";

import { useState } from "react";

export default function TestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [senderDetails, setSenderDetails] = useState<any>(null);
  const [loadingSender, setLoadingSender] = useState(false);

  async function runTest() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedSender(null);
    setSenderDetails(null);

    try {
      console.log("📤 Calling swap-traders API...");
      const response = await fetch("/api/swap-traders?limit=100&includeZapper=true");
      const data = await response.json();

      if (data.success) {
        console.log("✅ Success:", data);
        setResult(data);
      } else {
        setError(data.error || "Query failed");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSenderDetails(sender: string) {
    setLoadingSender(true);
    setSenderDetails(null);
    setSelectedSender(sender);

    try {
      console.log("🔍 Fetching details for sender:", sender);
      const response = await fetch("/api/swap-traders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender }),
      });

      const data = await response.json();
      if (data.success) {
        setSenderDetails(data);
      }
    } catch (err) {
      console.error("❌ Error fetching sender:", err);
    } finally {
      setLoadingSender(false);
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Swap Traders Dashboard</h1>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <p className="font-semibold mb-2">AMP + Zapper Integration</p>
        <p className="text-sm text-gray-700">
          1. Fetch swap events from The Graph AMP (Uniswap V3 Base)
          <br />
          2. Extract trader addresses
          <br />
          3. Get their portfolio data from Zapper API
        </p>
      </div>

      <button
        onClick={runTest}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
      >
        {loading ? "Fetching Data..." : "🚀 Fetch Swap Traders + Zapper Data"}
      </button>

      {loading && (
        <div className="mt-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-bold mb-2">❌ Error:</p>
          <p className="text-red-600 text-sm font-mono">{error}</p>
        </div>
      )}

      {result && result.success && (
        <div className="mt-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-600">Total Swaps</p>
              <p className="text-2xl font-bold text-green-800">
                {result.stats.totalSwaps}
              </p>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-gray-600">Unique Traders</p>
              <p className="text-2xl font-bold text-purple-800">
                {result.stats.uniqueSenders}
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-600">Zapper Data Fetched</p>
              <p className="text-2xl font-bold text-blue-800">
                {result.stats.zapperFetched}
              </p>
            </div>
          </div>

          {/* Traders List */}
          <div className="border rounded-lg">
            <div className="bg-gray-100 px-4 py-3 font-semibold border-b">
              👥 Unique Trader Addresses ({result.data.senders.length})
            </div>
            <div className="max-h-64 overflow-y-auto">
              {result.data.senders.slice(0, 20).map((sender: string, idx: number) => (
                <div
                  key={idx}
                  className="px-4 py-3 border-b hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="font-mono text-sm">{sender}</span>
                  <button
                    onClick={() => fetchSenderDetails(sender)}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
            {result.data.senders.length > 20 && (
              <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 text-center border-t">
                Showing 20 of {result.data.senders.length} traders
              </div>
            )}
          </div>

          {/* Zapper Data */}
          {result.data.zapperData && (
            <div className="border rounded-lg">
              <div className="bg-gray-100 px-4 py-3 font-semibold border-b">
                💰 Zapper Portfolio Data (Top 10 Traders)
              </div>
              <div className="p-4">
                <pre className="text-xs overflow-auto max-h-64 bg-gray-50 p-4 rounded">
                  {JSON.stringify(result.data.zapperData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Sample Swap Events */}
          <div className="border rounded-lg">
            <div className="bg-gray-100 px-4 py-3 font-semibold border-b">
              🔄 Recent Swap Events (First 3)
            </div>
            <div className="p-4">
              <pre className="text-xs overflow-auto max-h-64 bg-gray-50 p-4 rounded">
                {JSON.stringify(result.data.swapEvents.slice(0, 3), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Sender Details Modal/Section */}
      {selectedSender && (
        <div className="mt-6 border-2 border-blue-500 rounded-lg">
          <div className="bg-blue-100 px-4 py-3 font-semibold border-b flex items-center justify-between">
            <span>🔍 Details for: {selectedSender}</span>
            <button
              onClick={() => {
                setSelectedSender(null);
                setSenderDetails(null);
              }}
              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>

          {loadingSender && (
            <div className="p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {senderDetails && senderDetails.success && (
            <div className="p-4 space-y-4">
              <div className="p-3 bg-green-50 rounded">
                <p className="font-semibold text-green-800">
                  Total Swaps: {senderDetails.stats.totalSwaps}
                </p>
              </div>

              {senderDetails.data.zapperData && (
                <div>
                  <p className="font-semibold mb-2">💰 Zapper Portfolio:</p>
                  <pre className="text-xs overflow-auto max-h-48 bg-gray-50 p-4 rounded">
                    {JSON.stringify(senderDetails.data.zapperData, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <p className="font-semibold mb-2">🔄 Swap Events:</p>
                <pre className="text-xs overflow-auto max-h-48 bg-gray-50 p-4 rounded">
                  {JSON.stringify(senderDetails.data.swapEvents, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
