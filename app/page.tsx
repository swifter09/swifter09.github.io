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
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="hero-terminal">&gt;_</span>
          <p className="eyebrow"><span>PERSONAL</span> / TECH INTELLIGENCE</p>
          <h1>字节漫游</h1>
          <p className="hero-lede">
            把技术世界，收进一个清醒的日常。
          </p>
          <p className="hero-note">阅读、审核与整理真正值得回看的 AI 动态、技术文章、播客和开源项目。</p>
        </div>
      </section>

      <section id="feed" className="feed-section">
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
