const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  return (rssItems ?? atomEntries ?? []).slice(0, 30).map((block) => {
    const link = field(block, ["link"]) || attr(block, "link", "href");
    const id = field(block, ["guid", "id"]) || link;
    return {
      external_id: id,
      title: field(block, ["title"]),
      summary: field(block, ["description", "summary", "content", "content:encoded"]).slice(0, 800),
      url: link,
      published_at: field(block, ["pubDate", "published", "updated"]) || null,
    };
  }).filter((item) => item.title && item.url);
}

async function api(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...apiHeaders, ...options.headers },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response;
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
