import { NextResponse } from "next/server";

import type { AgentAction } from "@/lib/agent";
import { generateArticle } from "@/lib/agent";

type AgentRequest = {
  action?: AgentAction;
  topic?: string;
  audience?: string;
  goal?: string;
  voice?: string;
  markdown?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentRequest;
    const payload = {
      action: body.action ?? "format",
      topic: body.topic?.trim() ?? "",
      audience: body.audience?.trim() ?? "",
      goal: body.goal?.trim() ?? "",
      voice: body.voice?.trim() ?? "",
      markdown: body.markdown?.trim() ?? "",
    };

    if (!payload.topic) {
      return NextResponse.json(
        { ok: false, error: "请先填写文章主题。" },
        { status: 400 },
      );
    }

    const generated = await generateArticle(payload);

    return NextResponse.json({
      ok: true,
      result: generated.result,
      meta: {
        usedFallback: generated.usedFallback,
        generationLabel: generated.generationLabel,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "服务端发生未知错误。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
