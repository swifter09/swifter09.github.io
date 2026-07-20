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
          <p className="eyebrow"><span>PERSONAL</span> / TECH INTELLIGENCE</p>
          <h1>把技术世界，<br />收进一个清醒的日常。</h1>
          <p className="hero-lede">
            关注值得长期阅读的技术文章、播客、开源项目与 AI 动态，减少噪音，保留真正有用的信号。
          </p>
        </div>
      </section>

      <section id="feed" className="feed-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">REVIEWED / PUBLISHED</p>
            <h2>技术信号</h2>
          </div>
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
