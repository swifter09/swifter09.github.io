"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";

type Status = "draft" | "review" | "published";
type Item = {
  id: string;
  category: string;
  title: string;
  summary: string | null;
  url: string;
  source: string | null;
  status: Status;
  created_at: string;
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

export function AdminDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  async function loadItems() {
    if (!supabase) return;
    const { data } = await supabase.from("content_items").select("*").order("created_at", { ascending: false });
    setItems((data as Item[] | null) ?? []);
  }

  async function loadSources() {
    if (!supabase) return;
    const { data } = await supabase.from("sources").select("*").order("created_at", { ascending: false });
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
      url: form.get("url"),
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
          <label>原文链接<input name="url" type="url" required /></label>
          <label>来源
            <select name="source" defaultValue="">
              <option value="">手动填写 / 未指定</option>
              {sources.map((source) => <option key={source.id} value={source.name}>{source.name}</option>)}
            </select>
          </label>
          <button className="admin-primary" type="submit">保存为草稿</button>
        </form>

        <div className="review-list">
          <h2>审核队列</h2>
          {items.length ? items.map((item) => (
            <article key={item.id}>
              <div><span>{item.category}</span><b>{item.status}</b></div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <a href={item.url} target="_blank" rel="noreferrer">检查原文 ↗</a>
              <div className="review-actions">
                <button type="button" onClick={() => setStatus(item.id, "draft")}>草稿</button>
                <button type="button" onClick={() => setStatus(item.id, "review")}>待审核</button>
                <button type="button" className="approve" onClick={() => setStatus(item.id, "published")}>批准发布</button>
              </div>
            </article>
          )) : <p className="admin-muted">审核队列为空。</p>}
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
