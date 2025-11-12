# CheckAI Fact-Checking MVP

Next.js (App Router) + TypeScript + Tailwind 实现的事实核查最小可用产品，覆盖 `.docx`/文本摄取、Qwen Plus 结构化抽取、自定义 Serper 检索、NLI 判定、可视化与 Markdown 报告导出。

## 功能速览
- `.docx` 上传 & 文本粘贴：`mammoth` 解析段落/句子，并保持映射以便高亮。
- 可核查陈述识别：`/api/claims` 调用 Qwen Plus（OpenAI 兼容）输出严格 JSON，经 Zod 校验。
- Serper 联网检索：`/api/search` 使用 Serper (Google Search API) 获取权威网页，再经本地归一化。
- 事实核验：`/api/verify` 直接调用 Qwen Plus NLI 代理，`lib/scoring.ts` 融合权重得到标签+置信度。
- UI：左侧原文同步高亮，右侧陈述列表 + 过滤 + 证据抽屉；顶部 SummaryBar 与 Markdown 导出按钮。
- 报告导出：`/api/report` 生成含引用列表的 Markdown，前端可直接下载。
- 健壮性：所有 API 输入/输出均由 Zod 校验；Qwen JSON 失败自动重试并有 fallback 模板。
- 测试：`tests/parsing.test.ts`、`tests/scoring.test.ts` 覆盖解析与打分逻辑。

## 目录
```
app/
  api/        // App Router handlers (/api/*)
  page.tsx    // 入口页
components/   // UploadArea、DocPreview、ClaimsList、EvidenceDrawer 等 UI
lib/          // qwen、parsing、nli、scoring、report、schemas
tests/        // Vitest 单元测试
```

## 环境变量
将以下变量填入 `.env.local`（`pnpm dev` 会自动读取）：

| 变量 | 说明 | 获取方式 |
| --- | --- | --- |
| `QWEN_API_KEY` | Qwen Plus API Key | [DashScope 控制台](https://dashscope.aliyun.com/) 申请，填入 `lib/qwen.ts` 默认 baseURL 可覆盖 `QWEN_BASE_URL` |
| `SERPER_API_KEY` | Serper (Google Search API) 密钥 | [Serper.dev](https://serper.dev) 控制台创建 |
| `SERPER_LOCATION` | Serper 搜索地区 (gl) | 默认 `us` |
| `SERPER_LANGUAGE` | Serper 搜索语言 (hl) | 默认 `en` |
| `SUPPORT_THRESHOLD` `REFUTE_THRESHOLD` `COVERAGE_DIVISOR` `CONFIDENCE_BASE_WEIGHT` | 置信度/融合参数 | 可按需要在 `.env` 调整 |

## 本地开发
```bash
pnpm install
pnpm dev           # http://localhost:3000
```

### 生产构建 / 部署
```bash
pnpm build
pnpm start -- --port 3000
```
- **Vercel**：直接 `vercel deploy`，需要在 Vercel Dashboard 配置上述环境变量。
- **Node 自托管**：构建后将 `.next`, `package.json`, `node_modules` 上传至服务器并运行 `pnpm start`。

## 测试
```bash
pnpm test
```
Vitest 在 `tests/` 下运行解析与打分单元测试，可扩展更多场景。

## 检索 & NLI 切换
- **检索通道**：`/api/search` 通过 Serper (Google Search API) 获取网页，再结合域名白名单去重与权威度估计。
- **NLI 实现**：`lib/nli.ts` 直接调用 `callQwenJSON` 生成三分类分布，可在 README 中说明当前使用策略。

## API 摘要
- `POST /api/extract`：FormData/JSON -> `{ paragraphs, sentences, mapping }`
- `POST /api/claims`：`{ sentences, mapping, context }` -> `Claim[]`
- `POST /api/search`：`{ claim, sources? }` -> `EvidenceCandidate[]`
- `POST /api/verify`：`{ claim, evidences }` -> `Verification[]`
- `POST /api/report`：`{ claims, verifications, generatedAt? }` -> `{ markdown }`

所有端点均使用 `lib/schemas.ts` 中的 Zod Schema 校验输入输出，确保前后端一致。

## 使用指南
1. 上传 `.docx` 或粘贴文本；解析成功后左侧显示段落，自动高亮可核查句子。
2. 系统自动触发 Qwen Plus 抽取 ≥5 条陈述，右侧以骨架屏展示待命状态。
3. 每条陈述逐步完成外部检索与 NLI 判定，标签与置信度实时刷新，可用顶部筛选器过滤。
4. 点击某条陈述打开右侧证据抽屉，查看引用来源、时间、权威度及跳转链接。
5. 所有陈述判定完成后，点击“导出 Markdown 报告”生成含引用列表的文件。

## 免责声明
本工具基于外部 API 与 LLM 推理，结论存在不确定性，不能视作最终裁决。请始终结合引用链接与原始来源进行人工复核。
