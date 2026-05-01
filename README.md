# NovAST

**Don't send the file. Send the Heatmap.**

NovAST is an autonomous, local CLI middleware powered by a native Rust engine (NAPI-RS) and Tree-sitter. It parses Abstract Syntax Trees across 5 languages (TS, JS, Python, Java, Dart) to extract ultra-dense context "Heatmaps." 

The result? You drop LLM input tokens by 90% while keeping 100% of the architectural fidelity intact. It features a Cross-File Dependency Resolver for deep context and an Autonomous Self-Healing loop that catches syntax errors and forces the LLM to patch them before writing to disk.

## The Benchmark

| Method | Token Overhead | Architectural Context | Latency | Self-Healing |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Paste** | 100% (Massive) | Full (Bloated) | Slow | No |
| **Caveman / Prompt Hacks**| Variable | Fragmented | Med | No |
| **NovAST Core** | **< 5%** | **Surgical / Complete** | **< 50ms (Native Rust)** | **Yes** |

## Why it Wins

Vector RAG strips the structure. Standard copy-pasting blows up your context window and dilutes the LLM's focus. 

NovAST is a surgical **Input Router**. By leveraging native Rust AST parsing, it strips out irrelevant function bodies and leaves only the structural skeleton (the Periphery) and the specific target code (the Epicenter). This means zero IQ loss for the LLM. It gets exactly what it needs to understand the architecture, and nothing more.

## Installation

Zero friction. Get it globally:

```bash
npm install -g novast
```

## Usage

Point NovAST at your target and give it the directive. It handles the extraction, resolution, LLM routing, and injection.

```bash
novast src/auth.ts:42 "Add rate limiting"
```

## The V2 Roadmap

V1 runs a blistering fast Rust parser inside Node. V2 will be a 100% Rust LSP Daemon. 

We are actively looking for open-source contributors to help oxidize the orchestration layer. If you want to build the future of autonomous agentic tooling, check out the issues and drop a PR.
