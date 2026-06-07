import { NextResponse } from "next/server";

import { generateVisuals } from "@/lib/image-generator";

type ImageRequest = {
  topic?: string;
  audience?: string;
  voice?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImageRequest;
    const topic = body.topic?.trim() ?? "";
    const audience = body.audience?.trim() ?? "";
    const voice = body.voice?.trim() ?? "";

    if (!topic) {
      return NextResponse.json(
        { ok: false, error: "请先填写文章主题，再生成图片。" },
        { status: 400 },
      );
    }

    const visuals = await generateVisuals({
      topic,
      audience,
      voice,
    });

    return NextResponse.json({ ok: true, visuals });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "图片生成服务发生未知错误。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
