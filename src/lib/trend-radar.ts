import "server-only";

import { createChatCompletion, parseJsonFromModel } from "@/lib/openai";

export type TrendItem = {
  title: string;
  url: string;
  source: string;
  summary: string;
};

export type TopicSuggestion = {
  title: string;
  angle: string;
  whyNow: string;
  outline: string[];
};

type TopicSuggestionResponse = {
  overview: string;
  suggestions: TopicSuggestion[];
};

const DEFAULT_KEYWORD = "AI";
const RSS_SOURCES = [
  {
    name: "36Kr",
    url: "https://36kr.com/feed",
    lane: "科技商业",
  },
  {
    name: "爱范儿",
    url: "https://www.ifanr.com/feed",
    lane: "科技消费",
  },
  {
    name: "少数派",
    url: "https://sspai.com/feed",
    lane: "数字生活",
  },
  {
    name: "极客公园",
    url: "https://www.geekpark.net/rss",
    lane: "创业创新",
  },
  {
    name: "雷锋网",
    url: "https://www.leiphone.com/feed",
    lane: "AI 产业",
  },
  {
    name: "人人都是产品经理",
    url: "https://www.woshipm.com/feed",
    lane: "产品运营",
  },
];

function cleanText(input: string) {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTagValue(block: string, tagName: string) {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return cleanText(match?.[1] ?? "");
}

function parseRssFeed(xml: string, sourceName: string): TrendItem[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return items.slice(0, 6).map((item) => ({
    title: extractTagValue(item, "title"),
    url: extractTagValue(item, "link"),
    source: sourceName,
    summary:
      extractTagValue(item, "description") ||
      extractTagValue(item, "content:encoded"),
  }));
}

async function fetchFeed(source: (typeof RSS_SOURCES)[number]) {
  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "ArtileAgentStudio/1.0",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseRssFeed(xml, `${source.name} · ${source.lane}`);
  } catch {
    return [];
  }
}

function rankTrends(items: TrendItem[], keyword: string) {
  const lowerKeyword = keyword.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!lowerKeyword) {
      return true;
    }

    const corpus = `${item.title} ${item.summary}`.toLowerCase();
    return corpus.includes(lowerKeyword);
  });

  return (filtered.length ? filtered : items)
    .filter((item) => item.title && item.url)
    .slice(0, 8);
}

function buildTopicFallback(keyword: string, trends: TrendItem[]): TopicSuggestionResponse {
  const picked = trends.slice(0, 3);
  const baseKeyword = keyword || DEFAULT_KEYWORD;

  return {
    overview: `最近与“${baseKeyword}”相关的公开内容里，讨论集中在工具能力变化、实际落地案例，以及创作者工作流重构。适合从“变化背后的判断”切入，而不是只做新闻转述。`,
    suggestions: picked.map((item, index) => ({
      title: `${index + 1}. ${item.title}背后，公众号作者真正该关注什么`,
      angle: `从“${item.source}”这条信息延展，拆解它对内容创作、个人品牌或小团队增长意味着什么。`,
      whyNow: `这类话题正处在读者愿意了解、但市场还没写透的阶段，适合用判断型文章抢先占位。`,
      outline: [
        `先解释这条热点讲了什么：${item.title}`,
        `再拆背后的结构变化，而不是停留在消息层`,
        `最后给出创作者可执行的 3 个动作`,
      ],
    })),
  };
}

function buildSuggestionPrompt(keyword: string, audience: string, trends: TrendItem[]) {
  const trendDigest = trends
    .map(
      (item, index) =>
        `${index + 1}. 标题：${item.title}\n来源：${item.source}\n链接：${item.url}\n摘要：${item.summary}`,
    )
    .join("\n\n");

  return `你是一个擅长为微信公众号作者做选题策划的内容顾问。
请基于以下热点线索，为目标读者生成 3 个值得写成公众号文章的选题建议。

要求：
1. 输出 JSON，不要附加解释文字。
2. JSON 格式为：
{
  "overview": "一句总判断",
  "suggestions": [
    {
      "title": "选题标题",
      "angle": "切入角度",
      "whyNow": "为什么现在值得写",
      "outline": ["提纲1", "提纲2", "提纲3"]
    }
  ]
}
3. 标题要像公众号可直接用的工作标题，不要太空。
4. 不要编造未提供的事实，判断必须建立在线索摘要上。

用户关注关键词：${keyword || DEFAULT_KEYWORD}
目标读者：${audience || "公众号作者、独立创作者、小团队主理人"}

热点线索：
${trendDigest}`;
}

export async function getTrendRadar(keyword: string) {
  const feedResults = await Promise.all(RSS_SOURCES.map((source) => fetchFeed(source)));
  const trends = rankTrends(feedResults.flat(), keyword);

  if (trends.length > 0) {
    return trends;
  }

  return [
    {
      title: "AI 工作流正在从单点工具转向整链路协同",
      url: "https://openai.com",
      source: "本地兜底",
      summary: "当外部热点源暂时不可用时，仍然保留一个可用于演示的趋势判断。",
    },
    {
      title: "内容创作越来越依赖可复用模板，而不是一次性爆文技巧",
      url: "https://openai.com",
      source: "本地兜底",
      summary: "创作者开始重视长期内容资产和可持续生产节奏。",
    },
    {
      title: "图文一体化生成能力正在重塑公众号选题包装方式",
      url: "https://openai.com",
      source: "本地兜底",
      summary: "封面与配图不再是后置美化动作，而会反过来影响选题呈现。",
    },
  ];
}

export async function getTopicSuggestions(keyword: string, audience: string) {
  const trends = await getTrendRadar(keyword);
  const prompt = buildSuggestionPrompt(keyword, audience, trends);
  const modelOutput = await createChatCompletion({
    systemPrompt:
      "你是中文内容策略顾问，擅长根据热点线索生成公众号选题建议。输出必须是 JSON。",
    userPrompt: prompt,
    temperature: 0.7,
  });

  if (!modelOutput) {
    return {
      trends,
      ...buildTopicFallback(keyword, trends),
    };
  }

  const parsed = parseJsonFromModel<TopicSuggestionResponse>(modelOutput);
  if (!parsed?.suggestions?.length) {
    return {
      trends,
      ...buildTopicFallback(keyword, trends),
    };
  }

  return {
    trends,
    overview: parsed.overview,
    suggestions: parsed.suggestions.slice(0, 3).map((suggestion) => ({
      title: suggestion.title,
      angle: suggestion.angle,
      whyNow: suggestion.whyNow,
      outline: suggestion.outline?.slice(0, 4) ?? [],
    })),
  };
}
