"use client";

import { useState, useEffect } from "react";
import {
  createRoom,
  getRooms,
  executeWalletAction,
  getWalletTransactions,
  type Room,
  type WalletTransaction,
} from "@/lib/platform-api";

type TabType = "agents" | "rooms" | "wallets";

interface ApiResponse {
  status: "idle" | "loading" | "success" | "error";
  data?: any;
  error?: string;
  timestamp?: string;
  duration?: number;
}

export default function AdminPage() {
  // User ID state (persisted to localStorage)
  const [userId, setUserId] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("rooms");

  // API response states
  const [agentsResponse, setAgentsResponse] = useState<ApiResponse>({
    status: "idle",
  });
  const [roomsResponse, setRoomsResponse] = useState<ApiResponse>({
    status: "idle",
  });
  const [walletResponse, setWalletResponse] = useState<ApiResponse>({
    status: "idle",
  });

  // Form states
  const [createRoomForm, setCreateRoomForm] = useState({
    name: "",
    description: "",
    prompt: "",
    frequency: "daily",
  });
  const [createAgentForm, setCreateAgentForm] = useState({
    name: "",
    description: "",
  });
  const [selectedRoomId, setSelectedRoomId] = useState("");

  // Load userId from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("admin_user_id");
    if (saved) setUserId(saved);
  }, []);

  // Save userId to localStorage on change
  const handleUserIdChange = (value: string) => {
    setUserId(value);
    localStorage.setItem("admin_user_id", value);
  };

  // API call wrapper with timing
  const callApi = async (
    fn: () => Promise<any>,
    setResponse: (r: ApiResponse) => void
  ) => {
    const startTime = Date.now();
    setResponse({ status: "loading" });

    try {
      const data = await fn();
      const duration = Date.now() - startTime;
      setResponse({
        status: "success",
        data,
        timestamp: new Date().toISOString(),
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      setResponse({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        duration,
      });
    }
  };

  // Platform API Calls
  const handleGetRooms = () => {
    if (!userId) {
      setRoomsResponse({
        status: "error",
        error: "User ID is required",
      });
      return;
    }

    callApi(async () => {
      const response = await fetch(`/api/platform/rooms?user_id=${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch rooms");
      }
      return await response.json();
    }, setRoomsResponse);
  };

  const handleCreateRoom = () => {
    if (!userId) {
      setRoomsResponse({
        status: "error",
        error: "User ID is required",
      });
      return;
    }

    callApi(async () => {
      const response = await fetch("/api/platform/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ...createRoomForm,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create room");
      }
      return await response.json();
    }, setRoomsResponse);
  };

  const handleGetAgents = () => {
    if (!userId) {
      setAgentsResponse({
        status: "error",
        error: "User ID is required",
      });
      return;
    }

    callApi(async () => {
      const response = await fetch(`/api/platform/agents?user_id=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch agents");
      return await response.json();
    }, setAgentsResponse);
  };

  const handleCreateAgent = () => {
    if (!userId) {
      setAgentsResponse({
        status: "error",
        error: "User ID is required",
      });
      return;
    }

    callApi(async () => {
      const response = await fetch("/api/platform/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ...createAgentForm,
        }),
      });
      if (!response.ok) throw new Error("Failed to create agent");
      return await response.json();
    }, setAgentsResponse);
  };

  const handleGetWalletBalance = () => {
    if (!selectedRoomId) {
      setWalletResponse({ status: "error", error: "Select a room first" });
      return;
    }

    callApi(async () => {
      const response = await fetch(
        `/api/platform/wallets/${selectedRoomId}/balance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params: {} }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get balance");
      }
      return await response.json();
    }, setWalletResponse);
  };

  const handleGetTransactions = () => {
    if (!selectedRoomId) {
      setWalletResponse({ status: "error", error: "Select a room first" });
      return;
    }

    callApi(async () => {
      const response = await fetch(
        `/api/platform/rooms/${selectedRoomId}/transactions?limit=50&offset=0`
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get transactions");
      }
      return await response.json();
    }, setWalletResponse);
  };

  // Response Display Component
  const ResponseDisplay = ({ response }: { response: ApiResponse }) => {
    if (response.status === "idle") return null;

    const statusConfig = {
      loading: {
        bg: "bg-blue-500/10 dark:bg-blue-500/20",
        border: "border-blue-500/20",
        text: "text-blue-700 dark:text-blue-400",
      },
      success: {
        bg: "bg-green-500/10 dark:bg-green-500/20",
        border: "border-green-500/20",
        text: "text-green-700 dark:text-green-400",
      },
      error: {
        bg: "bg-red-500/10 dark:bg-red-500/20",
        border: "border-red-500/20",
        text: "text-red-700 dark:text-red-400",
      },
    };

    const config = statusConfig[response.status];

    return (
      <div className={`mt-4 p-4 rounded-lg border ${config.bg} ${config.border}`}>
        <div className="flex justify-between items-start mb-2">
          <span className={`font-semibold ${config.text}`}>
            {response.status === "loading"
              ? "Loading..."
              : response.status === "success"
                ? "Success"
                : "Error"}
          </span>
          {response.duration && (
            <span className="text-sm text-muted-foreground">{response.duration}ms</span>
          )}
        </div>

        {response.error && <p className={`text-sm mb-2 ${config.text}`}>{response.error}</p>}

        {response.data && (
          <div className="mt-2">
            <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-96 font-mono text-foreground border border-border">
              {JSON.stringify(response.data, null, 2)}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  JSON.stringify(response.data, null, 2)
                );
              }}
              className="mt-2 text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              Copy JSON
            </button>
          </div>
        )}

        {response.timestamp && (
          <p className="text-xs mt-2 text-muted-foreground">{response.timestamp}</p>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Admin Test Panel</h1>

      {/* User ID Configuration */}
      <div className="bg-card border border-border p-4 rounded-lg mb-6">
        <label className="block text-sm font-medium mb-2 text-foreground">
          User ID (for testing)
        </label>
        <input
          type="text"
          value={userId}
          onChange={(e) => handleUserIdChange(e.target.value)}
          placeholder="test-user-123"
          className="w-full px-3 py-2 bg-background border border-input rounded-md font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Persisted to localStorage • Used for all API requests
        </p>
      </div>

      {/* Environment Info */}
      <div className="bg-card border border-border p-4 rounded-lg mb-6">
        <div className="font-semibold mb-2 text-foreground">Environment Configuration</div>
        <div className="space-y-1 font-mono text-xs text-muted-foreground">
          <div>
            <span className="opacity-60">PLATFORM_API:</span>{" "}
            <span className="text-foreground">{process.env.NEXT_PUBLIC_PLATFORM_API_URL || "Not set"}</span>
          </div>
          <div>
            <span className="opacity-60">ELIZA_SERVER:</span>{" "}
            <span className="text-foreground">{process.env.NEXT_PUBLIC_SERVER_URL || "Not set"}</span>
          </div>
          <div>
            <span className="opacity-60">AGENT_ID:</span>{" "}
            <span className="text-foreground">{process.env.NEXT_PUBLIC_AGENT_ID || "Not set"}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex space-x-4">
          {(["agents", "rooms", "wallets"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Tab */}
      {activeTab === "agents" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Get Agents</h2>
            <button
              onClick={handleGetAgents}
              disabled={!userId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              GET /api/platform/agents
            </button>
            <ResponseDisplay response={agentsResponse} />
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Create Agent</h2>
            <div className="space-y-3 max-w-md">
              <input
                type="text"
                placeholder="Agent Name (3-50 chars)"
                value={createAgentForm.name}
                onChange={(e) =>
                  setCreateAgentForm({ ...createAgentForm, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <textarea
                placeholder="Description (10-500 chars)"
                value={createAgentForm.description}
                onChange={(e) =>
                  setCreateAgentForm({
                    ...createAgentForm,
                    description: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
              />
              <button
                onClick={handleCreateAgent}
                disabled={!userId || !createAgentForm.name || !createAgentForm.description}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                POST /api/platform/agents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === "rooms" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Get Rooms</h2>
            <button
              onClick={handleGetRooms}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              GET /api/platform/rooms
            </button>
            <ResponseDisplay response={roomsResponse} />

            {/* Room Cards Display */}
            {roomsResponse.status === "success" &&
              roomsResponse.data?.rooms && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {(roomsResponse.data.rooms as Room[]).map((room) => (
                    <div
                      key={room.id}
                      className="border border-border rounded-lg p-4 bg-card hover:bg-accent transition-colors"
                    >
                      <h3 className="font-semibold text-lg mb-2 text-foreground">{room.name}</h3>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Status:</span>{" "}
                          <span
                            className={
                              room.status === "active"
                                ? "text-green-600 dark:text-green-400"
                                : "text-muted-foreground"
                            }
                          >
                            {room.status}
                          </span>
                        </div>
                        <div className="font-mono text-xs">
                          <span className="font-medium text-foreground">Wallet:</span>{" "}
                          {room.wallet_address ? (
                            `${room.wallet_address.slice(0, 10)}...`
                          ) : (
                            <span className="text-muted-foreground italic">Not configured</span>
                          )}
                        </div>
                        <div className="font-mono text-xs">
                          <span className="font-medium text-foreground">Smart Account:</span>{" "}
                          {room.smart_account_address ? (
                            `${room.smart_account_address.slice(0, 10)}...`
                          ) : (
                            <span className="text-muted-foreground italic">Not configured</span>
                          )}
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="font-medium text-foreground">Frequency:</span>{" "}
                          {room.frequency}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Create Room</h2>
            <div className="space-y-3 max-w-md">
              <input
                type="text"
                placeholder="Room Name"
                value={createRoomForm.name}
                onChange={(e) =>
                  setCreateRoomForm({ ...createRoomForm, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={createRoomForm.description}
                onChange={(e) =>
                  setCreateRoomForm({
                    ...createRoomForm,
                    description: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <textarea
                placeholder="Trading Strategy Prompt (10-1000 chars)"
                value={createRoomForm.prompt}
                onChange={(e) =>
                  setCreateRoomForm({ ...createRoomForm, prompt: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={4}
              />
              <select
                value={createRoomForm.frequency}
                onChange={(e) =>
                  setCreateRoomForm({
                    ...createRoomForm,
                    frequency: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="on market moves">On Market Moves</option>
              </select>
              <button
                onClick={handleCreateRoom}
                disabled={!userId || !createRoomForm.name || !createRoomForm.prompt}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                POST /api/platform/rooms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallets Tab */}
      {activeTab === "wallets" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Select Room</h2>
            <div className="max-w-md">
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md mb-4 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Select a room --</option>
                {roomsResponse.status === "success" &&
                  roomsResponse.data?.rooms &&
                  (roomsResponse.data.rooms as Room[]).map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} ({room.id.slice(0, 8)}...)
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted-foreground mb-4">
                Fetch rooms first from the Rooms tab
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Wallet Actions</h2>
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleGetTransactions}
                  disabled={!selectedRoomId}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Get Transactions
                </button>
                <button
                  disabled={true}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-md cursor-not-allowed opacity-50"
                  title="Coming soon"
                >
                  Get Balance (Coming Soon)
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                💡 Wallet balance and transfer actions are in development. Use transaction history to view activity.
              </p>
            </div>
            <ResponseDisplay response={walletResponse} />
          </div>
        </div>
      )}
    </div>
  );
}
