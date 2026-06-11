# Repository Guidelines

## Project Structure & Module Organization

This repository contains a TypeScript Language Server Protocol implementation for ALPS profiles. Source code lives in `src/`; `server.ts` registers LSP handlers, `cli.ts` is the command-line entry point, `wsServer.ts` provides WebSocket transport, and parser/validator/completion modules are split by feature. Tests live in `tests/` and mirror source module names with `*.test.ts`. Example ALPS documents are in `examples/`, while design notes and roadmap material are under `docs/adr/`. Build output is generated in `dist/` and should not be edited directly.

## Build, Test, and Development Commands

- `npm install` installs dependencies. Node.js 18 or newer is required.
- `npm run build` compiles TypeScript into `dist/` and emits declarations/source maps.
- `npm run watch` runs the compiler in watch mode during development.
- `npm test` runs the Vitest suite.
- `npm test -- --coverage` runs tests with V8 coverage reporting.
- `npm run lint` runs ESLint against `src/`.
- `node dist/cli.js --stdio` starts the built LSP server over stdio.
- `node dist/cli.js --ws --port 9000` starts WebSocket mode on a custom port.

## Coding Style & Naming Conventions

Use TypeScript with strict checking enabled. Follow the existing style: four-space indentation, semicolons, single quotes, named exports for shared functions, and descriptive camelCase identifiers. Keep feature modules focused, for example `jsonValidator.ts`, `semanticTokens.ts`, or `renameEdits.ts`. ESLint uses `typescript-eslint`; unused variables are warnings, and intentionally unused parameters should start with `_`.

## Testing Guidelines

Tests use Vitest and should be placed in `tests/` with names matching the target module, such as `formatting.test.ts`. Prefer behavior-focused cases for parser output, diagnostics, completions, semantic tokens, and transport handling. Add regression tests for bugs before or alongside fixes. Run `npm test` and, for source changes, `npm run lint` and `npm run build` before opening a pull request.

## Commit & Pull Request Guidelines

Recent history uses concise, imperative commit subjects such as `Add WebSocket transport for browser editors` and `Address CodeRabbit review comments for PR #3`. Keep commits scoped to one logical change. Pull requests should describe the user-visible change, list validation commands run, link related issues, and include screenshots or editor traces only when UI/editor behavior changes. Target feature branches; do not commit directly to `1.x`.

## Agent-Specific Instructions

Automated agents should avoid irreversible or external actions unless explicitly requested, including merges, resets, releases, tag creation, branch deletion, PR ready-state changes, and review replies. When replying through `gh`, always include a mention.
