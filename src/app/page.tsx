"use client";

import { useMemo, useState } from "react";

type AgentAction = "format" | "draft" | "rewrite" | "headline" | "summary";
type TemplateId = "clean" | "magazine" | "insight";

type AgentResponse = {
  ok: boolean;
  result?: string;
  error?: string;
  meta?: {
    usedFallback?: boolean;
    generationLabel?: string;
  };
};

type TrendItem = {
  title: string;
  url: string;
  source: string;
  summary: string;
};

type TopicSuggestion = {
  title: string;
  angle: string;
  whyNow: string;
  outline: string[];
};

type RadarResponse = {
  ok: boolean;
  overview?: string;
  trends?: TrendItem[];
  suggestions?: TopicSuggestion[];
  error?: string;
};

type GeneratedVisual = {
  title: string;
  prompt: string;
  imageUrl: string;
  alt: string;
  format: "cover" | "inline";
  direction: string;
  generationLabel: string;
  warning?: string;
};

type ImageResponse = {
  ok: boolean;
  visuals?: GeneratedVisual[];
  error?: string;
};

type RenderBlock = {
  type:
    | "heading"
    | "paragraph"
    | "unordered-list"
    | "ordered-list"
    | "blockquote"
    | "code-block";
  html: string;
};

const starterMarkdown = `把 Markdown 或纯文本内容直接粘贴到这里。

然后点击“智能排版”，系统会自动帮你：

1. 梳理标题和小标题层级
2. 优化段落、换行和列表
3. 补一个更适合公众号的导语
4. 保留代码块、引用和链接格式
`;

const templates: Record<
  TemplateId,
  {
    name: string;
    description: string;
    className: string;
  }
> = {
  clean: {
    name: "简洁专栏",
    description: "适合知识型、方法型内容，层级清晰。",
    className: "wechat-template wechat-clean",
  },
  magazine: {
    name: "杂志感",
    description: "适合观点稿、品牌稿，视觉更有张力。",
    className: "wechat-template wechat-magazine",
  },
  insight: {
    name: "深度拆解",
    description: "适合行业分析与案例复盘，强调引用与重点框。",
    className: "wechat-template wechat-insight",
  },
};

const exportArticleStyles: Record<TemplateId, Record<string, string>> = {
  clean: {
    article:
      "padding:26px 20px 32px;border-radius:26px;background:#fffdf8;color:#1f1d1a;font-family:'Iowan Old Style','Palatino Linotype','Noto Serif SC','Source Han Serif SC',serif;",
    h1: "margin:0.2em 0 0.9em;font-size:30px;line-height:1.3;color:#1f1a17;font-weight:700;",
    h2: "margin:1.45em 0 0.75em;padding-left:12px;border-left:4px solid #b24a2b;font-size:22px;line-height:1.45;color:#5d2f20;font-weight:700;",
    h3: "margin:1.45em 0 0.75em;font-size:18px;line-height:1.5;color:#41281d;font-weight:700;",
    h4: "margin:1.45em 0 0.75em;font-size:16px;line-height:1.5;color:#41281d;font-weight:700;",
    p: "margin:0.9em 0;font-size:16px;line-height:1.95;color:#1f1d1a;",
    ul: "margin:0.8em 0;padding-left:1.3em;font-size:16px;line-height:1.95;color:#1f1d1a;",
    ol: "margin:0.8em 0;padding-left:1.3em;font-size:16px;line-height:1.95;color:#1f1d1a;",
    li: "margin:0.35em 0;",
    blockquote:
      "margin:1.25em 0;padding:0.75em 1em;border-left:3px solid rgba(178,74,43,0.4);background:rgba(242,230,224,0.7);color:#644336;border-radius:8px;",
    inlineCode:
      "padding:0.16em 0.4em;border-radius:8px;font-family:'IBM Plex Mono','SFMono-Regular',monospace;font-size:0.92em;background:rgba(90,58,39,0.08);",
    pre:
      "margin:1.25em 0;padding:16px 18px;border-radius:18px;background:#f7f4ef;overflow:auto;border:1px solid rgba(100,68,48,0.12);",
    preCode:
      "font-family:'IBM Plex Mono','SFMono-Regular',monospace;font-size:14px;line-height:1.8;color:#2f261f;white-space:pre;",
    a: "color:#0f6db8;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;",
    img: "display:block;width:100%;margin:1.2em 0;border-radius:18px;object-fit:cover;box-shadow:0 18px 36px rgba(61,37,16,0.08);",
  },
  magazine: {
    article:
      "padding:26px 20px 32px;border-radius:26px;background:#fffaf4;color:#1f1d1a;font-family:'Iowan Old Style','Palatino Linotype','Noto Serif SC','Source Han Serif SC',serif;",
    h1: "position:relative;margin:0.2em 0 0.9em;padding-bottom:0.55em;font-size:30px;line-height:1.3;color:#7f2e17;font-weight:700;border-bottom:3px solid rgba(178,74,43,0.22);",
    h2: "display:inline-block;margin:1.45em 0 0.75em;padding:0.25em 0.72em;border-radius:999px;background:rgba(178,74,43,0.1);font-size:22px;line-height:1.45;color:#903f27;font-weight:700;",
    h3: "margin:1.45em 0 0.75em;font-size:18px;line-height:1.5;color:#41281d;font-weight:700;",
    h4: "margin:1.45em 0 0.75em;font-size:16px;line-height:1.5;color:#41281d;font-weight:700;",
    p: "margin:0.9em 0;font-size:16px;line-height:1.95;color:#1f1d1a;",
    ul: "margin:0.8em 0;padding-left:1.3em;font-size:16px;line-height:1.95;color:#1f1d1a;",
    ol: "margin:0.8em 0;padding-left:1.3em;font-size:16px;line-height:1.95;color:#1f1d1a;",
    li: "margin:0.35em 0;",
    blockquote:
      "margin:1.25em 0;padding:0.85em 1em;border-radius:18px;background:linear-gradient(135deg, rgba(255,233,224,0.8), rgba(255,247,240,0.9));color:#6f4635;",
    inlineCode:
      "padding:0.16em 0.4em;border-radius:8px;font-family:'IBM Plex Mono','SFMono-Regular',monospace;font-size:0.92em;background:rgba(90,58,39,0.08);",
    pre:
      "margin:1.25em 0;padding:16px 18px;border-radius:18px;background:#f7f4ef;overflow:auto;border:1px solid rgba(100,68,48,0.12);",
    preCode:
      "font-family:'IBM Plex Mono','SFMono-Regular',monospace;font-size:14px;line-height:1.8;color:#2f261f;white-space:pre;",
    a: "color:#0f6db8;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;",
    img: "display:block;width:100%;margin:1.2em 0;border-radius:18px;object-fit:cover;box-shadow:0 18px 36px rgba(61,37,16,0.08);",
  },
  insight: {
    article:
      "padding:26px 20px 32px;border-radius:26px;background:#fffdf8;color:#1f1d1a;font-family:'Iowan Old Style','Palatino Linotype','Noto Serif SC','Source Han Serif SC',serif;",
    h1: "margin:0.2em 0 0.9em;font-size:30px;line-height:1.3;color:#1f1a17;font-weight:700;",
    h2: "margin:1.45em 0 0.75em;padding:0.55em 0.85em;border-radius:14px;background:linear-gradient(135deg, rgba(58,36,27,0.96), rgba(92,52,33,0.88));font-size:22px;line-height:1.45;color:#fff4eb;font-weight:700;",
    h3: "margin:1.45em 0 0.75em;font-size:18px;line-height:1.5;color:#7a3a23;font-weight:700;",
    h4: "margin:1.45em 0 0.75em;font-size:16px;line-height:1.5;color:#7a3a23;font-weight:700;",
    p: "margin:0.9em 0;font-size:16px;line-height:1.95;color:#1f1d1a;",
    ul: "margin:0.8em 0;padding-left:1.3em;font-size:16px;line-height:1.95;color:#1f1d1a;",
    ol: "margin:0.8em 0;padding-left:1.3em;font-size:16px;line-height:1.95;color:#1f1d1a;",
    li: "margin:0.35em 0;",
    blockquote:
      "margin:1.25em 0;padding:0.85em 1em;border:1px solid rgba(178,74,43,0.22);border-radius:18px;background:rgba(253,245,237,0.95);color:#5b4134;",
    inlineCode:
      "padding:0.16em 0.4em;border-radius:8px;font-family:'IBM Plex Mono','SFMono-Regular',monospace;font-size:0.92em;background:rgba(90,58,39,0.08);",
    pre:
      "margin:1.25em 0;padding:16px 18px;border-radius:18px;background:#f7f4ef;overflow:auto;border:1px solid rgba(100,68,48,0.12);",
    preCode:
      "font-family:'IBM Plex Mono','SFMono-Regular',monospace;font-size:14px;line-height:1.8;color:#2f261f;white-space:pre;",
    a: "color:#0f6db8;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;",
    img: "display:block;width:100%;margin:1.2em 0;border-radius:18px;object-fit:cover;box-shadow:0 18px 36px rgba(61,37,16,0.08);",
  },
};

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInlineMarkdown(input: string) {
  return escapeHtml(input)
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g,
      '<img src="$2" alt="$1" class="article-image" />',
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
}

function applyInlineExportStyles(html: string, templateId: TemplateId) {
  const styles = exportArticleStyles[templateId];

  return html
    .replace(/<a /g, `<a style="${styles.a}" `)
    .replace(/<img /g, `<img style="${styles.img}" `)
    .replace(/<code>([^<]*)<\/code>/g, `<code style="${styles.inlineCode}">$1</code>`);
}

function renderCodeBlock(codeLines: string[]) {
  const content = escapeHtml(codeLines.join("\n"));
  return `<pre><code>${content}</code></pre>`;
}

function parseMarkdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: RenderBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let quoteLines: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }

    blocks.push({
      type: "paragraph",
      html: `<p>${renderInlineMarkdown(paragraph.join("<br />"))}</p>`,
    });
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    blocks.push({
      type: "unordered-list",
      html: `<ul>${listItems
        .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
        .join("")}</ul>`,
    });
    listItems = [];
  };

  const flushOrderedList = () => {
    if (!orderedItems.length) {
      return;
    }

    blocks.push({
      type: "ordered-list",
      html: `<ol>${orderedItems
        .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
        .join("")}</ol>`,
    });
    orderedItems = [];
  };

  const flushQuote = () => {
    if (!quoteLines.length) {
      return;
    }

    blocks.push({
      type: "blockquote",
      html: `<blockquote>${quoteLines
        .map((line) => `<p>${renderInlineMarkdown(line)}</p>`)
        .join("")}</blockquote>`,
    });
    quoteLines = [];
  };

  const flushCodeBlock = () => {
    if (!codeLines.length) {
      return;
    }

    blocks.push({
      type: "code-block",
      html: renderCodeBlock(codeLines),
    });
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushOrderedList();
        flushQuote();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushQuote();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushQuote();
      const level = headingMatch[1].length;
      blocks.push({
        type: "heading",
        html: `<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`,
      });
      continue;
    }

    const unorderedListMatch = trimmed.match(/^(\-|\*)\s+(.*)$/);
    if (unorderedListMatch) {
      flushParagraph();
      flushQuote();
      flushOrderedList();
      listItems.push(unorderedListMatch[2]);
      continue;
    }

    const orderedListMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedListMatch) {
      flushParagraph();
      flushQuote();
      flushList();
      orderedItems.push(orderedListMatch[1]);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      flushOrderedList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushOrderedList();
  flushQuote();
  flushCodeBlock();

  return blocks;
}

function markdownToHtml(markdown: string) {
  return parseMarkdownBlocks(markdown)
    .map((block) => block.html)
    .join("");
}

function buildExportHtml(markdown: string, templateId: TemplateId) {
  const styles = exportArticleStyles[templateId];
  const blocks = parseMarkdownBlocks(markdown);
  const content = blocks
    .map((block) => {
      if (block.type === "heading") {
        return applyInlineExportStyles(
          block.html
          .replace(/<h1>/g, `<h1 style="${styles.h1}">`)
          .replace(/<h2>/g, `<h2 style="${styles.h2}">`)
          .replace(/<h3>/g, `<h3 style="${styles.h3}">`)
          .replace(/<h4>/g, `<h4 style="${styles.h4}">`),
          templateId,
        );
      }

      if (block.type === "paragraph") {
        return applyInlineExportStyles(
          block.html.replace(/<p>/g, `<p style="${styles.p}">`),
          templateId,
        );
      }

      if (block.type === "unordered-list") {
        return applyInlineExportStyles(
          block.html
          .replace(/<ul>/g, `<ul style="${styles.ul}">`)
          .replace(/<li>/g, `<li style="${styles.li}">`),
          templateId,
        );
      }

      if (block.type === "ordered-list") {
        return applyInlineExportStyles(
          block.html
          .replace(/<ol>/g, `<ol style="${styles.ol}">`)
          .replace(/<li>/g, `<li style="${styles.li}">`),
          templateId,
        );
      }

      if (block.type === "blockquote") {
        return applyInlineExportStyles(
          block.html
          .replace(/<blockquote>/g, `<blockquote style="${styles.blockquote}">`)
          .replace(/<p>/g, `<p style="${styles.p}margin:0.4em 0;">`),
          templateId,
        );
      }

      return block.html
        .replace(/<pre>/g, `<pre style="${styles.pre}">`)
        .replace(/<code>/g, `<code style="${styles.preCode}">`);
    })
    .join("");

  return `<article style="${styles.article}">${content}</article>`;
}

async function copyRichContent(html: string, plainText: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    });

    await navigator.clipboard.write([item]);
    return true;
  }

  await navigator.clipboard.writeText(plainText);
  return false;
}

function buildSuggestionMarkdown(suggestion: TopicSuggestion) {
  const outline = suggestion.outline
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");

  return `# ${suggestion.title}

> 切入角度：${suggestion.angle}

## 为什么现在值得写

${suggestion.whyNow}

## 建议提纲

${outline}
`;
}

export default function Home() {
  const [topic, setTopic] = useState("把一篇内容整理成更适合公众号发布的版本");
  const [audience, setAudience] = useState("公众号读者");
  const [goal, setGoal] = useState("优化排版结构、阅读节奏和发布完成度");
  const [voice, setVoice] = useState("清晰、克制、适合公众号发布");
  const [markdown, setMarkdown] = useState(starterMarkdown);
  const [templateId, setTemplateId] = useState<TemplateId>("clean");
  const [statusText, setStatusText] = useState(
    "先填写主题再生成。若未配置模型 Key，系统会使用本地兜底稿，不代表最终成稿质量。",
  );
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [radarKeyword, setRadarKeyword] = useState("AI");
  const [isRadarLoading, setIsRadarLoading] = useState(false);
  const [radarOverview, setRadarOverview] = useState("");
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [visuals, setVisuals] = useState<GeneratedVisual[]>([]);

  const previewHtml = useMemo(() => markdownToHtml(markdown), [markdown]);
  const isBusy = isAgentLoading || isRadarLoading || isImageLoading;

  async function runAgent(action: AgentAction) {
    setIsAgentLoading(true);
    setStatusText(
      action === "format"
        ? "正在优化排版结构，请稍候..."
        : "智能体正在整理内容，请稍候...",
    );

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          topic,
          audience,
          goal,
          voice,
          markdown,
        }),
      });

      const data = (await response.json()) as AgentResponse;
      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error ?? "智能体没有返回可用结果。");
      }

      const providerText = data.meta?.generationLabel ?? "已完成生成";

      if (action === "format") {
        setStatusText(`已完成排版优化。${providerText}`);
      } else if (action === "headline") {
        setStatusText(`已生成标题方案。${providerText}`);
      } else if (action === "summary") {
        setStatusText(`已补强导语和结尾。${providerText}`);
      } else if (action === "rewrite") {
        setStatusText(`已完成改写。${providerText}`);
      } else {
        setStatusText(`已生成新的公众号草稿。${providerText}`);
      }

      setMarkdown(data.result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "调用智能体时发生未知错误。";
      setStatusText(message);
    } finally {
      setIsAgentLoading(false);
    }
  }

  async function loadRadar() {
    setIsRadarLoading(true);
    setStatusText("正在抓取公开热点，并整理成可写的公众号选题...");

    try {
      const response = await fetch("/api/radar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: radarKeyword,
          audience,
        }),
      });

      const data = (await response.json()) as RadarResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "热点雷达没有返回可用结果。");
      }

      setRadarOverview(data.overview ?? "");
      setTrends(data.trends ?? []);
      setSuggestions(data.suggestions ?? []);
      setStatusText("热点和选题建议已更新，可以一键带入正文继续写。");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "热点抓取时发生未知错误。";
      setStatusText(message);
    } finally {
      setIsRadarLoading(false);
    }
  }

  async function generateImages() {
    setIsImageLoading(true);
    setStatusText("正在生成封面图和配图方案...");

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          audience,
          voice,
        }),
      });

      const data = (await response.json()) as ImageResponse;
      if (!response.ok || !data.ok || !data.visuals?.length) {
        throw new Error(data.error ?? "图片服务没有返回可用结果。");
      }

      setVisuals(data.visuals);
      setStatusText("封面图和文中配图已生成。");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "图片生成时发生未知错误。";
      setStatusText(message);
    } finally {
      setIsImageLoading(false);
    }
  }

  async function copyMarkdown() {
    const html = buildExportHtml(markdown, templateId);
    const copiedRich = await copyRichContent(html, markdown);
    setStatusText(
      copiedRich
        ? "已复制 Markdown 文本，并附带富文本 HTML，粘贴到公众号时会更接近预览样式。"
        : "Markdown 已复制，但当前环境仅支持纯文本剪贴板。",
    );
  }

  async function copyHtml() {
    const html = buildExportHtml(markdown, templateId);
    const copiedRich = await copyRichContent(html, markdown);
    setStatusText(
      copiedRich
        ? "已复制富文本 HTML，粘贴到公众号编辑器时会更接近右侧预览。"
        : "已复制 HTML 源码文本，但当前环境不支持直接写入富文本剪贴板。",
    );
  }

  async function copyPrompt(prompt: string) {
    await navigator.clipboard.writeText(prompt);
    setStatusText("图片提示词已复制，可以继续外部微调。");
  }

  function insertVisualIntoMarkdown(visual: GeneratedVisual) {
    const imageMarkdown = `![${visual.alt}](${visual.imageUrl})`;
    const nextMarkdown =
      visual.format === "cover"
        ? `${imageMarkdown}\n\n${markdown}`
        : `${markdown.trimEnd()}\n\n${imageMarkdown}\n`;
    setMarkdown(nextMarkdown);
    setStatusText(`${visual.title} 已插入正文。`);
  }

  async function downloadVisual(visual: GeneratedVisual) {
    let objectUrl = visual.imageUrl;
    let extension = "png";

    if (!visual.imageUrl.startsWith("data:")) {
      const response = await fetch(visual.imageUrl);
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      extension = blob.type.includes("png") ? "png" : "jpg";
    } else if (visual.imageUrl.includes("image/svg+xml")) {
      extension = "svg";
    }

    const link = document.createElement("a");
    const safeTitle = topic.replace(/[\\/:*?"<>|]+/g, "-").trim() || "artile-visual";

    link.href = objectUrl;
    link.download = `${safeTitle}-${visual.format}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (!visual.imageUrl.startsWith("data:")) {
      URL.revokeObjectURL(objectUrl);
    }
    setStatusText(`${visual.title} 已开始下载。`);
  }

  function applySuggestion(suggestion: TopicSuggestion) {
    setTopic(suggestion.title);
    setMarkdown(buildSuggestionMarkdown(suggestion));
    setStatusText("已将选题建议带入正文编辑区，可以继续起稿或改写。");
  }

  return (
    <main className="workspace-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">ARTILE AGENT STUDIO</p>
          <h1>公众号内容排版优化工作台</h1>
          <p className="hero-description">
            直接粘贴 Markdown 或纯文本内容，自动整理成更适合公众号发布的结构，再按需补标题、导语和配图。
          </p>
        </div>
        <div className="hero-card">
          <p>主工作流</p>
          <ul>
            <li>粘贴 Markdown 或纯文本</li>
            <li>一键智能排版优化</li>
            <li>公众号模板预览</li>
            <li>复制富文本或 HTML 到公众号</li>
          </ul>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="control-panel">
          <div className="panel-card">
            <div className="panel-heading">
              <h2>智能体输入</h2>
              <span>{statusText}</span>
            </div>

            <label>
              文章主题
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="这篇文章最核心的话题是什么"
              />
            </label>

            <label>
              目标读者
              <input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="这篇文章主要是写给谁"
              />
            </label>

            <label>
              输出目标
              <input
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="希望读者读完之后发生什么"
              />
            </label>

            <label>
              语气风格
              <textarea
                value={voice}
                onChange={(event) => setVoice(event.target.value)}
                rows={3}
                placeholder="例如：像一位有经验的操盘手，冷静、清晰、少空话"
              />
            </label>

            <div className="action-row">
              <button disabled={isBusy} onClick={() => runAgent("format")}>
                智能排版
              </button>
              <button disabled={isBusy} onClick={() => runAgent("draft")}>
                生成初稿
              </button>
              <button disabled={isBusy} onClick={() => runAgent("rewrite")}>
                智能改写
              </button>
              <button disabled={isBusy} onClick={() => runAgent("summary")}>
                补导语结尾
              </button>
              <button disabled={isBusy} onClick={() => runAgent("headline")}>
                生成标题
              </button>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-heading">
              <h2>热点雷达</h2>
              <span>先抓公开信号，再转成可写的公众号选题</span>
            </div>

            <label>
              关注关键词
              <input
                value={radarKeyword}
                onChange={(event) => setRadarKeyword(event.target.value)}
                placeholder="例如：AI、出海、私域、SaaS"
              />
            </label>

            <div className="action-row single-action">
              <button disabled={isBusy} onClick={loadRadar}>
                抓热点并给选题
              </button>
            </div>

            {radarOverview ? <p className="insight-copy">{radarOverview}</p> : null}

            {suggestions.length ? (
              <div className="suggestion-list">
                {suggestions.map((suggestion) => (
                  <article key={suggestion.title} className="insight-card">
                    <div className="insight-card-header">
                      <h3>{suggestion.title}</h3>
                      <button
                        className="mini-action"
                        type="button"
                        onClick={() => applySuggestion(suggestion)}
                      >
                        带入正文
                      </button>
                    </div>
                    <p>{suggestion.angle}</p>
                    <strong>为什么现在写</strong>
                    <p>{suggestion.whyNow}</p>
                    <strong>建议提纲</strong>
                    <ul>
                      {suggestion.outline.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : null}

            {trends.length ? (
              <div className="trend-list">
                {trends.map((trend) => (
                  <a
                    key={`${trend.source}-${trend.url}`}
                    className="trend-item"
                    href={trend.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>{trend.title}</strong>
                    <span>
                      {trend.source} · {trend.summary}
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel-card">
            <div className="panel-heading">
              <h2>导出与模板</h2>
              <span>先做复制导出，下一步再接草稿箱</span>
            </div>

            <div className="template-list">
              {(Object.entries(templates) as [TemplateId, (typeof templates)[TemplateId]][]).map(
                ([id, template]) => (
                  <button
                    key={id}
                    className={templateId === id ? "template-chip active" : "template-chip"}
                    onClick={() => setTemplateId(id)}
                  >
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ),
              )}
            </div>

            <div className="action-row">
              <button className="secondary" onClick={copyMarkdown}>
                复制 Markdown
              </button>
              <button className="secondary" onClick={copyHtml}>
                复制 HTML
              </button>
            </div>
          </div>
        </div>

        <div className="editor-panel">
          <div className="panel-card fill-card">
            <div className="panel-heading">
              <h2>内容输入区</h2>
              <span>支持直接粘贴 Markdown 或纯文本</span>
            </div>
            <textarea
              className="editor-area"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="preview-panel">
          <div className="preview-stack">
            <div className="panel-card">
              <div className="panel-heading">
                <h2>视觉素材</h2>
                <span>根据当前主题生成封面图和文中配图</span>
              </div>

              <div className="action-row single-action">
                <button disabled={isBusy} onClick={generateImages}>
                  生成封面图与配图
                </button>
              </div>

              {visuals.length ? (
                <div className="visual-list">
                  {visuals.map((visual) => (
                    <article key={visual.title} className="visual-card">
                      <img alt={visual.alt} className="visual-image" src={visual.imageUrl} />
                      <div className="visual-meta">
                        <div className="insight-card-header">
                          <div>
                            <h3>{visual.title}</h3>
                            <p>{visual.direction}</p>
                            <span className="meta-badge">{visual.generationLabel}</span>
                            {visual.warning ? <p>{visual.warning}</p> : null}
                          </div>
                          <div className="mini-action-row">
                            <button
                              className="mini-action"
                              type="button"
                              onClick={() => insertVisualIntoMarkdown(visual)}
                            >
                              插入正文
                            </button>
                            <button
                              className="mini-action"
                              type="button"
                              onClick={() => downloadVisual(visual)}
                            >
                              下载图片
                            </button>
                            <button
                              className="mini-action"
                              type="button"
                              onClick={() => copyPrompt(visual.prompt)}
                            >
                              复制提示词
                            </button>
                          </div>
                        </div>
                        <p>{visual.prompt}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">
                  先确定文章主题，再生成一组适合公众号场景的视觉方案。
                </p>
              )}
            </div>

            <div className="panel-card fill-card">
              <div className="panel-heading">
                <h2>公众号预览</h2>
                <span>{templates[templateId].name}</span>
              </div>
              <div className="phone-frame">
                <div className="phone-notch" />
                <article
                  className={templates[templateId].className}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
