import { extractSkeleton as nativeExtractSkeleton } from '../novast-core';

export function extractSkeleton(code: string, ext: string): string {
  try {
    return nativeExtractSkeleton(code, ext);
  } catch (error: any) {
    throw new Error(`[NovAST Core] ${error.message}`);
  }
}
