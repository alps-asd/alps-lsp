# ADR 0001: ALPS LSP Roadmap

## Status

Accepted

## Context

ALPS LSP サーバーを vscode-asd から移植した。現在の実装は基本的な補完とバリデーションをサポートしている。

## Current Features (v0.1.0)

- [x] XML/JSON 形式の補完
- [x] descriptor 参照補完 (`#id`)
- [x] Schema.org 語彙補完 (2700+ 用語)
- [x] type 属性補完 (`semantic`, `safe`, `unsafe`, `idempotent`)
- [x] XML バリデーション (SAX ベース)
- [x] JSON バリデーション (JSONC パーサー)
- [x] stdio 通信

## Missing Features

### High Priority

- [x] **Go to Definition**: `href="#id"` から定義元へジャンプ
- [x] **Find References**: descriptor の参照箇所一覧
- [x] **Hover Information**: descriptor にホバーで doc 表示
- [x] **Rename Symbol**: descriptor id のリネーム
- [x] **Document Symbols**: アウトライン表示

### Medium Priority

- [ ] **WebSocket 対応**: ブラウザエディター (Ace) との通信
- [ ] **TCP 対応**: リモート接続
- [ ] **Semantic Tokens**: 構文ハイライト強化
- [ ] **Code Actions**: Quick fix 提案
- [ ] **Formatting**: ドキュメント整形

### Low Priority

- [ ] **Workspace Symbols**: ワークスペース全体の検索
- [ ] **Folding Range**: コード折りたたみ
- [ ] **Selection Range**: スマート選択
- [ ] **Call Hierarchy**: 遷移階層表示

## Integration Plan

### Phase 1: vscode-asd 統合

```
vscode-asd
└── uses @alps-asd/lsp as dependency
```

### Phase 2: WebSocket 対応

```
Ace Editor (browser)
    │
    │ WebSocket
    ▼
WebSocket Bridge
    │
    │ stdio
    ▼
alps-lsp
```

### Phase 3: 他エディター対応

- JetBrains plugin
- Vim/Neovim 設定例
- Emacs 設定例

## Decision

LSP サーバーを独立パッケージとして開発し、複数のエディターで共有する。

## Consequences

- 一箇所の改善が全エディターに反映される
- テストとメンテナンスが集約される
- エディター固有の機能は各プラグインで実装

## Technical Debt / Future Improvements

### CodeRabbit Review Issues (Deferred - Low Priority)

The following issues are deferred for now and will be addressed when necessary:

#### src/cli.ts - CLI argument parsing (Minor)
- Current: Uses stdio transport by default
- Issue: `--stdio` and `--socket` flags not implemented
- Decision: stdio-only is sufficient. Revisit when WebSocket/TCP support is added

#### src/jsonParser.ts - Error handling (Refactor suggestion)
- Current: try-catch returns null on error
- Issue: Suggestion to use jsonc-parser's errors array
- Decision: Current implementation is adequate. Consider during refactoring

#### src/server.ts - Redundant notification handler (Minor)
- Current: LogMessageNotification is received and re-sent
- Issue: Potential echo loop
- Decision: No observed issues. Address if problems occur
