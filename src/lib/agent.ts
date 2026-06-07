import { createChatCompletionWithMeta } from "@/lib/openai";

export type AgentAction =
  | "format"
  | "draft"
  | "rewrite"
  | "headline"
  | "summary";

export type AgentPayload = {
  action: AgentAction;
  topic: string;
  audience: string;
  goal: string;
  voice: string;
  markdown: string;
};

export type ArticleGenerationResult = {
  result: string;
  generationLabel: string;
  usedFallback: boolean;
};

function sanitizeLine(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function getAudienceNeeds(audience: string) {
  if (!audience) {
    return "公众号读者，希望快速读懂重点并获得更好的阅读体验";
  }

  return `${audience}，希望内容更清晰、更易读、更适合在公众号里阅读`;
}

function getVoiceGuide(voice: string) {
  if (!voice) {
    return "清晰、克制、适合公众号发布";
  }

  return voice;
}

function buildSystemPrompt(action: AgentAction) {
  const base = `你是一个资深中文公众号编辑，擅长把 Markdown 或纯文本整理成更适合微信公众号发布的排版版本。

统一规则：
1. 只输出 Markdown，不要输出代码块围栏外的解释。
2. 优先做“结构整理、层级优化、导语补全、列表整理、引用突出、代码块规范化”，而不是随意改写主题。
3. 不要篡改原文核心事实和论点，不要发散到无关内容。
4. 最终结果必须适合直接进入公众号排版和发布流程。
5. 避免模板化空话，避免无意义重复。`;

  if (action === "format") {
    return `${base}
当前任务：把用户粘贴进来的内容做公众号排版优化。

排版优化要求：
1. 如果原文没有清晰标题，可以补一个贴切标题。
2. 如果原文缺导语，补一个简短导语。
3. 把大段文字拆成更适合公众号阅读的段落。
4. 把可列表化的内容整理成列表。
5. 保留并规范代码块、引用、链接、小标题层级。
6. 不要过度扩写，不要凭空加入大段新观点。`;
  }

  if (action === "draft") {
    return `${base}
当前任务：根据主题、读者、目标和语气，写出一篇可直接发布的公众号初稿。`;
  }

  if (action === "rewrite") {
    return `${base}
当前任务：在保留原始主题和主线的前提下，重写现有内容，让它更完整、更成熟、更适合公众号发布。`;
  }

  if (action === "headline") {
    return `${base}
当前任务：基于现有正文生成更适合公众号发布的标题方案。

要求：
1. 先输出“## 标题备选”。
2. 提供 5 个标题。
3. 标题之后保留原正文。`;
  }

  return `${base}
当前任务：补强现有文章的开头和结尾，让它更适合公众号发布。`;
}

function buildUserPrompt(payload: AgentPayload) {
  const readerNeed = getAudienceNeeds(payload.audience);
  const voiceGuide = getVoiceGuide(payload.voice);

  if (payload.action === "format") {
    return `请把下面这份内容整理成更适合微信公众号发布的 Markdown 成稿。

主题参考：${sanitizeLine(payload.topic || "未提供明确主题，请根据正文判断")}
目标读者：${readerNeed}
发布目标：${sanitizeLine(payload.goal || "优化排版和阅读体验")}
希望保留的语气：${voiceGuide}

请重点做这些事：
1. 梳理标题层级。
2. 优化导语、段落和换行。
3. 把零散内容整理成更适合公众号阅读的结构。
4. 保留原文含义，不要偏题。

原始内容如下：
${payload.markdown}`;
  }

  if (payload.action === "draft") {
    return `请围绕以下约束直接写成一篇适合微信公众号发布的中文文章。

主题：${sanitizeLine(payload.topic)}
目标读者：${readerNeed}
发布目标：${sanitizeLine(payload.goal || "写出一篇读者愿意读完并产生认同的公众号文章")}
写作语气：${voiceGuide}`;
  }

  if (payload.action === "rewrite") {
    return `请把下面这份草稿重写成一篇更成熟、能直接发布的公众号文章。

主题：${sanitizeLine(payload.topic || "请根据正文判断主题")}
目标读者：${readerNeed}
发布目标：${sanitizeLine(payload.goal || "让文章更完整、更有说服力")}
写作语气：${voiceGuide}

现有正文：
${payload.markdown}`;
  }

  if (payload.action === "headline") {
    return `请根据这篇文章内容生成标题方案。

主题：${sanitizeLine(payload.topic || "请根据正文判断主题")}
目标读者：${readerNeed}
写作语气：${voiceGuide}

正文如下：
${payload.markdown}`;
  }

  return `请补强这篇文章的导语和结尾，让它更适合公众号发布。

主题：${sanitizeLine(payload.topic || "请根据正文判断主题")}
目标读者：${readerNeed}
发布目标：${sanitizeLine(payload.goal || "让文章首尾更完整、更适合发布")}
写作语气：${voiceGuide}

正文如下：
${payload.markdown}`;
}

function inferTitleFromBody(markdown: string) {
  const lines = markdown
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const firstMeaningful = lines.find((line) => !line.startsWith("```")) ?? "公众号内容整理稿";
  return firstMeaningful.replace(/^#+\s*/, "").slice(0, 28) || "公众号内容整理稿";
}

function normalizePlainParagraphs(input: string) {
  const lines = input.replace(/\r/g, "").split("\n");
  const paragraphs: string[] = [];
  let bucket: string[] = [];

  const flush = () => {
    if (!bucket.length) {
      return;
    }
    paragraphs.push(bucket.join(""));
    bucket = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }

    if (/^(#|>|- |\* |\d+\.)/.test(line) || line.startsWith("```")) {
      flush();
      paragraphs.push(line);
      continue;
    }

    bucket.push(line);
  }

  flush();
  return paragraphs;
}

function buildFormatFallback(payload: AgentPayload) {
  const source = payload.markdown.trim();
  const title = sanitizeLine(payload.topic) || inferTitleFromBody(source);
  const normalizedParagraphs = normalizePlainParagraphs(source);
  const body = normalizedParagraphs
    .map((paragraph, index) => {
      if (/^(#|>|- |\* |\d+\.|```)/.test(paragraph)) {
        return paragraph;
      }

      if (index === 0) {
        return `## 开始之前\n\n${paragraph}`;
      }

      return paragraph;
    })
    .join("\n\n");

  const intro = `> 这是一版已经过公众号阅读节奏优化的整理稿。重点不是改主题，而是让结构、段落和层级更清楚。`;

  if (!body) {
    return `# ${title}\n\n${intro}\n\n## 正文\n\n请先粘贴需要排版的 Markdown 或文本内容。`;
  }

  return `# ${title}\n\n${intro}\n\n${body}`;
}

function buildHeadlineFallback(payload: AgentPayload) {
  const title = sanitizeLine(payload.topic) || inferTitleFromBody(payload.markdown);
  return `## 标题备选

1. ${title}
2. 关于${title}，这篇文章帮你把重点整理清楚了
3. ${title}：一版更适合公众号阅读的整理稿
4. 这篇关于${title}的内容，终于被讲清楚了
5. 如果你正在关注${title}，这版排版更值得读完

${payload.markdown}`;
}

function buildSummaryFallback(payload: AgentPayload) {
  return `> 先给你一个更适合公众号开头的导语：这篇内容不是简单堆信息，而是试图把${payload.topic || "主题"}讲得更清楚、更易读。

${payload.markdown}

## 最后总结

如果这篇内容要真正适合公众号发布，最重要的不是多写，而是让读者更顺畅地读下去。结构清楚、段落克制、重点明确，本身就是排版优化最有价值的部分。`;
}

function buildDraftFallback(payload: AgentPayload) {
  const title = sanitizeLine(payload.topic) || "公众号初稿";
  const audience = payload.audience || "公众号读者";

  return `# ${title}

> 这篇文章写给${audience}。下面先给出一版结构完整、可以继续润色的公众号初稿。

## 先说结论

围绕“${title}”这类主题，读者真正需要的不是更多空泛观点，而是更清楚的判断、更顺畅的阅读体验，以及更容易带走的重点。

## 为什么这个主题值得写

它之所以值得写，不是因为热闹，而是因为它和实际认知、表达和行动有关。只要把结构搭好，文章本身就会更容易建立信任。

## 这篇内容应该怎么展开

1. 先交代问题背景。
2. 再给出核心判断。
3. 最后落到可执行建议。

## 最后总结

一篇能发的公众号文章，靠的不是堆字数，而是清晰结构和稳定表达。`;
}

function buildRewriteFallback(payload: AgentPayload) {
  const title = sanitizeLine(payload.topic) || inferTitleFromBody(payload.markdown);
  return `# ${title}

> 下面是一版在保留原意基础上，重构过节奏和层级的公众号版本。

${normalizePlainParagraphs(payload.markdown).join("\n\n")}
`;
}

function buildFallback(payload: AgentPayload) {
  if (payload.action === "format") {
    return buildFormatFallback(payload);
  }

  if (payload.action === "headline") {
    return buildHeadlineFallback(payload);
  }

  if (payload.action === "summary") {
    return buildSummaryFallback(payload);
  }

  if (payload.action === "rewrite") {
    return buildRewriteFallback(payload);
  }

  return buildDraftFallback(payload);
}

function normalizeModelOutput(action: AgentAction, result: string, payload: AgentPayload) {
  const trimmed = result.trim();
  if (!trimmed) {
    return buildFallback(payload);
  }

  if (action === "headline" && !trimmed.includes("## 标题备选")) {
    return `## 标题备选\n\n${trimmed}`;
  }

  return trimmed;
}

export async function generateArticle(payload: AgentPayload): Promise<ArticleGenerationResult> {
  const generated = await createChatCompletionWithMeta({
    systemPrompt: buildSystemPrompt(payload.action),
    userPrompt: buildUserPrompt(payload),
    temperature: payload.action === "headline" ? 0.9 : 0.55,
  });

  if (!generated) {
    return {
      result: buildFallback(payload),
      generationLabel: "当前为本地兜底稿",
      usedFallback: true,
    };
  }

  return {
    result: normalizeModelOutput(payload.action, generated.content, payload),
    generationLabel: generated.meta.label,
    usedFallback: false,
  };
}
