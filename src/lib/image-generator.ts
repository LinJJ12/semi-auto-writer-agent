import "server-only";

import { createImageGenerationWithMeta } from "@/lib/openai";

export type GeneratedVisual = {
  title: string;
  prompt: string;
  imageUrl: string;
  alt: string;
  format: "cover" | "inline";
  direction: string;
  generationLabel: string;
  warning?: string;
};

type GenerateImagesInput = {
  topic: string;
  audience: string;
  voice: string;
};

type VisualDirection = {
  key: string;
  label: string;
  accent: string;
  coverHint: string;
  inlineHint: string;
};

const VISUAL_DIRECTIONS: VisualDirection[] = [
  {
    key: "editorial",
    label: "杂志编辑感",
    accent: "#d98f6b",
    coverHint: "像一本商业杂志封面，强调留白、排版感、纸张肌理和克制的高级感。",
    inlineHint: "像杂志内页的概念插图，简洁、有留白，适合作为分析型文章配图。",
  },
  {
    key: "diagram",
    label: "概念图解风",
    accent: "#a9634c",
    coverHint: "用结构图、卡片、流程意象做封面，不走写实风，更像一张观点图海报。",
    inlineHint: "做成图解式插图，强调结构关系、流程、框架、层级。",
  },
  {
    key: "scene",
    label: "场景叙事风",
    accent: "#c87b59",
    coverHint: "像品牌长文头图，带轻微叙事场景，但保持克制，不要过满。",
    inlineHint: "像文章中的情境配图，用一个简洁场景承载观点，不要做成海报。",
  },
];

function escapeSvgText(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildFallbackDataUrl(
  title: string,
  subtitle: string,
  accent: string,
  directionLabel: string,
) {
  const safeTitle = escapeSvgText(title);
  const safeSubtitle = escapeSvgText(subtitle);
  const safeDirection = escapeSvgText(directionLabel);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fbf4eb" />
          <stop offset="48%" stop-color="#f0dfd0" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="675" rx="40" fill="url(#bg)" />
      <rect x="62" y="62" width="1076" height="551" rx="30" fill="rgba(255,255,255,0.64)" />
      <circle cx="1018" cy="132" r="126" fill="rgba(255,255,255,0.22)" />
      <circle cx="165" cy="548" r="176" fill="rgba(178,74,43,0.10)" />
      <rect x="110" y="120" width="210" height="36" rx="999" fill="rgba(255,255,255,0.82)" />
      <text x="136" y="145" fill="#8f3419" font-family="'IBM Plex Mono',monospace" font-size="18">ARTILE VISUAL</text>
      <text x="110" y="222" fill="#5f3629" font-family="'Noto Serif SC','Source Han Serif SC',serif" font-size="28">${safeDirection}</text>
      <text x="110" y="318" fill="#241b16" font-family="'Noto Serif SC','Source Han Serif SC',serif" font-size="62" font-weight="700">
        <tspan x="110" dy="0">${safeTitle}</tspan>
      </text>
      <text x="110" y="408" fill="#6e4a3a" font-family="'Noto Serif SC','Source Han Serif SC',serif" font-size="28">
        <tspan x="110" dy="0">${safeSubtitle}</tspan>
      </text>
      <path d="M812 448 C890 370, 1000 360, 1070 430" stroke="rgba(143,52,25,0.24)" stroke-width="5" fill="none" stroke-linecap="round" />
      <path d="M782 500 C860 430, 975 430, 1038 494" stroke="rgba(143,52,25,0.18)" stroke-width="4" fill="none" stroke-linecap="round" />
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildCoverPrompt(
  { topic, audience, voice }: GenerateImagesInput,
  direction: VisualDirection,
) {
  return `为微信公众号文章生成一张横版封面图，比例 16:9。
主题：${topic}
目标读者：${audience || "公众号读者"}
语气风格：${voice || "专业、清晰、有判断"}
视觉方向：${direction.label}

要求：
1. ${direction.coverHint}
2. 适合做公众号头图，主体清楚，留出可放标题的空间。
3. 不要廉价科技蓝，不要明显水印，不要杂乱拼贴。
4. 画面要有辨识度，不要和常见 AI 占位图一个味道。`;
}

function buildInlinePrompt(
  { topic, audience, voice }: GenerateImagesInput,
  direction: VisualDirection,
) {
  return `为微信公众号文章生成一张文中配图，比例 4:3。
主题：${topic}
目标读者：${audience || "公众号读者"}
语气风格：${voice || "专业、清晰、有判断"}
视觉方向：${direction.label}

要求：
1. ${direction.inlineHint}
2. 适合嵌入知识型、分析型、观点型文章。
3. 不要出现密集小字，不要水印，不要做成同款模板图。
4. 强调内容气质和结构感，而不是纯装饰。`;
}

export async function generateVisuals(input: GenerateImagesInput) {
  const generatedVisuals: GeneratedVisual[] = [];
  const errorMessages: string[] = [];

  async function generateWithRetry(prompt: string, size: string) {
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await createImageGenerationWithMeta({
          prompt,
          size,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "图片生成失败，但未返回详细错误。";

        if (
          attempt < maxAttempts - 1 &&
          /rate limit exceeded/i.test(message)
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2200));
          continue;
        }

        throw new Error(message);
      }
    }

    return null;
  }

  for (const direction of VISUAL_DIRECTIONS) {
    const coverPrompt = buildCoverPrompt(input, direction);
    const inlinePrompt = buildInlinePrompt(input, direction);

    try {
      const coverUrl = await generateWithRetry(coverPrompt, "1536x1024");
      if (coverUrl) {
        generatedVisuals.push({
          title: `${direction.label}封面图`,
          prompt: coverPrompt,
          imageUrl: coverUrl.imageUrl,
          alt: `${input.topic} ${direction.label}封面图`,
          format: "cover",
          direction: direction.label,
          generationLabel: coverUrl.meta.label,
        });
      }
    } catch (error) {
      errorMessages.push(
        `${direction.label}封面图：${error instanceof Error ? error.message : "生成失败"}`,
      );
    }

    try {
      const inlineUrl = await generateWithRetry(inlinePrompt, "1024x1024");
      if (inlineUrl) {
        generatedVisuals.push({
          title: `${direction.label}文中配图`,
          prompt: inlinePrompt,
          imageUrl: inlineUrl.imageUrl,
          alt: `${input.topic} ${direction.label}文中配图`,
          format: "inline",
          direction: direction.label,
          generationLabel: inlineUrl.meta.label,
        });
      }
    } catch (error) {
      errorMessages.push(
        `${direction.label}文中配图：${error instanceof Error ? error.message : "生成失败"}`,
      );
    }
  }

  if (generatedVisuals.length) {
    if (errorMessages.length) {
      return generatedVisuals.map((visual) => ({
        ...visual,
        warning: `部分图片生成失败：${errorMessages.join(" | ")}`,
      }));
    }

    return generatedVisuals;
  }

  const lastErrorMessage =
    errorMessages.join(" | ") || "未命中可用图片模型，已回退为本地 SVG 占位图。";

  return VISUAL_DIRECTIONS.flatMap((direction) => [
    {
      title: `${direction.label}封面图`,
      prompt: buildCoverPrompt(input, direction),
      imageUrl: buildFallbackDataUrl(
        input.topic || "公众号选题",
        "适合作为头图的占位封面",
        direction.accent,
        direction.label,
      ),
      alt: `${input.topic || "公众号选题"} ${direction.label}封面图`,
      format: "cover" as const,
      direction: direction.label,
      generationLabel: "当前为本地 SVG 兜底图",
      warning: lastErrorMessage,
    },
    {
      title: `${direction.label}文中配图`,
      prompt: buildInlinePrompt(input, direction),
      imageUrl: buildFallbackDataUrl(
        input.topic || "文章结构图",
        "适合作为文中配图的占位方案",
        direction.accent,
        direction.label,
      ),
      alt: `${input.topic || "文章结构图"} ${direction.label}文中配图`,
      format: "inline" as const,
      direction: direction.label,
      generationLabel: "当前为本地 SVG 兜底图",
      warning: lastErrorMessage,
    },
  ]);
}
