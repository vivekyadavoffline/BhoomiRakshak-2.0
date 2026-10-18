import React, { useState } from "react";
import { ArrowLeft, ExternalLink, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../services/apiConfig";

function buildSourceCards(rawResults) {
  const text =
    typeof rawResults === "string"
      ? rawResults
      : JSON.stringify(rawResults, null, 2);
  const firstSource = text.search(/\n\s*1\.\s/);
  const sourceText = firstSource >= 0 ? text.slice(firstSource + 1) : text;
  return sourceText
    .split(/\n(?=\d+\.\s)/)
    .filter(Boolean)
    .slice(0, 8)
    .map((section) => {
      const lines = section
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const title = (lines.shift() || "Live source").replace(/^\d+\.\s*/, "");
      const urlIndex = lines.findIndex((line) => /^https?:\/\//i.test(line));
      const url = urlIndex >= 0 ? lines.splice(urlIndex, 1)[0] : "";
      return { title, url, summary: lines.join(" ").slice(0, 260) };
    });
}

export default function TinyFishIntel() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("latest disaster risk updates in India");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (event) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(buildApiUrl("/api/tinyfish/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `Bhoomi Rakshak project research only: ${cleanQuery}`,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.detail || "TinyFish search failed");
      const cards = buildSourceCards(payload.results);
      setResult({ cards, query: cleanQuery });
    } catch (searchError) {
      setResult(null);
      setError(searchError.message || "TinyFish search failed");
    } finally {
      setLoading(false);
    }
  };

  const cards = result?.cards || [];

  return (
    <main
      className="tinyfish-page"
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(145deg, #fffdf8 0%, #fff8e8 52%, #f7efe0 100%)",
        color: "#3d2b16",
        padding: "24px clamp(16px, 5vw, 72px) 60px",
      }}
    >
      <header
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            border: "1px solid #d7ad4d",
            background: "#fff",
            color: "#7b5310",
            borderRadius: 8,
            padding: "9px 12px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          <ArrowLeft size={15} /> Back to console
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#96701d",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#21a875",
              boxShadow: "0 0 0 4px rgba(33,168,117,.14)",
            }}
          />{" "}
          TinyFish connected
        </div>
      </header>

      <section style={{ maxWidth: 1180, margin: "58px auto 0" }}>
        <div style={{ maxWidth: 720 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "#a16e12",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            <Sparkles size={14} /> Bhoomi Rakshak Web Intelligence
          </div>
          <h1
            style={{
              margin: "14px 0 10px",
              color: "#17365d",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(32px, 5vw, 62px)",
              lineHeight: 1.02,
              letterSpacing: "-.03em",
            }}
          >
            Live evidence for better disaster decisions.
          </h1>
          <p
            style={{
              margin: 0,
              color: "#796d5e",
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            Search the live web for project-relevant hazard, weather,
            evacuation, relocation, resilience, and India-wide disaster
            intelligence.
          </p>
        </div>

        <form
          onSubmit={search}
          style={{
            marginTop: 34,
            display: "flex",
            gap: 10,
            maxWidth: 900,
            padding: 8,
            border: "1px solid #dfbd68",
            borderRadius: 14,
            background: "rgba(255,255,255,.82)",
            boxShadow: "0 14px 34px rgba(144,102,25,.12)",
          }}
        >
          <Search
            size={19}
            color="#a16e12"
            style={{ margin: "12px 0 0 8px", flex: "0 0 auto" }}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="TinyFish project research query"
            placeholder="Ask about disaster risk, relocation, or this project..."
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 0,
              background: "transparent",
              color: "#17365d",
              padding: "10px 4px",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              border: "1px solid #e4bd57",
              borderRadius: 9,
              padding: "0 18px",
              background: "linear-gradient(135deg,#ffe9a8,#c89525 58%,#8e5b0d)",
              color: "#33230a",
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 6px 16px rgba(154,103,16,.24)",
            }}
          >
            {loading ? "Researching..." : "Search"}
          </button>
        </form>

        {error && (
          <div
            style={{
              marginTop: 14,
              maxWidth: 900,
              padding: "12px 14px",
              borderRadius: 9,
              color: "#9f2638",
              background: "#fff0f1",
              border: "1px solid #efb1b9",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <section style={{ marginTop: 28, maxWidth: 1000 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                { value: cards.length, label: "Relevant sources" },
                { value: "LIVE", label: "Freshness" },
                { value: "PAN-INDIA", label: "Project scope" },
              ].map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    padding: "14px 16px",
                    border: "1px solid #ead39b",
                    borderRadius: 10,
                    background: "#fff",
                    boxShadow: "0 5px 16px rgba(144,102,25,.07)",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "#a16e12",
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 22,
                    }}
                  >
                    {metric.value}
                  </strong>
                  <span
                    style={{
                      color: "#89775c",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                    }}
                  >
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                marginBottom: 12,
                color: "#80601b",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".08em",
              }}
            >
              Research matrix{" "}
              <span
                style={{
                  color: "#aa9a7c",
                  fontWeight: 500,
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                for “{result.query}”
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {cards.map((card, index) => (
                <article
                  key={`${card.title}-${index}`}
                  style={{
                    padding: 16,
                    border: "1px solid #ead39b",
                    borderRadius: 12,
                    background: "rgba(255,255,255,.9)",
                    boxShadow: "0 8px 22px rgba(144,102,25,.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "0 0 auto",
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: "#fff1c2",
                        color: "#a16e12",
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h2
                        style={{
                          margin: 0,
                          color: "#17365d",
                          fontSize: 14,
                          lineHeight: 1.35,
                        }}
                      >
                        {card.title}
                      </h2>
                      {card.url && (
                        <a
                          href={card.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 5,
                            color: "#a16e12",
                            fontSize: 10,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {card.url} <ExternalLink size={10} />
                        </a>
                      )}
                      <p
                        style={{
                          margin: "9px 0 0",
                          color: "#796d5e",
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {card.summary ||
                          "Relevant live source for the Bhoomi Rakshak project."}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
