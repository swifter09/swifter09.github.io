const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const githubToken = process.env.GITHUB_TOKEN;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const apiHeaders = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
};

function decode(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function field(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decode(match[1]);
  }
  return "";
}

function attr(block, tag, attribute) {
  const match = block.match(new RegExp(`<${tag}[^>]*${attribute}=["']([^"']+)["'][^>]*>`, "i"));
  return match?.[1] ?? "";
}

function parseFeed(xml) {
  const rssItems = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi);
  const atomEntries = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi);
  return (rssItems ?? atomEntries ?? []).slice(0, 10).map((block) => {
    const id = field(block, ["guid", "id"]);
    const link = field(block, ["link"]) || attr(block, "link", "href") || (id.startsWith("http") ? id : "");
    return {
      external_id: id || link,
      title: field(block, ["title"]),
      summary: field(block, ["description", "summary", "content", "content:encoded"]).slice(0, 800),
      url: link,
      published_at: field(block, ["pubDate", "published", "updated"]) || null,
    };
  }).filter((item) => item.title && item.url);
}

function decodeArticleText(value = "") {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
}

function plainText(html = "") {
  return decodeArticleText(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractArticleBody(html) {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|svg|noscript|nav|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, "");
  const candidates = [
    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1],
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1],
    cleaned.match(/<div\b[^>]*class=["'][^"']*(?:article|post|entry)[-_ ]*(?:content|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1],
  ].filter(Boolean);
  const source = candidates.find((candidate) => plainText(candidate).length >= 400) || candidates[0] || "";
  const markdown = source
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_match, code) => `\n\n\`\`\`\n${plainText(code)}\n\`\`\`\n\n`)
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_match, text) => `\n\n# ${plainText(text)}\n\n`)
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_match, text) => `\n\n## ${plainText(text)}\n\n`)
    .replace(/<h[3-6]\b[^>]*>([\s\S]*?)<\/h[3-6]>/gi, (_match, text) => `\n\n### ${plainText(text)}\n\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, text) => `\n- ${plainText(text)}`)
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, text) => `\n\n> ${plainText(text)}\n\n`)
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_match, text) => `\n\n${plainText(text)}\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeArticleText(markdown)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 120_000);
}

async function api(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...apiHeaders, ...options.headers },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response;
}

async function translateBatch(items) {
  if (!githubToken || !items.length) return [];

  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${githubToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "你是严谨的技术编辑。把英文 AI 技术内容翻译成简洁、自然、准确的简体中文。保留产品名、模型名、代码名和专有名词。不要扩写或添加观点。只返回 JSON。",
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction: "返回 {translations:[{id,title_zh,summary_zh}]}，id 必须原样保留。摘要控制在 180 个中文字符以内。",
            items: items.map(({ id, title, summary }) => ({ id, title, summary: summary || "" })),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Translation returned ${response.status}: ${await response.text()}`);
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("Translation returned no content");
  return JSON.parse(content).translations ?? [];
}

async function translatePendingAiItems() {
  if (!githubToken) {
    console.log("Translation skipped: GITHUB_TOKEN is unavailable");
    return;
  }
  const response = await api(
    "content_items?category=eq.ai&title_zh=is.null&select=id,title,summary&order=created_at.asc&limit=100"
  );
  const pending = await response.json();
  let translated = 0;

  for (let index = 0; index < pending.length; index += 8) {
    const batch = pending.slice(index, index + 8);
    try {
      const translations = await translateBatch(batch);
      for (const translation of translations) {
        if (!translation.id || !translation.title_zh) continue;
        await api(`content_items?id=eq.${encodeURIComponent(translation.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            title_zh: String(translation.title_zh).trim(),
            summary_zh: String(translation.summary_zh || "").trim() || null,
          }),
        });
        translated += 1;
      }
    } catch (error) {
      console.error(`Translation batch failed: ${error.message}`);
    }
  }
  console.log(`Translated ${translated}/${pending.length} pending AI items`);
}

function chunkMarkdown(content, maxLength = 5_500) {
  const blocks = content.split(/\n{2,}/);
  const chunks = [];
  let current = "";
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > maxLength) {
      chunks.push(current);
      current = "";
    }
    if (block.length > maxLength) {
      if (current) chunks.push(current);
      for (let index = 0; index < block.length; index += maxLength) chunks.push(block.slice(index, index + maxLength));
      current = "";
    } else {
      current += `${current ? "\n\n" : ""}${block}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateMarkdownChunk(markdown) {
  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${githubToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "你是严谨的技术文章翻译。把 Markdown 正文完整翻译成简体中文。保留标题层级、列表、引用、代码块、行内代码、链接地址、图片地址和音频地址；只翻译可读文字。不要摘要、删减、解释或添加内容，只返回翻译后的 Markdown。",
        },
        { role: "user", content: markdown },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Body translation returned ${response.status}: ${await response.text()}`);
  const result = await response.json();
  const translated = result.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error("Body translation returned no content");
  return translated;
}

async function translatePendingReaderContent() {
  if (!githubToken) return;
  const response = await api(
    "content_items?category=eq.ai&reader_content=not.is.null&reader_content_zh=is.null&select=id,title,reader_content&order=created_at.desc&limit=8"
  );
  const pending = await response.json();
  let completed = 0;
  for (const item of pending) {
    try {
      const chunks = chunkMarkdown(item.reader_content);
      const translated = [];
      for (const chunk of chunks) translated.push(await translateMarkdownChunk(chunk));
      await api(`content_items?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ reader_content_zh: translated.join("\n\n") }),
      });
      completed += 1;
      console.log(`${item.title}: translated reader copy in ${chunks.length} chunks`);
    } catch (error) {
      console.error(`${item.title}: reader translation failed: ${error.message}`);
    }
  }
  console.log(`Translated ${completed}/${pending.length} reader copies`);
}

async function fetchReaderContent(item) {
  const useReaderFirst = new URL(item.url).hostname.toLowerCase() === "blog.google";
  if (useReaderFirst) {
    const readerResponse = await fetch(`https://r.jina.ai/${item.url}`, {
      headers: { accept: "text/plain" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!readerResponse.ok) throw new Error(`Reader returned ${readerResponse.status}`);
    const content = (await readerResponse.text()).trim().slice(0, 120_000);
    if (content.length < 400) throw new Error("Reader content is too short");
    await api(`content_items?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ reader_content: content }),
    });
    return content.length;
  }

  let response = await fetch(item.url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 (compatible; ZijiManyouReader/1.0; +https://swifter09.github.io)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  if (response.status === 401 || response.status === 403) {
    response = await fetch(`https://r.jina.ai/${item.url}`, {
      headers: { accept: "text/plain" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`Reader fallback returned ${response.status}`);
    const content = (await response.text()).trim().slice(0, 120_000);
    if (content.length < 400) throw new Error("Reader fallback content is too short");
    await api(`content_items?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ reader_content: content }),
    });
    return content.length;
  }
  if (!response.ok) throw new Error(`Original returned ${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html") && !type.includes("application/xhtml")) {
    throw new Error(`Unsupported content type: ${type}`);
  }
  const content = extractArticleBody(await response.text());
  if (content.length < 400) throw new Error("Extracted content is too short");
  await api(`content_items?id=eq.${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ reader_content: content }),
  });
  return content.length;
}

async function refreshKnownPoorReaderContent() {
  const response = await api(
    "content_items?url=like.*blog.google*&select=id,url,title&order=created_at.desc&limit=25"
  );
  const items = await response.json();
  const results = await Promise.allSettled(items.map(fetchReaderContent));
  const completed = results.filter((result) => result.status === "fulfilled").length;
  console.log(`Refreshed ${completed}/${items.length} Google reader copies`);
}

function isArxivUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().endsWith("arxiv.org");
  } catch {
    return false;
  }
}

async function backfillReaderContent() {
  const response = await api(
    "content_items?url=not.is.null&reader_content=is.null&select=id,url,title&order=created_at.asc&limit=100"
  );
  const pending = (await response.json()).filter((item) => !isArxivUrl(item.url));
  let completed = 0;

  for (let index = 0; index < pending.length; index += 5) {
    const batch = pending.slice(index, index + 5);
    const results = await Promise.allSettled(batch.map(fetchReaderContent));
    results.forEach((result, offset) => {
      const item = batch[offset];
      if (result.status === "fulfilled") {
        completed += 1;
        console.log(`${item.title}: reader copy ${result.value} chars`);
      } else {
        console.error(`${item.title}: reader copy failed: ${result.reason.message}`);
      }
    });
  }
  console.log(`Created ${completed}/${pending.length} pending reader copies`);
}

const sourceResponse = await api(
  "sources?enabled=eq.true&feed_url=not.is.null&select=id,name,source_type,category,feed_url"
);
const sources = await sourceResponse.json();

for (const source of sources) {
  try {
    const response = await fetch(source.feed_url, {
      headers: { "user-agent": "ziji-manyou-feed-fetcher/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const entries = parseFeed(await response.text());
    const payload = entries.map((entry) => ({
      ...entry,
      source_id: source.id,
      source: source.name,
      category: source.category,
      status: "review",
    }));

    if (payload.length) {
      await api("content_items?on_conflict=url", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(payload),
      });
    }

    await api(`sources?id=eq.${source.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_fetched_at: new Date().toISOString() }),
    });
    console.log(`${source.name}: ${payload.length} candidate items`);
  } catch (error) {
    console.error(`${source.name}: ${error.message}`);
  }
}

await translatePendingAiItems();
await backfillReaderContent();
await refreshKnownPoorReaderContent();
await translatePendingReaderContent();
