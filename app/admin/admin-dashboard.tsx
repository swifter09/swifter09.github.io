"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";

type Status = "draft" | "review" | "published";
type Category = "ai" | "article" | "podcast" | "project" | "tech_feed";
type Item = {
  id: string;
  category: Category;
  title: string;
  summary: string | null;
  title_zh: string | null;
  summary_zh: string | null;
  body: string | null;
  url: string | null;
  source: string | null;
  status: Status;
  created_at: string;
  published_at: string | null;
  source_published_at: string | null;
  audio_url: string | null;
  duration: string | null;
};

const categoryLabels: Record<Category, string> = {
  ai: "AI 新闻",
  article: "技术文章",
  podcast: "播客",
  project: "项目",
  tech_feed: "技术号",
};
type ReviewModule = "content" | "media" | "build" | "source";
const reviewModules: Record<ReviewModule, { label: string; categories: Category[] }> = {
  content: { label: "内容阅读", categories: ["ai", "article"] },
  media: { label: "音频节目", categories: ["podcast"] },
  build: { label: "项目作品", categories: ["project"] },
  source: { label: "技术来源", categories: ["tech_feed"] },
};
const statusLabels: Record<Status | "all", string> = {
  all: "全部状态",
  review: "待审核",
  draft: "草稿",
  published: "已发布",
};
type Source = {
  id: string;
  name: string;
  source_type: "rss" | "podcast" | "github" | "wechat" | "manual";
  category: string;
  feed_url: string | null;
  homepage_url: string | null;
  enabled: boolean;
  last_fetched_at: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { flowType: "pkce" } })
  : null;

function isOwner(session: Session | null) {
  const meta = session?.user.user_metadata ?? {};
  return meta.user_name === "swifter09" || meta.preferred_username === "swifter09";
}

function reviewItemKey(item: Item) {
  if (item.category === "project") return `project:${item.source || item.id}`;
  return `${item.source || ""}:${item.category}:${item.title.trim().toLocaleLowerCase().replace(/\s+/g, " ")}`;
}

const statusPriority: Record<Status, number> = { published: 0, review: 1, draft: 2 };
function itemTimestamp(item: Item) {
  return new Date(item.source_published_at || item.created_at).getTime();
}

export function AdminDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewModule, setReviewModule] = useState<ReviewModule>("content");
  const [reviewCategory, setReviewCategory] = useState<Category | "all">("all");
  const [reviewStatus, setReviewStatus] = useState<Status | "all">("review");
  const [visibleLimit, setVisibleLimit] = useState(20);

  const deduplicatedItems = useMemo(() => {
    const unique = new Map<string, Item>();
    for (const item of items) {
      const key = reviewItemKey(item);
      const current = unique.get(key);
      if (
        !current
        || (item.category === "project" && itemTimestamp(item) > itemTimestamp(current))
        || (item.category !== "project" && statusPriority[item.status] < statusPriority[current.status])
      ) unique.set(key, item);
    }
    return [...unique.values()];
  }, [items]);
  const moduleItems = useMemo(
    () => deduplicatedItems.filter((item) => reviewModules[reviewModule].categories.includes(item.category)),
    [deduplicatedItems, reviewModule],
  );
  const filteredItems = useMemo(
    () => moduleItems.filter((item) =>
      (reviewCategory === "all" || item.category === reviewCategory)
      && (reviewStatus === "all" || item.status === reviewStatus)
    ),
    [moduleItems, reviewCategory, reviewStatus],
  );
  const visibleItems = filteredItems.slice(0, visibleLimit);

  function selectReviewModule(module: ReviewModule) {
    setReviewModule(module);
    setReviewCategory("all");
    setVisibleLimit(20);
  }

  async function loadItems() {
    if (!supabase) return;
    const { data, error } = await supabase.from("content_items").select("*").order("created_at", { ascending: false });
    if (error) {
      setMessage(`读取审核队列失败：${error.message}`);
      return;
    }
    setItems((data as Item[] | null) ?? []);
  }

  async function loadSources() {
    if (!supabase) return;
    const { data, error } = await supabase.from("sources").select("*").order("created_at", { ascending: false });
    if (error) {
      setMessage(`读取来源失败：${error.message}`);
      return;
    }
    setSources((data as Source[] | null) ?? []);
  }

  useEffect(() => {
    if (!supabase) { setReady(true); return; }

    async function restoreSession() {
      const { data } = await supabase!.auth.getSession();
      setSession(data.session);
      setReady(true);
    }

    restoreSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isOwner(session)) {
      loadItems();
      loadSources();
    }
  }, [session]);

  async function signIn() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/admin/` },
    });
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      category: form.get("category"),
      title: form.get("title"),
      summary: form.get("summary"),
      body: form.get("body"),
      url: String(form.get("url") || "").trim() || null,
      source: form.get("source"),
      status: "draft",
    };
    const { error } = await supabase.from("content_items").insert(payload);
    setMessage(error ? error.message : "已保存为草稿");
    if (!error) {
      event.currentTarget.reset();
      await loadItems();
    }
  }

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const sourceType = String(form.get("source_type"));
    const feedUrl = String(form.get("feed_url") || "").trim();
    const payload = {
      name: form.get("name"),
      source_type: sourceType,
      category: form.get("category"),
      feed_url: feedUrl || null,
      homepage_url: String(form.get("homepage_url") || "").trim() || null,
      enabled: true,
      requires_review: true,
    };
    const { error } = await supabase.from("sources").insert(payload);
    setMessage(error ? error.message : sourceType === "wechat"
      ? "公众号已加入来源名单；文章通过候选内容表单提交"
      : "来源已保存，将在下一次定时任务中抓取");
    if (!error) {
      event.currentTarget.reset();
      await loadSources();
    }
  }

  async function toggleSource(source: Source) {
    if (!supabase) return;
    const { error } = await supabase.from("sources").update({ enabled: !source.enabled }).eq("id", source.id);
    setMessage(error ? error.message : `${source.name} 已${source.enabled ? "暂停" : "启用"}`);
    if (!error) await loadSources();
  }

  async function setStatus(id: string, status: Status) {
    if (!supabase) return;
    const changes = status === "published"
      ? { status, published_at: new Date().toISOString() }
      : { status };
    const { error } = await supabase.from("content_items").update(changes).eq("id", id);
    setMessage(error ? error.message : `状态已更新为：${status}`);
    if (!error) await loadItems();
  }

  async function setCategory(id: string, category: Category) {
    if (!supabase) return;
    const { error } = await supabase.from("content_items").update({ category }).eq("id", id);
    setMessage(error ? error.message : `分类已更新为：${categoryLabels[category]}`);
    if (!error) await loadItems();
  }

  async function editItem(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const changes = {
      category: form.get("category"),
      title: form.get("title"),
      summary: form.get("summary"),
      body: form.get("body"),
      url: String(form.get("url") || "").trim() || null,
      source: String(form.get("source") || "").trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("content_items").update(changes).eq("id", id);
    setMessage(error ? error.message : "内容修改已保存，发布状态未改变");
    if (!error) await loadItems();
  }

  if (!ready) return <main className="admin-shell"><p>正在验证身份…</p></main>;

  if (!supabase) {
    return (
      <main className="admin-shell admin-denied">
        <p className="eyebrow">ADMIN / SETUP REQUIRED</p>
        <h1>后台尚未连接</h1>
        <p>公开网站已可部署；配置 Supabase 环境变量后，GitHub 登录和内容审核会在这里启用。</p>
        <a href="/">← 返回首页</a>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="admin-shell admin-login">
        <p className="eyebrow">PRIVATE / AUTHOR ONLY</p>
        <h1>作者后台</h1>
        <p>使用 GitHub 验证身份。只有账号 swifter09 可以读取和管理内容。</p>
        <button type="button" className="admin-primary" onClick={signIn}>使用 GitHub 登录</button>
        <a href="/">← 返回首页</a>
      </main>
    );
  }

  if (!isOwner(session)) {
    return (
      <main className="admin-shell admin-denied">
        <p className="eyebrow">404 / NOT FOUND</p>
        <h1>页面不存在</h1>
        <a href="/">返回首页</a>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="eyebrow">PRIVATE / SWIFTER09</p><h1>内容审核台</h1></div>
        <button type="button" onClick={() => supabase.auth.signOut()}>退出登录</button>
      </header>

      {message && <p className="admin-message admin-flash">{message}</p>}

      <section className="admin-grid">
        <form className="editor-form" onSubmit={createItem}>
          <h2>添加候选内容</h2>
          <label>分类<select name="category" required>
            <option value="ai">AI 新闻</option><option value="article">技术文章</option>
            <option value="podcast">播客</option><option value="project">项目</option>
            <option value="tech_feed">技术号</option>
          </select></label>
          <label>标题<input name="title" required /></label>
          <label>摘要<textarea name="summary" rows={4} /></label>
          <label>正文（可选，适合 Codex 对话整理稿）<textarea name="body" rows={10} /></label>
          <label>原文链接（自有文章可留空）<input name="url" type="url" /></label>
          <label>来源
            <select name="source" defaultValue="">
              <option value="">手动填写 / 未指定</option>
              <option value="Codex 对话整理">Codex 对话整理</option>
              {sources.map((source) => <option key={source.id} value={source.name}>{source.name}</option>)}
            </select>
          </label>
          <button className="admin-primary" type="submit">保存为草稿</button>
        </form>

        <div className="review-list">
          <div className="review-list-heading">
            <div>
              <h2>审核队列</h2>
              <p>{filteredItems.length} 条符合当前筛选</p>
            </div>
            <span>{deduplicatedItems.filter((item) => item.status === "review").length} 条待审核</span>
          </div>

          <div className="review-filters" aria-label="审核队列分类">
            <div className="review-filter-level">
              <span>大模块</span>
              <div>
                {(Object.keys(reviewModules) as ReviewModule[]).map((module) => {
                  const count = deduplicatedItems.filter((item) =>
                    reviewModules[module].categories.includes(item.category)
                    && (reviewStatus === "all" || item.status === reviewStatus)
                  ).length;
                  return (
                    <button type="button" key={module}
                      className={reviewModule === module ? "active" : ""}
                      aria-pressed={reviewModule === module}
                      onClick={() => selectReviewModule(module)}>
                      {reviewModules[module].label}<b>{count}</b>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="review-filter-level">
              <span>子模块</span>
              <div>
                <button type="button" className={reviewCategory === "all" ? "active" : ""}
                  aria-pressed={reviewCategory === "all"}
                  onClick={() => { setReviewCategory("all"); setVisibleLimit(20); }}>
                  全部<b>{moduleItems.filter((item) => reviewStatus === "all" || item.status === reviewStatus).length}</b>
                </button>
                {reviewModules[reviewModule].categories.map((category) => (
                  <button type="button" key={category}
                    className={reviewCategory === category ? "active" : ""}
                    aria-pressed={reviewCategory === category}
                    onClick={() => { setReviewCategory(category); setVisibleLimit(20); }}>
                    {categoryLabels[category]}
                    <b>{moduleItems.filter((item) =>
                      item.category === category && (reviewStatus === "all" || item.status === reviewStatus)
                    ).length}</b>
                  </button>
                ))}
              </div>
            </div>
            <div className="review-filter-level review-status-filter">
              <span>状态</span>
              <div>
                {(Object.keys(statusLabels) as Array<Status | "all">).map((status) => (
                  <button type="button" key={status}
                    className={reviewStatus === status ? "active" : ""}
                    aria-pressed={reviewStatus === status}
                    onClick={() => { setReviewStatus(status); setVisibleLimit(20); }}>
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {visibleItems.length ? visibleItems.map((item) => (
            <article key={item.id}>
              <div><span>{item.category}</span><b>{item.status}</b></div>
              <div className="review-source">
                <span>来源</span>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.source || "未标明来源"} ↗
                  </a>
                ) : (
                  <b>{item.source || "未标明来源"}</b>
                )}
              </div>
              <div className="review-dates">
                <time>来源发布：{new Date(item.source_published_at || item.created_at).toLocaleString("zh-CN")}</time>
                {!item.source_published_at && <small>来源未提供时间，显示收录时间</small>}
                {item.published_at && <time>本站上线：{new Date(item.published_at).toLocaleString("zh-CN")}</time>}
              </div>
              <h3>{item.category === "project" ? item.source || item.title : item.title_zh || item.title}</h3>
              {(item.summary_zh || item.summary) && <p>{item.summary_zh || item.summary}</p>}
              {item.category === "podcast" && item.audio_url && (
                <div className="admin-audio">
                  {item.duration && <span>时长 {item.duration}</span>}
                  <audio controls preload="none" src={item.audio_url}>
                    你的浏览器不支持音频播放。
                  </audio>
                </div>
              )}
              {item.title_zh && (
                <details className="original-copy">
                  <summary>查看英文标题与摘要</summary>
                  <h4>{item.title}</h4>
                  {item.summary && <p>{item.summary}</p>}
                </details>
              )}
              {item.category === "project" ? (
                <a
                  href={sources.find((source) => source.name === item.source)?.homepage_url || item.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  访问项目主页 ↗
                </a>
              ) : (
                <>
                  {item.url && <a href={item.url} target="_blank" rel="noreferrer">检查原文 ↗</a>}
                  <a href={`/article/?id=${item.id}&review=1`}>阅读全文并审核 →</a>
                </>
              )}
              <details className="item-editor">
                <summary>编辑内容</summary>
                <form className="inline-editor" onSubmit={(event) => editItem(event, item.id)}>
                  <label>分类<select name="category" defaultValue={item.category}>
                    {(Object.keys(categoryLabels) as Category[]).map((category) => (
                      <option key={category} value={category}>{categoryLabels[category]}</option>
                    ))}
                  </select></label>
                  <label>标题<input name="title" defaultValue={item.title} required /></label>
                  <label>摘要<textarea name="summary" rows={4} defaultValue={item.summary || ""} /></label>
                  <label>正文<textarea name="body" rows={12} defaultValue={item.body || ""} /></label>
                  <label>原文链接<input name="url" type="url" defaultValue={item.url || ""} /></label>
                  <label>来源<input name="source" defaultValue={item.source || ""} /></label>
                  <button type="submit" className="admin-primary">保存修改</button>
                </form>
              </details>
              <label className="review-category">内容分类
                <select value={item.category} onChange={(event) => setCategory(item.id, event.target.value as Category)}>
                  {(Object.keys(categoryLabels) as Category[]).map((category) => (
                    <option key={category} value={category}>{categoryLabels[category]}</option>
                  ))}
                </select>
              </label>
              <div className="review-actions">
                <button type="button" onClick={() => setStatus(item.id, "draft")}>草稿</button>
                <button type="button" onClick={() => setStatus(item.id, "review")}>待审核</button>
                <button type="button" className="approve" onClick={() => setStatus(item.id, "published")}>批准发布</button>
              </div>
            </article>
          )) : <div className="review-empty"><b>当前分组没有内容</b><p>可以切换子模块或状态查看其他内容。</p></div>}
          {visibleItems.length < filteredItems.length && (
            <button type="button" className="review-load-more" onClick={() => setVisibleLimit((limit) => limit + 20)}>
              再显示 20 条 · 剩余 {filteredItems.length - visibleItems.length} 条
            </button>
          )}
        </div>
      </section>

      <section className="sources-admin">
        <form className="editor-form source-form" onSubmit={createSource}>
          <div>
            <p className="eyebrow">SOURCE REGISTRY</p>
            <h2>添加数据来源</h2>
            <p className="admin-muted">RSS、播客和 GitHub 来源会定时抓取；公众号保存为名单，文章链接由你手动提交。所有内容必须审核。</p>
          </div>
          <label>来源名称<input name="name" required placeholder="例如：腾讯技术工程" /></label>
          <label>来源类型<select name="source_type" required defaultValue="rss">
            <option value="rss">RSS / 技术站</option>
            <option value="podcast">播客 RSS</option>
            <option value="github">GitHub Releases / Atom</option>
            <option value="wechat">微信公众号</option>
            <option value="manual">仅手动提交</option>
          </select></label>
          <label>默认分类<select name="category" required defaultValue="article">
            <option value="ai">AI 新闻</option><option value="article">技术文章</option>
            <option value="podcast">播客</option><option value="project">项目</option>
            <option value="tech_feed">技术号</option>
          </select></label>
          <label>RSS / Atom 地址<input name="feed_url" type="url" placeholder="公众号可留空" /></label>
          <label>官网 / 公众号主页<input name="homepage_url" type="url" placeholder="https://…" /></label>
          <button className="admin-primary" type="submit">保存来源</button>
        </form>

        <div className="review-list source-list-admin">
          <div className="source-list-heading">
            <div><p className="eyebrow">CURATED SOURCES</p><h2>来源名单</h2></div>
            <span>{sources.length} 个来源</span>
          </div>
          {sources.length ? sources.map((source) => (
            <article key={source.id}>
              <div><span>{source.source_type} · {source.category}</span><b>{source.enabled ? "已启用" : "已暂停"}</b></div>
              <h3>{source.name}</h3>
              <p>{source.feed_url || (source.source_type === "wechat" ? "公众号文章采用手动提交" : "仅手动提交")}</p>
              <div className="source-row">
                {source.homepage_url && <a href={source.homepage_url} target="_blank" rel="noreferrer">查看来源 ↗</a>}
                <small>{source.last_fetched_at ? `上次抓取 ${new Date(source.last_fetched_at).toLocaleString("zh-CN")}` : "尚未抓取"}</small>
                <button type="button" onClick={() => toggleSource(source)}>{source.enabled ? "暂停" : "启用"}</button>
              </div>
            </article>
          )) : <p className="admin-muted">还没有来源。先添加 RSS 或公众号名单。</p>}
        </div>
      </section>
    </main>
  );
}
