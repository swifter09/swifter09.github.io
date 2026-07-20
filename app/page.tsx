import { PublicFeed } from "./public-feed";

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回字节漫游首页">
          <span className="brand-mark">Z</span>
          <span>字节漫游</span>
        </a>
        <nav aria-label="主导航">
          <a href="#feed">今日雷达</a>
          <a href="#feed">技术文章</a>
          <a href="#feed">播客</a>
          <a href="#feed">项目</a>
          <a href="#feed">技术号</a>
        </nav>
        <a className="admin-entry" href="/admin/" aria-label="进入作者后台">AUTHOR ↗</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span>PERSONAL</span> / TECH INTELLIGENCE</p>
          <h1>把技术世界，<br />收进一个清醒的日常。</h1>
          <p className="hero-lede">
            这里不自动转载，也不制造“实时”幻觉。每一条文章、播客、项目和 AI 新闻，都由作者阅读、筛选并确认后发布。
          </p>
          <a className="signal-link" href="#feed">查看已确认内容 <span>↘</span></a>
        </div>
        <div className="radar" aria-label="人工审核发布流程">
          <div className="review-flow">
            <div><span>01</span><b>收集</b><small>保存候选信号</small></div>
            <div><span>02</span><b>审核</b><small>作者阅读确认</small></div>
            <div><span>03</span><b>发布</b><small>进入公开网站</small></div>
          </div>
          <div className="radar-caption">
            <span><b>HUMAN</b> CURATED</span>
            <span>NO AUTO PUBLISH</span>
          </div>
        </div>
      </section>

      <section id="feed" className="feed-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">REVIEWED / PUBLISHED</p>
            <h2>已确认的技术信号</h2>
          </div>
          <span className="section-meta">仅显示作者批准的内容</span>
        </div>
        <PublicFeed />
      </section>

      <footer>
        <div><span className="brand-mark small">Z</span><b>字节漫游</b></div>
        <p>一个人的技术情报站，保持好奇，减少噪音。</p>
        <a href="https://github.com/swifter09" target="_blank" rel="noreferrer">GITHUB / SWIFTER09 ↗</a>
      </footer>
    </main>
  );
}
