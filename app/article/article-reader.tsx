"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Article = {
  id: string;
  category: string;
  title: string;
  title_zh: string | null;
  summary: string | null;
  summary_zh: string | null;
  body: string | null;
  url: string | null;
  source: string | null;
  published_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

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
    supabase
      .from("content_items")
      .select("id,category,title,title_zh,summary,summary_zh,body,url,source,published_at")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        setArticle((data as Article | null) ?? null);
        setMissing(!data);
        setLoading(false);
      });
  }, []);

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
          <span>REVIEWED</span>
        </div>
        <h1>{title}</h1>
        <div className="reader-meta">
          <span>{article.source || "字节漫游"}</span>
          <time>{new Date(article.published_at).toLocaleDateString("zh-CN")}</time>
          <span>由作者审核发布</span>
        </div>

        {summary && <p className="reader-lead">{summary}</p>}

        {article.body ? (
          <RichBody body={article.body} />
        ) : (
          <section className="reader-note">
            <p className="eyebrow">READING NOTE</p>
            <h2>等待补充学习笔记</h2>
            <p>这篇文章已经通过审核，目前保留中文摘要供快速判断。完整内容请前往原文阅读，后续可在作者后台继续补充个人笔记。</p>
          </section>
        )}

        <footer className="reader-source">
          <div>
            <p className="eyebrow">SOURCE / ATTRIBUTION</p>
            <h2>继续阅读</h2>
            <p>本站保存的是审核后的摘要与个人学习笔记，原始内容及版权归原作者和发布方所有。</p>
          </div>
          {article.url && (
            <a href={article.url} target="_blank" rel="noreferrer">
              查看原文 <span>↗</span>
            </a>
          )}
        </footer>
      </article>
    </main>
  );
}
