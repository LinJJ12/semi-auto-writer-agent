import { NextResponse } from "next/server";

import { getTopicSuggestions } from "@/lib/trend-radar";

type RadarRequest = {
  keyword?: string;
  audience?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RadarRequest;
    const keyword = body.keyword?.trim() ?? "";
    const audience = body.audience?.trim() ?? "";

    const result = await getTopicSuggestions(keyword, audience);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "热点抓取服务发生未知错误。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
