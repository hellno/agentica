"use client";

import { useState } from "react";

/**
 * Example component showing how to create a portfolio room
 *
 * Integration pattern:
 * 1. User fills form with strategy prompt
 * 2. Submit → POST /api/platform/rooms (Next.js proxy)
 * 3. Next.js proxy → POST Modal /rooms with user_id
 * 4. Modal orchestrates: AI strategy generation → wallet creation → ElizaOS room
 *
 * Auth: Replace user_id="test-user" with your auth provider's user ID
 */

interface CreateRoomResponse {
  success: boolean;
  data?: {
    room_id: string;
    eliza_room_id: string;
    wallet_address: string;
    smart_account_address: string;
    generated_strategy: string;
    strategy_agent_id: string;
  };
  error?: string;
}

export default function CreateRoomForm() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    prompt: "",
    frequency: "daily",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateRoomResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // TODO: Replace with your auth provider's user ID
      // Example: const userId = await getAuthenticatedUserId();
      const userId = "test-user"; // REPLACE THIS

      // Call Next.js proxy API (NOT direct Modal URL)
      const response = await fetch("/api/platform/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId, // Injected by proxy from auth
          name: formData.name,
          description: formData.description,
          prompt: formData.prompt,
          frequency: formData.frequency,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({ success: true, data: data.data });
      } else {
        setResult({
          success: false,
          error: data.error || "Failed to create room",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Create Portfolio Room</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Room Name */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Room Name
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black"
              placeholder="Conservative BTC DCA"
              required
              minLength={3}
              maxLength={100}
            />
          </label>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black"
              placeholder="A conservative Bitcoin accumulation strategy"
              rows={3}
              maxLength={500}
            />
          </label>
        </div>

        {/* Strategy Prompt */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Trading Strategy
            <textarea
              value={formData.prompt}
              onChange={(e) =>
                setFormData({ ...formData, prompt: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black"
              placeholder="Buy $100 of BTC every week when price is below $95k. Keep at least 20% cash reserves. If portfolio drops 30%, stop trading."
              rows={5}
              required
              minLength={10}
              maxLength={1000}
            />
          </label>
          <p className="text-sm text-gray-500 mt-1">
            Describe your trading strategy in natural language. AI will generate
            a structured prompt with safety guardrails.
          </p>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Trading Frequency
            <select
              value={formData.frequency}
              onChange={(e) =>
                setFormData({ ...formData, frequency: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="on market moves">On Market Moves</option>
            </select>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating Room..." : "Create Portfolio Room"}
        </button>
      </form>

      {/* Result Display */}
      {result && (
        <div
          className={`mt-6 p-4 rounded-md ${
            result.success
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          {result.success && result.data ? (
            <div className="space-y-2">
              <h3 className="font-semibold text-green-800">
                Room Created Successfully!
              </h3>
              <div className="text-sm space-y-1 text-green-900">
                <p>
                  <strong>Room ID:</strong> {result.data.room_id}
                </p>
                <p>
                  <strong>Wallet Address:</strong>{" "}
                  {result.data.wallet_address}
                </p>
                <p>
                  <strong>Smart Account:</strong>{" "}
                  {result.data.smart_account_address}
                </p>
                <p>
                  <strong>Strategy Agent ID:</strong>{" "}
                  {result.data.strategy_agent_id}
                </p>
                <div className="mt-4">
                  <strong>Generated Strategy:</strong>
                  <pre className="mt-2 p-3 bg-green-100 rounded text-xs overflow-auto max-h-48 text-green-950">
                    {result.data.generated_strategy}
                  </pre>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Next Steps:</strong>
                </p>
                <ol className="text-sm text-blue-900 mt-2 space-y-1 list-decimal list-inside">
                  <li>
                    Fund your wallet by sending USDC to{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      {result.data.wallet_address}
                    </code>
                  </li>
                  <li>Your AI agent will start monitoring markets</li>
                  <li>
                    View transactions at{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      /api/platform/wallets/{result.data.room_id}/transactions
                    </code>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-sm text-red-900">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
