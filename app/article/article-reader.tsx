"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";

type Article = {
  id: string;
  category: string;
  title: string;
  title_zh: string | null;
  summary: string | null;
  summary_zh: string | null;
  body: string | null;
  reader_content: string | null;
  url: string | null;
  source: string | null;
  status: "draft" | "review" | "published";
  published_at: string | null;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function isArxivArticle(article: Article) {
  return article.source?.toLowerCase().includes("arxiv") || article.url?.includes("arxiv.org/") || false;
}

function getArxivPdfUrl(url: string | null) {
  if (!url) return null;
  const match = url.match(/https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|html|pdf)\/([^?#]+)/i);
  if (!match) return url;
  return `https://arxiv.org/pdf/${match[1].replace(/\.pdf$/i, "")}`;
}

function RichBody({ body }: { body: string }) {
  const lines = body.split("\n");
  let inCode = false;
  const code: string[] = [];

  return (
    <div className="reader-body">
      {lines.map((line, index) => {
        if (line.trim().startsWith("```")) {
          if (inCode) {
            inCode = false;
            const value = code.splice(0).join("\n");
            return <pre key={index}><code>{value}</code></pre>;
          }
          inCode = true;
          return null;
        }
        if (inCode) {
          code.push(line);
          return null;
        }
        if (line.startsWith("### ")) return <h3 key={index}>{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={index}>{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h2 key={index}>{line.slice(2)}</h2>;
        if (/^[-*] /.test(line)) return <li key={index}>{line.slice(2)}</li>;
        if (line.startsWith("> ")) return <blockquote key={index}>{line.slice(2)}</blockquote>;
        if (!line.trim()) return <Fragment key={index}><br /></Fragment>;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

export function ArticleReader() {
  const [article, setArticle] = useState<Article | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState("");

  const isOwner = (current: Session | null) => {
    const meta = current?.user.user_metadata ?? {};
    return meta.user_name === "swifter09" || meta.preferred_username === "swifter09";
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setMissing(true);
      return;
    }
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setLoading(false);
      setMissing(true);
      return;
    }
    const load = async () => {
      const { data: authData } = await supabase.auth.getSession();
      setSession(authData.session);
      const { data } = await supabase
        .from("content_items")
        .select("id,category,title,title_zh,summary,summary_zh,body,reader_content,url,source,status,published_at,created_at")
        .eq("id", id)
        .maybeSingle();
      setArticle((data as Article | null) ?? null);
      setMissing(!data);
      setLoading(false);
    };
    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function approveArticle() {
    if (!supabase || !article || !isOwner(session)) return;
    const publishedAt = new Date().toISOString();
    const { error } = await supabase
      .from("content_items")
      .update({ status: "published", published_at: publishedAt, updated_at: publishedAt })
      .eq("id", article.id);
    if (error) {
      setMessage(`发布失败：${error.message}`);
      return;
    }
    setArticle({ ...article, status: "published", published_at: publishedAt });
    setMessage("已批准发布，公开网站现在可以访问这篇文章。");
  }

  async function keepForReview() {
    if (!supabase || !article || !isOwner(session)) return;
    const { error } = await supabase
      .from("content_items")
      .update({ status: "review", updated_at: new Date().toISOString() })
      .eq("id", article.id);
    if (error) {
      setMessage(`更新失败：${error.message}`);
      return;
    }
    setArticle({ ...article, status: "review" });
    setMessage("已保留在待审核队列。");
  }

  if (loading) {
    return <main className="reader-shell"><div className="reader-state">正在载入文章…</div></main>;
  }

  if (missing || !article) {
    return (
      <main className="reader-shell">
        <div className="reader-state">
          <p className="eyebrow">ARTICLE / NOT FOUND</p>
          <h1>文章尚未公开</h1>
          <p>这篇内容可能仍在审核中，或链接已经失效。</p>
          <a href="/">← 返回首页</a>
        </div>
      </main>
    );
  }

  const title = article.title_zh || article.title;
  const summary = article.summary_zh || article.summary;
  const isArxiv = isArxivArticle(article);
  const arxivPdfUrl = isArxiv ? getArxivPdfUrl(article.url) : null;
  const originalAbstract =
    isArxiv && article.summary && article.summary !== article.summary_zh ? article.summary : null;

  return (
    <main className="reader-shell">
      <header className="reader-nav">
        <a className="brand" href="/">
          <span className="brand-mark">Z</span>
          <span>字节漫游</span>
        </a>
        <a href="/#feed">返回精选列表</a>
      </header>

      <article className="reader-article">
        <a className="reader-back" href="/#feed">← 返回</a>
        <div className="reader-tags">
          <span>{article.category === "article" ? "技术文章" : "学习精选"}</span>
          <span>{article.status.toUpperCase()}</span>
        </div>
        <h1>{title}</h1>
        <div className="reader-meta">
          <span>{article.source || "字节漫游"}</span>
          <time>{new Date(article.published_at || article.created_at).toLocaleDateString("zh-CN")}</time>
          <span>{article.status === "published" ? "由作者审核发布" : "仅作者可见"}</span>
        </div>

        {summary && <p className="reader-lead">{summary}</p>}

        {isArxiv ? (
          <section className="paper-summary" aria-label="论文摘要">
            <p className="eyebrow">PAPER / ABSTRACT</p>
            <h2>论文摘要</h2>
            <p className="paper-summary-zh">{summary || "该论文暂未提供摘要。"}</p>
            {originalAbstract && (
              <details className="paper-summary-original">
                <summary>查看英文摘要</summary>
                <p>{originalAbstract}</p>
              </details>
            )}
            <div className="paper-summary-actions">
              {arxivPdfUrl && <a href={arxivPdfUrl} target="_blank" rel="noreferrer">查看 PDF ↗</a>}
              {article.url && <a href={article.url} target="_blank" rel="noreferrer">查看论文页面 ↗</a>}
            </div>
          </section>
        ) : article.body || article.reader_content ? (
          <RichBody body={article.body || article.reader_content || ""} />
        ) : article.url ? (
          <section className="original-reader">
            <div className="original-reader-head">
              <div>
                <p className="eyebrow">READER / UNAVAILABLE</p>
                <h2>阅读版正文尚未生成</h2>
              </div>
              <a href={article.url} target="_blank" rel="noreferrer">新窗口打开 ↗</a>
            </div>
            <p className="reader-extracting">采集任务正在处理这篇原文。稍后刷新页面，正文会直接显示在这里。</p>
          </section>
        ) : (
          <p className="reader-empty-body">这篇内容暂时没有正文。</p>
        )}

        <footer className="reader-source">
          <div>
            <p className="eyebrow">SOURCE / ATTRIBUTION</p>
            <h2>继续阅读</h2>
            <p>本站提供便于审核的阅读版正文；内容及版权归原作者和发布方所有。</p>
          </div>
          {article.url && !isArxiv && (
            <a href={article.url} target="_blank" rel="noreferrer">
              查看原文 <span>↗</span>
            </a>
          )}
        </footer>

        {isOwner(session) && (
          <aside className="reader-review-bar">
            <div>
              <span>作者审核模式</span>
              <b>{article.status === "published" ? "已公开发布" : "阅读完成后可直接批准"}</b>
              {message && <small>{message}</small>}
            </div>
            <div className="reader-review-actions">
              <a href="/admin/">返回后台编辑</a>
              <button type="button" onClick={keepForReview}>保留待审核</button>
              <button type="button" className="approve" onClick={approveArticle} disabled={article.status === "published"}>
                {article.status === "published" ? "已发布" : "批准发布"}
              </button>
            </div>
          </aside>
        )}
      </article>
    </main>
  );
}
