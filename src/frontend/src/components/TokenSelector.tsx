import React, { useState, useRef, useEffect } from "react";
import { useTokenSearch, useTokenUniverse } from "../hooks/useQueries";
import type { UnifiedToken } from "../types/tokenUniverse";

interface TokenSelectorProps {
  onSelect: (token: UnifiedToken) => void;
  placeholder?: string;
  excludeAddress?: string;
  selectedToken?: UnifiedToken | null;
}

function formatPrice(p: number | null): string {
  if (p == null) return "";
  if (p >= 1000)
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.001) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(2)}`;
}

export function TokenSelector({
  onSelect,
  placeholder = "Search tokens...",
  excludeAddress,
  selectedToken,
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const universe = useTokenUniverse();
  const { isLoading } = universe;
  const searchResults = useTokenSearch(query);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const tokens = (query.trim() ? searchResults : universe.tokens)
    .filter((t) => t.address !== excludeAddress)
    .slice(0, 60);

  function handleSelect(token: UnifiedToken) {
    onSelect(token);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger / selected display */}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left"
        style={{
          background: "#12121a",
          borderColor: open ? "#00f5ff" : "#1e1e2e",
          color: selectedToken ? "#e2e8f0" : "#64748b",
          boxShadow: open ? "0 0 0 1px #00f5ff40" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        {selectedToken ? (
          <span className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "#1e1e2e", color: "#00f5ff", flexShrink: 0 }}
            >
              {selectedToken.symbol.slice(0, 2)}
            </span>
            <span className="font-semibold" style={{ color: "#00f5ff" }}>
              {selectedToken.symbol}
            </span>
            {selectedToken.priceUsd != null && (
              <span className="text-xs" style={{ color: "#64748b" }}>
                {formatPrice(selectedToken.priceUsd)}
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: "#64748b" }}>{placeholder}</span>
        )}
        <svg
          role="img"
          aria-label="Toggle dropdown"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            color: "#64748b",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg border overflow-hidden"
          style={{
            background: "#12121a",
            borderColor: "#00f5ff",
            boxShadow: "0 0 20px #00f5ff20",
            maxHeight: "320px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search input */}
          <div
            className="px-3 pt-2 pb-1 border-b"
            style={{ borderColor: "#1e1e2e" }}
          >
            <div className="flex items-center gap-2">
              <svg
                role="img"
                aria-label="Search"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, symbol, or canister ID..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#e2e8f0", caretColor: "#00f5ff" }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  style={{ color: "#64748b" }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Token list */}
          <div className="overflow-y-auto flex-1">
            {isLoading && tokens.length === 0 ? (
              <div className="flex flex-col gap-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded animate-pulse"
                    style={{ background: "#1e1e2e" }}
                  />
                ))}
              </div>
            ) : tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <svg
                  role="img"
                  aria-label="No results"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="text-sm" style={{ color: "#475569" }}>
                  {query
                    ? `No tokens found matching "${query}"`
                    : "No tokens available"}
                </span>
                {!query && (
                  <span className="text-xs" style={{ color: "#334155" }}>
                    Token data is loading...
                  </span>
                )}
              </div>
            ) : (
              tokens.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => handleSelect(token)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#1e1e2e]"
                  style={{ color: "#e2e8f0" }}
                >
                  {/* Avatar */}
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: "#0a0a0f",
                      border: "1px solid #1e1e2e",
                      color: "#00f5ff",
                    }}
                  >
                    {token.symbol.slice(0, 2)}
                  </span>

                  {/* Name + canisterId */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-semibold text-sm"
                        style={{ color: "#00f5ff" }}
                      >
                        {token.symbol}
                      </span>
                      <span
                        className="text-xs truncate"
                        style={{ color: "#64748b" }}
                      >
                        {token.name}
                      </span>
                    </div>
                    <div
                      className="text-xs truncate"
                      style={{ color: "#334155" }}
                    >
                      {token.address}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    {token.priceUsd != null ? (
                      <>
                        <div
                          className="text-sm font-medium"
                          style={{ color: "#e2e8f0" }}
                        >
                          {formatPrice(token.priceUsd)}
                        </div>
                        {token.priceChange24h != null && (
                          <div
                            className="text-xs"
                            style={{
                              color:
                                token.priceChange24h >= 0
                                  ? "#00ff88"
                                  : "#ff3366",
                            }}
                          >
                            {token.priceChange24h >= 0 ? "▲" : "▼"}{" "}
                            {Math.abs(token.priceChange24h).toFixed(1)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs" style={{ color: "#334155" }}>
                        —
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="px-3 py-1 border-t text-xs"
            style={{ borderColor: "#1e1e2e", color: "#334155" }}
          >
            {tokens.length} token{tokens.length !== 1 ? "s" : ""}
            {universe?.fetchedAt
              ? ` · updated ${new Date(universe.fetchedAt).toLocaleTimeString()}`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenSelector;
