# NovAST 🛰️

### Stop sending the file. Send the Heatmap.

NovAST is a high-performance CLI middleware that acts as a surgical **Input Router** for LLMs. It uses a native Rust engine (`novast-core`) and Tree-sitter to strip 90% of the noise from your codebase while retaining 100% of the architectural context.

## The Benchmark

| Method | Token Waste | Architectural Context | Latency | Self-Healing |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Copy-Paste** | 100% (Bloated) | Full (Noise) | Slow | No |
| **Vector RAG** | Variable | Fragmented | Med | No |
| **NovAST Core** | **< 5%** | **Surgical / Deep** | **Sub-50ms** | **Yes** |

## Advanced Features

- **The Knapsack Protocol**: 0-1 Knapsack algorithm implemented in Rust for strict token budgeting. Give NovAST a 4,000 token limit, and it will mathematically guarantee the highest-value architectural context is packed first.
- **Parallel Gravity Indexer**: Powered by `Rayon`. It indexes your entire workspace across all CPU cores, mapping "Gravity" (dependency density) to identify which files are the true architectural epicenters.
- **Universal Polyglot Support**: Native AST parsing for **TS, JS, Python, Java, Dart, C++, Go, Rust, Ruby, and C#**.
- **Autonomous Self-Healing**: Caught a syntax error? NovAST detects it via native parsers and forces the LLM to patch itself before the file even touches the disk.
- **Antigravity Support**: Built-in `--payload` flag for direct integration with agentic AI assistants. It outputs the surgical context directly to stdout for LLM consumption.
- **Web Bridge**: Inject context into **ChatGPT, Gemini, and Claude** via the provided Userscript.
- **VS Code Extension**: Real-time surgical context generation directly from your editor.

## Installation

Install globally directly from the source. No bloated registries, just raw native power.

```bash
npm install -g https://github.com/sharkkyyy10/NovAST/tarball/main
```

## Usage

### For Humans:
Point NovAST at a specific file and line, then tell it what to do. It handles the extraction, workspace resolution, and injection.

```bash
novast src/engine/core.ts:42 "Refactor the parallel loop to use the new Knapsack solver"
```

### For AI Assistants (Antigravity Mode):
Get the raw surgical context to inject into your own prompt.

```bash
novast --payload src/engine/core.ts:42
```

## Why?

Because sending 2,000 lines of code to an LLM is amateur. It dilutes the model's focus and drains your wallet. NovAST treats your codebase like a graph, extracting the **Epicenter** (the code you're changing) and the **Periphery** (the structural skeleton) so the LLM has zero IQ loss and maximum context.

---

Built by a solo dev for the elite. Use it or keep wasting tokens.

