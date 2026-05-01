import { generateHeatmap } from './heatmap';

export interface PatchOperation {
  action: 'replace' | 'insert';
  lineStart: number;
  lineEnd: number;
  code: string;
}

export interface PayloadMessage {
  role: 'system' | 'user';
  content: string;
}

export interface Payload {
  messages: PayloadMessage[];
}

const SYSTEM_PROMPT = `You are a surgical patching engine. You will receive a compressed AST heatmap. Output ONLY valid JSON. No markdown, no conversational text.

The output MUST strictly adhere to this JSON schema:
[{ "action": "replace" | "insert", "lineStart": number, "lineEnd": number, "code": "string" }]`;

export function buildPayload(userPrompt: string, code: string, ext: string, cursorLine: number): Payload {
  const heatmap = generateHeatmap(code, ext, cursorLine);

  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `[HEATMAP CONTEXT]\n${heatmap}\n\n[REQUEST]\n${userPrompt}` }
    ]
  };
}

export async function executePrompt(payload: Payload): Promise<PatchOperation[]> {
  return Promise.resolve([{
    action: 'replace',
    lineStart: 0,
    lineEnd: 0,
    code: '// Mocked execution'
  }]);
}
