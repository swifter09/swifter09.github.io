"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Category = "ai" | "article" | "podcast" | "project" | "tech_feed";
type PublishedItem = {
  id: string;
  category: Category;
  title: string;
  summary: string | null;
  url: string;
  source: string | null;
  published_at: string;
};

const labels: Record<Category | "all", string> = {
  all: "全部",
  ai: "AI 新闻",
  article: "技术文章",
  podcast: "播客",
  project: "项目",
  tech_feed: "技术号",
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

export function PublicFeed() {
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [active, setActive] = useState<Category | "all">("all");
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("content_items")
      .select("id,category,title,summary,url,source,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setItems((data as PublishedItem[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(
    () => active === "all" ? items : items.filter((item) => item.category === active),
    [active, items],
  );

  return (
    <>
      <div className="feed-filters" aria-label="内容分类">
        {(Object.keys(labels) as Array<Category | "all">).map((category) => (
          <button
            type="button"
            key={category}
            className={active === category ? "selected" : ""}
            aria-pressed={active === category}
            onClick={() => setActive(category)}
          >
            {labels[category]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="feed-empty"><span className="status-dot" />正在加载内容…</div>
      ) : filtered.length ? (
        <div className="published-grid">
          {filtered.map((item) => (
            <article className="published-card" key={item.id}>
              <div className="published-meta">
                <span>{labels[item.category]}</span>
                <time>{new Date(item.published_at).toLocaleDateString("zh-CN")}</time>
              </div>
              <h3>{item.title}</h3>
              {item.summary && <p>{item.summary}</p>}
              <div className="published-footer">
                <span>{item.source || "字节漫游"}</span>
                <a href={item.url} target="_blank" rel="noreferrer">阅读原文 ↗</a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="feed-empty">
          <span className="status-dot" />
          <div>
            <b>内容正在整理中</b>
            <p>稍后再来看看。</p>
          </div>
        </div>
      )}
    </>
  );
}
