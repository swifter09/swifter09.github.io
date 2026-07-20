import type { Metadata } from "next";
import { ArticleReader } from "./article-reader";

export const metadata: Metadata = {
  title: "文章阅读｜字节漫游",
  description: "字节漫游审核精选的技术文章与个人学习笔记。",
};

export default function ArticlePage() {
  return <ArticleReader />;
}
