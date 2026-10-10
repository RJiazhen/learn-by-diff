# Phase: Develop（功能未完成）

1. 对照 Issue 验收标准 / checklist，列出**剩余项**。
2. 继续实现。改动落在对应包：
   - 协议：`packages/protocol`（改 `src` 后必须 `pnpm exec vp run @learn-by-diff/protocol#pack`）
   - 扩展：`apps/vscode-extension`
   - 站点：`apps/website`
   - 演示课程：`examples/`（不要改 `sandbox/**` 生成态）
3. 改完一个逻辑变更后按 [commit.md](./commit.md) 提交。
4. 按改动范围跑验证：
   - `pnpm exec vp check`
   - `pnpm exec vp run -r test`（或只跑相关 package 的 test）
   - 协议变更后再 pack，再跑扩展相关测试
   - 站点改动：`pnpm --filter website build`（或 `pnpm --filter website dev` 做本地确认）
5. 验收完成后停止。禁止 push / 开 PR。工作区干净且有未推送提交时，下次 `/continue` 进入 **Ship**。

---

# Phase: Wait（PR 已开，等待验收）

- 汇报 PR 链接、`gh pr checks` 状态
- 列出未通过项
- 站点在版本 tag（`v*`）推送时部署到 GitHub Pages：`https://rjiazhen.github.io/learn-by-diff/`（PR 上没有独立预览环境）
- 工作区干净且已推送时，验收通过后再次执行本 skill 进入 Merge。仅未推送则走 Ship
