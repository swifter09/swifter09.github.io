"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Category = "ai" | "article" | "podcast" | "project" | "tech_feed";
type PublishedItem = {
  id: string;
  category: Category;
  title: string;
  summary: string | null;
  title_zh: string | null;
  summary_zh: string | null;
  body: string | null;
  url: string | null;
  source: string | null;
  published_at: string | null;
  source_published_at: string | null;
  created_at: string;
  audio_url: string | null;
  duration: string | null;
};
type PublicSource = {
  id: string;
  name: string;
  source_type: string;
  category: Category;
  homepage_url: string | null;
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
  const [sources, setSources] = useState<PublicSource[]>([]);
  const [active, setActive] = useState<Category | "all">("all");
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("content_items")
      .select("id,category,title,summary,title_zh,summary_zh,body,url,source,published_at,source_published_at,created_at,audio_url,duration")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setItems((data as PublishedItem[] | null) ?? []);
        setLoading(false);
      });
    supabase
      .from("sources")
      .select("id,name,source_type,category,homepage_url")
      .eq("enabled", true)
      .not("homepage_url", "is", null)
      .order("name")
      .then(({ data }) => setSources((data as PublicSource[] | null) ?? []));
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
            <article className={`published-card${item.category === "podcast" ? " podcast-episode" : ""}`} key={item.id}>
              <div className="published-meta">
                <span>{labels[item.category]}</span>
                <time>本站上线 {new Date(item.published_at || item.created_at).toLocaleDateString("zh-CN")}</time>
              </div>
              <div className="source-published-time">
                原始发布 {new Date(item.source_published_at || item.created_at).toLocaleString("zh-CN")}
                {!item.source_published_at && " · 来源未提供时间"}
              </div>
              <h3>{item.title_zh || item.title}</h3>
              {(item.summary_zh || item.summary) && <p>{item.summary_zh || item.summary}</p>}
              {item.category === "podcast" && item.audio_url && (
                <div className="episode-player">
                  {item.duration && <span>时长 {item.duration}</span>}
                  <audio controls preload="none" src={item.audio_url}>
                    你的浏览器不支持音频播放。
                  </audio>
                </div>
              )}
              <div className="published-footer">
                <span>{item.source || "字节漫游"}</span>
                {item.category === "podcast" && item.url
                  ? <a href={item.url} target="_blank" rel="noreferrer">单集详情 ↗</a>
                  : <a href={`/article/?id=${item.id}`}>站内阅读 →</a>}
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

      {active === "tech_feed" && (
        <section className="public-sources" aria-labelledby="source-directory-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SOURCE / DIRECTORY</p>
              <h2 id="source-directory-title">持续关注的技术号</h2>
            </div>
          </div>
          <p className="source-intro">这些是本站候选内容的抓取来源；文章只有经过我的阅读与审核后，才会进入“技术文章”精选。</p>
          <div className="public-source-grid">
            {sources.map((source) => (
              <a key={source.id} href={source.homepage_url!} target="_blank" rel="noreferrer">
                <span>{source.source_type}</span>
                <b>{source.name}</b>
                <i>访问来源 ↗</i>
              </a>
            ))}
          </div>
        </section>
      )}

      {active === "podcast" && (
        <section className="public-sources" aria-labelledby="podcast-directory-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PODCAST / SUBSCRIPTIONS</p>
              <h2 id="podcast-directory-title">持续收听的播客</h2>
            </div>
          </div>
          <p className="source-intro">订阅源会定时收集新单集；只有你在后台听过并批准的内容，才会在上方出现并支持站内播放。</p>
          <div className="public-source-grid">
            {sources.filter((source) => source.category === "podcast").map((source) => (
              <a key={source.id} href={source.homepage_url!} target="_blank" rel="noreferrer">
                <span>PODCAST</span>
                <b>{source.name}</b>
                <i>节目主页 ↗</i>
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
