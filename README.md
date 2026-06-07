# Artile Agent Studio

一个面向公众号创作的半自动智能体工作台。

当前这版先聚焦最核心的内容生产链路：

- 抓取公开热点线索，并生成公众号选题建议
- 录入选题、目标读者、输出目标、语气风格
- 调用 AI 生成初稿、改写正文、生成标题、补充导语
- 生成封面图与文中配图
- 使用 Markdown 编辑正文
- 实时预览 3 套公众号排版模板
- 复制 Markdown 或 HTML，便于后续接公众号草稿箱

## 技术栈

- Next.js 16
- React 19
- App Router API Route
- 百炼优先、OpenAI 备用的兼容接口调用

## 本地运行

1. 安装依赖

```bash
cmd /c npm install
```

2. 配置环境变量

把 `.env.example` 复制为 `.env.local`，并填写：

```bash
BAILIAN_API_KEY=your_bailian_api_key_here
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_MODEL=qwen-plus
BAILIAN_IMAGE_MODEL=wanx2.1-t2i-turbo

OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-1
```

推荐优先配置阿里云百炼；如果百炼不可用，服务端会自动尝试 OpenAI。两套都不填时，页面也可以运行：

- 文稿生成会返回本地兜底草稿
- 热点雷达会返回本地兜底趋势
- 图片生成功能会返回本地 SVG 占位视觉

3. 启动开发环境

```bash
cmd /c npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 迁移目录后的注意事项

如果项目从一个磁盘或目录移动到另一个位置，Next.js 的构建缓存里可能还保留旧的绝对路径。出现这类情况时，先执行：

```bash
cmd /c npm run clean
cmd /c npm run build
```

如果 `build` 能通过，通常说明项目已经适配新路径。

## 项目结构

- `src/app/page.tsx`: 创作工作台首页
- `src/app/api/agent/route.ts`: 智能体接口
- `src/app/api/radar/route.ts`: 热点抓取与选题建议接口
- `src/app/api/images/route.ts`: 封面图与配图生成接口
- `src/app/globals.css`: 工作台与公众号模板样式

## 热点源

热点雷达当前优先抓取更贴近中文内容生态的一组公开 RSS：

- 36Kr
- 爱范儿
- 少数派
- 极客公园
- 雷锋网
- 人人都是产品经理
