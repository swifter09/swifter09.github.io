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
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  async function loadItems() {
    if (!supabase) return;
    const { data } = await supabase.from("content_items").select("*").order("created_at", { ascending: false });
    setItems((data as Item[] | null) ?? []);
  }

  useEffect(() => {
    if (!supabase) { setReady(true); return; }

    async function restoreSession() {
      const query = new URLSearchParams(window.location.search);
      const authorizationCode = query.get("code");
      const callback = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = callback.get("access_token");
      const refreshToken = callback.get("refresh_token");

      if (authorizationCode) {
        await supabase!.auth.exchangeCodeForSession(authorizationCode);
        window.history.replaceState(null, "", window.location.pathname);
      } else if (accessToken && refreshToken) {
        await supabase!.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(null, "", window.location.pathname);
      }

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
    if (isOwner(session)) loadItems();
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
          <label>来源<input name="source" /></label>
          <button className="admin-primary" type="submit">保存为草稿</button>
          {message && <p className="admin-message">{message}</p>}
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
    </main>
  );
}
