import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://swifter09.github.io"),
  title: "字节漫游｜个人技术情报站",
  description: "由作者人工审核发布的技术文章、播客、项目、AI 新闻与大厂技术号。",
  openGraph: {
    title: "字节漫游｜把技术世界，收进一个清醒的日常",
    description: "只发布经过人工确认的技术信号。",
    url: "https://swifter09.github.io",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "字节漫游技术情报站" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "字节漫游｜把技术世界，收进一个清醒的日常",
    description: "只发布经过人工确认的技术信号。",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
