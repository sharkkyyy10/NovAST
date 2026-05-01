// heatmap.ts - Rewritten to bridge natively to the Rust engine
import { generateHeatmap as generateHeatmapNative } from '../novast-core';

export function generateHeatmap(code: string, ext: string, cursorLine: number): string {
  try {
    return generateHeatmapNative(code, ext, cursorLine);
  } catch (error: any) {
    throw new Error(`[NovAST Core] Failed to generate heatmap: ${error.message}`);
  }
}
