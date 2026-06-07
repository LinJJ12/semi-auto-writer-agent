export type ProviderName = "bailian" | "openai";

export type GenerationMeta = {
  provider: ProviderName;
  label: string;
};

type ProviderConfig = {
  name: ProviderName;
  apiKey?: string;
  baseUrl: string;
  chatModel: string;
  imageModel: string;
};

type ChatCompletionOptions = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
};

type GeneratedImagePayload = {
  prompt: string;
  size?: string;
};

type ImageGenerationResult = {
  imageUrl: string;
  meta: GenerationMeta;
  errorTrail?: string[];
};

function getProviders(): ProviderConfig[] {
  const bailianBaseUrl =
    process.env.BAILIAN_BASE_URL?.replace(/\/$/, "") ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const openAIBaseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
    "https://api.openai.com/v1";

  return [
    {
      name: "bailian",
      apiKey: process.env.BAILIAN_API_KEY,
      baseUrl: bailianBaseUrl,
      chatModel: process.env.BAILIAN_MODEL ?? "qwen-plus",
      imageModel: process.env.BAILIAN_IMAGE_MODEL ?? "wanx2.1-t2i-turbo",
    },
    {
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: openAIBaseUrl,
      chatModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      imageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
    },
  ];
}

export function getConfiguredProviders() {
  return getProviders().filter((provider) => provider.apiKey);
}

function providerToLabel(provider: ProviderName) {
  if (provider === "bailian") {
    return "已使用百炼生成";
  }

  return "已使用 OpenAI 生成";
}

async function createProviderChatCompletion(
  provider: ProviderConfig,
  { systemPrompt, userPrompt, model, temperature = 0.8 }: ChatCompletionOptions,
) {
  const targetUrl = `${provider.baseUrl}/chat/completions`;
  const targetModel = model ?? provider.chatModel;
  let response: Response;

  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        temperature,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知网络错误";
    throw new Error(
      `${provider.name} 文本模型网络请求失败：${message}（model=${targetModel}, url=${targetUrl}）`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider.name} 文本模型调用失败：${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function createChatCompletion(options: ChatCompletionOptions) {
  const providers = getConfiguredProviders();
  if (!providers.length) {
    return null;
  }

  let lastError: Error | null = null;
  const errorTrail: string[] = [];

  for (const provider of providers) {
    try {
      const result = await createProviderChatCompletion(provider, options);
      if (result) {
        return result;
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("未知的文本模型调用错误。");
      errorTrail.push(lastError.message);
    }
  }

  if (errorTrail.length) {
    throw new Error(errorTrail.join(" | "));
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export async function createChatCompletionWithMeta(options: ChatCompletionOptions) {
  const providers = getConfiguredProviders();
  if (!providers.length) {
    return null;
  }

  let lastError: Error | null = null;
  const errorTrail: string[] = [];

  for (const provider of providers) {
    try {
      const result = await createProviderChatCompletion(provider, options);
      if (result) {
        return {
          content: result,
          meta: {
            provider: provider.name,
            label: providerToLabel(provider.name),
          } satisfies GenerationMeta,
        };
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("未知的文本模型调用错误。");
      errorTrail.push(lastError.message);
    }
  }

  if (errorTrail.length) {
    throw new Error(errorTrail.join(" | "));
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

async function createProviderImage(provider: ProviderConfig, payload: GeneratedImagePayload) {
  if (provider.name === "bailian") {
    return createBailianImage(provider, payload);
  }

  const targetUrl = `${provider.baseUrl}/images/generations`;
  let response: Response;

  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.imageModel,
        prompt: payload.prompt,
        size: payload.size ?? "1536x1024",
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知网络错误";
    throw new Error(
      `${provider.name} 图片模型网络请求失败：${message}（model=${provider.imageModel}, url=${targetUrl}）`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider.name} 图片模型调用失败：${errorText}`);
  }

  const data = (await response.json()) as {
    data?: Array<{
      url?: string;
      b64_json?: string;
    }>;
  };

  const first = data.data?.[0];
  if (first?.url) {
    return first.url;
  }

  if (first?.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  return null;
}

function getBailianApiOrigin(baseUrl: string) {
  return baseUrl.replace(/\/compatible-mode\/v1$/, "").replace(/\/v1$/, "");
}

function normalizeBailianSize(size?: string) {
  if (!size) {
    return "1664*928";
  }

  return size.replace("x", "*");
}

function isBailianQwenImageModel(model: string) {
  return model.startsWith("qwen-image");
}

function isBailianWanImageModel(model: string) {
  return model.startsWith("wan2.7-image") || model.startsWith("wan2.6-image");
}

function getBailianImageCandidates(model: string) {
  const candidates = [model];

  if (model === "wanx-v1") {
    candidates.push("qwen-image-2.0-pro", "wan2.7-image");
  } else if (!isBailianQwenImageModel(model) && !isBailianWanImageModel(model)) {
    candidates.push("qwen-image-2.0-pro", "wan2.7-image");
  }

  return [...new Set(candidates)];
}

function extractBailianImageUrl(data: unknown) {
  const payload = data as {
    output?: {
      choices?: Array<{
        message?: {
          content?: Array<{
            image?: string;
          }>;
        };
      }>;
    };
  };
  const output = payload.output;
  return output?.choices?.[0]?.message?.content?.[0]?.image ?? null;
}

async function pollBailianTask(origin: string, apiKey: string, taskId: string) {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));

    let response: Response;

    try {
      response = await fetch(`${origin}/api/v1/tasks/${taskId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知网络错误";
      throw new Error(`百炼任务查询网络失败：${message}（taskId=${taskId}, url=${origin}/api/v1/tasks/${taskId}）`);
    }

    const data = (await response.json()) as {
      code?: string;
      message?: string;
      output?: {
        task_status?: string;
        choices?: Array<{
          message?: {
            content?: Array<{
              image?: string;
            }>;
          };
        }>;
      };
    };

    if (!response.ok) {
      throw new Error(`百炼任务查询失败：${data.message ?? response.statusText}`);
    }

    const taskStatus = data.output?.task_status;
    if (taskStatus === "SUCCEEDED") {
      const imageUrl = extractBailianImageUrl(data);
      if (imageUrl) {
        return imageUrl;
      }
      throw new Error("百炼任务已成功，但没有返回图片地址。");
    }

    if (taskStatus === "FAILED" || taskStatus === "CANCELED" || taskStatus === "UNKNOWN") {
      throw new Error(`百炼任务失败，状态：${taskStatus}，信息：${data.message ?? "无详细信息"}`);
    }
  }

  throw new Error("百炼图片任务轮询超时，请稍后重试。");
}

async function createBailianQwenImage(
  provider: ProviderConfig,
  model: string,
  payload: GeneratedImagePayload,
) {
  const origin = getBailianApiOrigin(provider.baseUrl);
  const targetUrl = `${origin}/api/v1/services/aigc/multimodal-generation/generation`;
  let response: Response;

  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  text: payload.prompt,
                },
              ],
            },
          ],
        },
        parameters: {
          size: normalizeBailianSize(payload.size),
          watermark: false,
          prompt_extend: true,
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知网络错误";
    throw new Error(
      `百炼图片模型 ${model} 网络请求失败：${message}（url=${targetUrl}）`,
    );
  }

  const data = (await response.json()) as {
    code?: string;
    message?: string;
    output?: {
      choices?: Array<{
        message?: {
          content?: Array<{
            image?: string;
          }>;
        };
      }>;
    };
  };

  if (!response.ok) {
    throw new Error(`百炼图片模型 ${model} 调用失败：${data.message ?? response.statusText}`);
  }

  const imageUrl = extractBailianImageUrl(data);
  if (!imageUrl) {
    throw new Error(`百炼图片模型 ${model} 没有返回图片地址。`);
  }

  return imageUrl;
}

async function createBailianWanImage(
  provider: ProviderConfig,
  model: string,
  payload: GeneratedImagePayload,
) {
  const origin = getBailianApiOrigin(provider.baseUrl);
  const targetUrl = `${origin}/api/v1/services/aigc/image-generation/generation`;
  let response: Response;

  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  text: payload.prompt,
                },
              ],
            },
          ],
        },
        parameters: {
          size: normalizeBailianSize(payload.size),
          n: 1,
          watermark: false,
          thinking_mode: true,
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知网络错误";
    throw new Error(
      `百炼图片模型 ${model} 网络请求失败：${message}（url=${targetUrl}）`,
    );
  }

  const data = (await response.json()) as {
    code?: string;
    message?: string;
    output?: {
      task_id?: string;
      task_status?: string;
    };
  };

  if (!response.ok) {
    throw new Error(`百炼图片模型 ${model} 调用失败：${data.message ?? response.statusText}`);
  }

  const taskId = data.output?.task_id;
  if (!taskId) {
    throw new Error(`百炼图片模型 ${model} 没有返回任务 ID。`);
  }

  return pollBailianTask(origin, provider.apiKey!, taskId);
}

async function createBailianImage(provider: ProviderConfig, payload: GeneratedImagePayload) {
  const candidates = getBailianImageCandidates(provider.imageModel);
  const errors: string[] = [];

  for (const model of candidates) {
    try {
      if (isBailianQwenImageModel(model)) {
        return await createBailianQwenImage(provider, model, payload);
      }

      if (isBailianWanImageModel(model)) {
        return await createBailianWanImage(provider, model, payload);
      }

      errors.push(`模型 ${model} 不属于当前支持的百炼图片模型列表。`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `模型 ${model} 调用失败。`);
    }
  }

  throw new Error(errors.join(" | "));
}

export async function createImageGeneration(payload: GeneratedImagePayload) {
  const providers = getConfiguredProviders();
  if (!providers.length) {
    return null;
  }

  let lastError: Error | null = null;
  const errorTrail: string[] = [];

  for (const provider of providers) {
    try {
      const result = await createProviderImage(provider, payload);
      if (result) {
        return result;
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("未知的图片模型调用错误。");
      errorTrail.push(lastError.message);
    }
  }

  if (errorTrail.length) {
    throw new Error(errorTrail.join(" | "));
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export async function createImageGenerationWithMeta(payload: GeneratedImagePayload) {
  const providers = getConfiguredProviders();
  if (!providers.length) {
    return null;
  }

  let lastError: Error | null = null;
  const errorTrail: string[] = [];

  for (const provider of providers) {
    try {
      const result = await createProviderImage(provider, payload);
      if (result) {
        return {
          imageUrl: result,
          meta: {
            provider: provider.name,
            label: providerToLabel(provider.name),
          } satisfies GenerationMeta,
        } satisfies ImageGenerationResult;
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("未知的图片模型调用错误。");
      errorTrail.push(lastError.message);
    }
  }

  if (errorTrail.length) {
    throw new Error(errorTrail.join(" | "));
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export function parseJsonFromModel<T>(input: string): T | null {
  const fencedMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? input.trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const objectStart = candidate.indexOf("{");
    const objectEnd = candidate.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(
          candidate.slice(objectStart, objectEnd + 1),
        ) as T;
      } catch {
        return null;
      }
    }
  }

  return null;
}
