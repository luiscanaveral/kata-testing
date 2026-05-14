"use client";

import { useState, FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [longUrl, setLongUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setShortUrl("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ long_url: longUrl }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to shorten URL");
      }
      const data = await res.json();
      setShortUrl(data.short_url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(shortUrl);
  }

  return (
    <main style={{ maxWidth: 480, width: "100%", padding: 16 }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 8, textAlign: "center" }}>
          URL Shortener
        </h1>
        <p style={{ color: "#666", marginBottom: 24, textAlign: "center" }}>
          Paste a long URL to get a short one
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="url"
            placeholder="https://example.com/very/long/url"
            value={longUrl}
            onChange={(e) => setLongUrl(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontSize: 16,
              marginBottom: 16,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#999" : "#1677ff",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Shortening..." : "Shorten URL"}
          </button>
        </form>

        {error && (
          <p style={{ color: "#ff4d4f", marginTop: 16, textAlign: "center" }}>
            {error}
          </p>
        )}

        {shortUrl && (
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: "#f6ffed",
              border: "1px solid #b7eb8f",
              borderRadius: 8,
            }}
          >
            <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
              Short URL:
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  color: "#1677ff",
                  fontSize: 18,
                  wordBreak: "break-all",
                }}
              >
                {shortUrl}
              </a>
              <button
                onClick={copyToClipboard}
                style={{
                  padding: "8px 16px",
                  background: "#1677ff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
