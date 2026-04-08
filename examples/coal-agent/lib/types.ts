export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolCallId?: string;
  toolResult?: Record<string, unknown>;
}

export interface StreamEvent {
  type: 'text_delta' | 'tool_start' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  error?: string;
}

export const SUGGESTED_PROMPTS = [
  {
    label: 'Discover merchant on 0G',
    prompt: 'Download and show me the merchant profile stored on 0G Storage. I want to see the raw data that an AI agent would discover.',
  },
  {
    label: 'Query merchant memory',
    prompt: 'What products does this merchant sell? Use the 0G-backed memory to answer.',
  },
  {
    label: 'Verify a payment receipt',
    prompt: 'Verify the payment receipt and show me the full 0G proof trail — Base transaction, 0G Storage, and 0G Chain anchor.',
  },
  {
    label: 'Buy me something under $1',
    prompt: 'Find me a product under $1 from this merchant and buy it for me autonomously. Pay with your agent wallet — I want to see real USDC move on-chain.',
  },
  {
    label: 'Evaluate a refund policy',
    prompt: 'Can a customer get a refund after 30 days? Evaluate this using the policy engine with Sealed Inference.',
  },
  {
    label: 'Full autonomous flow',
    prompt: 'Run the full autonomous commerce flow: check your wallet balance, discover the merchant, find a product, buy it with your own wallet, and verify the receipt with the full 0G proof trail.',
  },
];

/** Validate that a URL is a safe HTTPS URL (not javascript:, data:, etc.) */
export function isSafeUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Validate image URL is from allowed hosts */
export function isSafeImageUrl(url: unknown): url is string {
  if (!isSafeUrl(url)) return false;
  try {
    const parsed = new URL(url);
    const allowed = ['utfs.io', 'uploadthing.com', 'lh3.googleusercontent.com'];
    return allowed.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export const DEMO_DATA = {
  merchantId: 'lst00PqEWRwcM4roiOcSpD8WfxlBc2hH',
  profileRootHash: '0xfb508c72dddcfb2a8448affebb37f6c083df1eb8b5b98e200a246f2838d3c1c1',
  receiptRootHash: '0x35828e3970e04d2e5257df86a415e060f75c88050aacb48357cee7b1fb4dbe47',
  memoryRootHash: '0xab6cd288ba6ffd441c520b6ba950ecb3f178ef76729d1cef849dd9486b117017',
};
