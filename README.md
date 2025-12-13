# ALPS Language Server

Language Server Protocol (LSP) implementation for [ALPS](http://alps.io/) (Application-Level Profile Semantics).

## Features

- Code completion for XML and JSON formats
- Descriptor reference completion (`#id`)
- Schema.org vocabulary suggestions (2700+ terms)
- Real-time validation
- Syntax error diagnostics

## Quick Start

```bash
git clone -b initial https://github.com/alps-asd/alps-lsp.git
cd alps-lsp
npm install
npm run build
```

Test the server:

```bash
node dist/cli.js --stdio
# Should output: ALPS Language Server is running
```

## Editor Setup

### VS Code

Use [vscode-asd](https://github.com/alps-asd/vscode-asd) extension (uses this LSP internally).

### Zed

Add to `~/.config/zed/settings.json`:

```json
{
  "lsp": {
    "alps": {
      "binary": {
        "path": "/path/to/alps-lsp/dist/cli.js",
        "arguments": ["--stdio"]
      }
    }
  },
  "languages": {
    "JSON": {
      "language_servers": ["alps"]
    }
  }
}
```

### Neovim (nvim-lspconfig)

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

configs.alps = {
  default_config = {
    cmd = { 'node', '/path/to/alps-lsp/dist/cli.js', '--stdio' },
    filetypes = { 'json', 'xml' },
    root_dir = lspconfig.util.root_pattern('.git', 'alps.json', 'alps.xml'),
  },
}

lspconfig.alps.setup{}
```

### JetBrains (IntelliJ, WebStorm, PhpStorm)

1. Install [LSP4IJ](https://plugins.jetbrains.com/plugin/23257-lsp4ij) plugin
2. Go to Settings → Languages & Frameworks → Language Servers
3. Add new server:
   - Name: `ALPS`
   - Command: `node /path/to/alps-lsp/dist/cli.js --stdio`
   - File patterns: `*.alps.json`, `*.alps.xml`

### Emacs (lsp-mode)

```elisp
(with-eval-after-load 'lsp-mode
  (add-to-list 'lsp-language-id-configuration '("\\.alps\\.json$" . "alps"))
  (lsp-register-client
    (make-lsp-client
      :new-connection (lsp-stdio-connection '("node" "/path/to/alps-lsp/dist/cli.js" "--stdio"))
      :activation-fn (lsp-activate-on "alps")
      :server-id 'alps-lsp)))
```

## Architecture

```
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│  VS Code  │ │ JetBrains │ │    Zed    │ │Vim/Neovim │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │             │
      └─────────────┴──────┬──────┴─────────────┘
                           │ LSP (stdio)
                    ┌──────▼──────┐
                    │  alps-lsp   │
                    └─────────────┘
```

## Development

```bash
npm install    # Install dependencies
npm run build  # Build
npm test       # Test
```

## License

MIT
