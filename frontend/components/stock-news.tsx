"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Panel } from "@/components/ui";

type Article = { title: string; description: string; url: string; source: string; published_at: string; image: string };

const TOPICS = ["NSE stock market India", "BSE Sensex Nifty", "Indian stocks trading"];

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function StockNews() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState(0);

  async function load(t: number) {
    setLoading(true);
    try {
      const res = await api.news(TOPICS[t]);
      setArticles(res.articles);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(topic); const t = setInterval(() => load(topic), 5 * 60 * 1000); return () => clearInterval(t); }, [topic]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium">Live Market News</h2>
        <div className="flex gap-2">
          {TOPICS.map((t, i) => (
            <button key={i} onClick={() => setTopic(i)}
              className={`rounded-full border px-3 py-1 text-xs transition ${topic === i ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-text"}`}>
              {["NSE/BSE", "Sensex/Nifty", "Stocks"][i]}
            </button>
          ))}
        </div>
      </div>

      {loading && articles.length === 0 ? (
        <Panel><p className="text-sm text-muted">Loading news...</p></Panel>
      ) : articles.length === 0 ? (
        <Panel><p className="text-sm text-muted">No news available.</p></Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="group rounded-2xl border border-border bg-panel/90 p-4 shadow-panel backdrop-blur hover:border-accent/50 transition flex flex-col gap-2">
              {a.image && (
                <img src={a.image} alt="" className="w-full h-36 object-cover rounded-xl mb-1" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
              <p className="text-sm font-medium leading-snug group-hover:text-accent transition line-clamp-2">{a.title}</p>
              {a.description && <p className="text-xs text-muted line-clamp-2">{a.description}</p>}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border text-xs text-muted">
                <span>{a.source}</span>
                <span>{timeAgo(a.published_at)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
