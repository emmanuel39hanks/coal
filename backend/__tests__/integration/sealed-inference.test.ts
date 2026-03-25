import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  zeroGLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockOpenAICreate = vi.fn();
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockOpenAICreate,
        },
      };
      constructor() {}
    },
  };
});

const mockComputeJobCreate = vi.fn();
const mockComputeJobUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    computeJob: {
      create: mockComputeJobCreate,
      update: mockComputeJobUpdate,
    },
  },
}));

vi.mock('@0glabs/0g-serving-broker', () => ({
  createZGComputeNetworkBroker: vi.fn(),
  createZGComputeNetworkReadOnlyBroker: vi.fn(),
}));

const originalEnv = { ...process.env };

describe('sealed inference', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Clean slate for env vars
    delete process.env.ZERO_G_ENABLED;
    delete process.env.ZERO_G_COMPUTE_ENABLED;
    delete process.env.ZERO_G_COMPUTE_BASE_URL;
    delete process.env.ZERO_G_COMPUTE_API_KEY;
    delete process.env.ZERO_G_COMPUTE_MODEL;
    delete process.env.ZERO_G_COMPUTE_PROVIDER;
    delete process.env.ZERO_G_SEALED_INFERENCE_ENABLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ─── isSealedInferenceEnabled ───────────────────────────────────────────

  describe('isSealedInferenceEnabled', () => {
    it('returns false when neither sealed nor compute is enabled', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: false,
          computeBaseUrl: '',
          computeApiKey: '',
        },
        isZeroGComputeConfigured: () => false,
      }));

      const { isSealedInferenceEnabled } = await import('@/lib/0g/compute');
      expect(isSealedInferenceEnabled()).toBe(false);
    });

    it('returns false when sealed is enabled but compute is not configured', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: true,
          computeEnabled: false,
          computeBaseUrl: '',
          computeApiKey: '',
        },
        isZeroGComputeConfigured: () => false,
      }));

      const { isSealedInferenceEnabled } = await import('@/lib/0g/compute');
      expect(isSealedInferenceEnabled()).toBe(false);
    });

    it('returns false when compute is configured but sealed flag is off', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
        },
        isZeroGComputeConfigured: () => true,
      }));

      const { isSealedInferenceEnabled } = await import('@/lib/0g/compute');
      expect(isSealedInferenceEnabled()).toBe(false);
    });

    it('returns true when both sealed inference and compute are configured', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: true,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
        },
        isZeroGComputeConfigured: () => true,
      }));

      const { isSealedInferenceEnabled } = await import('@/lib/0g/compute');
      expect(isSealedInferenceEnabled()).toBe(true);
    });
  });

  // ─── runStructuredInference sealed flag ─────────────────────────────────

  describe('runStructuredInference sealed flag', () => {
    it('returns direct_secret verification status when sealed is false', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'test-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: '{"result": "ok"}' } }],
      });

      const { runStructuredInference } = await import('@/lib/0g/compute');
      const result = await runStructuredInference({
        messages: [{ role: 'user', content: 'test' }],
        sealed: false,
      });

      expect(result.verificationStatus).toBe('direct_secret');
      expect(result.output).toEqual({ result: 'ok' });
      expect(result.model).toBe('test-model');
      expect(result.provider).toBe('test-provider');
    });

    it('returns sealed_tee verification status when sealed is true and sealed inference is enabled', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: true,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'test-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: '{"result": "sealed"}' } }],
      });

      const { runStructuredInference } = await import('@/lib/0g/compute');
      const result = await runStructuredInference({
        messages: [{ role: 'user', content: 'test' }],
        sealed: true,
      });

      expect(result.verificationStatus).toBe('sealed_tee');
      expect(result.output).toEqual({ result: 'sealed' });
    });

    it('returns direct_secret even when sealed=true but sealed inference is not enabled', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'test-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: '{"result": "not-sealed"}' } }],
      });

      const { runStructuredInference } = await import('@/lib/0g/compute');
      const result = await runStructuredInference({
        messages: [{ role: 'user', content: 'test' }],
        sealed: true,
      });

      expect(result.verificationStatus).toBe('direct_secret');
    });

    it('throws when no model is provided or configured', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: '',
          computeProvider: '',
        },
        isZeroGComputeConfigured: () => true,
      }));

      const { runStructuredInference } = await import('@/lib/0g/compute');

      await expect(
        runStructuredInference({
          messages: [{ role: 'user', content: 'test' }],
        }),
      ).rejects.toThrow('model');
    });

    it('uses explicitly provided model over env default', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'env-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: '{"ok": true}' } }],
      });

      const { runStructuredInference } = await import('@/lib/0g/compute');
      const result = await runStructuredInference({
        messages: [{ role: 'user', content: 'test' }],
        model: 'explicit-model',
      });

      expect(result.model).toBe('explicit-model');
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'explicit-model' }),
      );
    });

    it('parses JSON from markdown-fenced response', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'test-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: '```json\n{"fenced": true}\n```' } }],
      });

      const { runStructuredInference } = await import('@/lib/0g/compute');
      const result = await runStructuredInference({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(result.output).toEqual({ fenced: true });
    });
  });

  // ─── runMerchantStructuredJob sealed passthrough ────────────────────────

  describe('runMerchantStructuredJob sealed passthrough', () => {
    it('passes sealed:true to runStructuredInference when set', async () => {
      let capturedSealedArg: boolean | undefined;

      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: true,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'test-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      vi.doMock('@/lib/0g/compute', () => ({
        runStructuredInference: vi.fn(async (input: { sealed?: boolean }) => {
          capturedSealedArg = input.sealed;
          return {
            output: { recommendation: 'test' },
            provider: 'test-provider',
            model: 'test-model',
            verificationStatus: input.sealed ? 'sealed_tee' : 'direct_secret',
          };
        }),
      }));

      vi.doMock('@/lib/0g/merchant', () => ({
        getMerchantMemorySource: vi.fn(),
      }));

      mockComputeJobCreate.mockResolvedValue({ id: 'job_123' });
      mockComputeJobUpdate.mockResolvedValue({});

      const { runMerchantStructuredJob } = await import('@/lib/0g/ai-commerce');
      const result = await runMerchantStructuredJob({
        merchantId: 'merchant_123',
        kind: 'policy_eval',
        systemPrompt: 'You are a commerce AI.',
        userPayload: { question: 'test' },
        fallback: () => ({ recommendation: 'fallback' }),
        sealed: true,
      });

      expect(capturedSealedArg).toBe(true);
      expect(result.source).toBe('0g_compute');
    });

    it('passes sealed:false to runStructuredInference when not set', async () => {
      let capturedSealedArg: boolean | undefined;

      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'test-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      vi.doMock('@/lib/0g/compute', () => ({
        runStructuredInference: vi.fn(async (input: { sealed?: boolean }) => {
          capturedSealedArg = input.sealed;
          return {
            output: { recommendation: 'test' },
            provider: 'test-provider',
            model: 'test-model',
            verificationStatus: 'direct_secret',
          };
        }),
      }));

      vi.doMock('@/lib/0g/merchant', () => ({
        getMerchantMemorySource: vi.fn(),
      }));

      mockComputeJobCreate.mockResolvedValue({ id: 'job_456' });
      mockComputeJobUpdate.mockResolvedValue({});

      const { runMerchantStructuredJob } = await import('@/lib/0g/ai-commerce');
      const result = await runMerchantStructuredJob({
        merchantId: 'merchant_123',
        kind: 'policy_eval',
        systemPrompt: 'You are a commerce AI.',
        userPayload: { question: 'test' },
        fallback: () => ({ recommendation: 'fallback' }),
      });

      expect(capturedSealedArg).toBeUndefined();
      expect(result.source).toBe('0g_compute');
    });

    it('falls back when compute is not configured', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: false,
          computeBaseUrl: '',
          computeApiKey: '',
          computeModel: '',
          computeProvider: '',
        },
        isZeroGComputeConfigured: () => false,
      }));

      vi.doMock('@/lib/0g/compute', () => ({
        runStructuredInference: vi.fn(),
      }));

      vi.doMock('@/lib/0g/merchant', () => ({
        getMerchantMemorySource: vi.fn(),
      }));

      const { runMerchantStructuredJob } = await import('@/lib/0g/ai-commerce');
      const result = await runMerchantStructuredJob({
        merchantId: 'merchant_123',
        kind: 'policy_eval',
        systemPrompt: 'You are a commerce AI.',
        userPayload: { question: 'test' },
        fallback: () => ({ recommendation: 'fallback-value' }),
      });

      expect(result.source).toBe('fallback');
      expect(result.output).toEqual({ recommendation: 'fallback-value' });
    });

    it('creates a computeJob record and updates it on success', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: true,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'test-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      vi.doMock('@/lib/0g/compute', () => ({
        runStructuredInference: vi.fn(async () => ({
          output: { result: 'ok' },
          provider: 'test-provider',
          model: 'test-model',
          verificationStatus: 'sealed_tee',
        })),
      }));

      vi.doMock('@/lib/0g/merchant', () => ({
        getMerchantMemorySource: vi.fn(),
      }));

      mockComputeJobCreate.mockResolvedValue({ id: 'job_789' });
      mockComputeJobUpdate.mockResolvedValue({});

      const { runMerchantStructuredJob } = await import('@/lib/0g/ai-commerce');
      await runMerchantStructuredJob({
        merchantId: 'merchant_123',
        kind: 'policy_eval',
        systemPrompt: 'Test prompt.',
        userPayload: { question: 'test' },
        fallback: () => ({ result: 'fallback' }),
        sealed: true,
      });

      // Verify computeJob.create was called with correct data
      expect(mockComputeJobCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'merchant_123',
            kind: 'policy_eval',
            status: 'running',
          }),
        }),
      );

      // Verify computeJob.update was called with completed status
      expect(mockComputeJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_789' },
          data: expect.objectContaining({
            status: 'completed',
            verificationStatus: 'sealed_tee',
          }),
        }),
      );
    });

    it('updates computeJob to failed status when inference throws', async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          sealedInferenceEnabled: false,
          computeEnabled: true,
          computeBaseUrl: 'https://compute.0g.ai',
          computeApiKey: 'test-key',
          computeModel: 'test-model',
          computeProvider: 'test-provider',
        },
        isZeroGComputeConfigured: () => true,
      }));

      vi.doMock('@/lib/0g/compute', () => ({
        runStructuredInference: vi.fn(async () => {
          throw new Error('Inference engine unavailable');
        }),
      }));

      vi.doMock('@/lib/0g/merchant', () => ({
        getMerchantMemorySource: vi.fn(),
      }));

      mockComputeJobCreate.mockResolvedValue({ id: 'job_fail' });
      mockComputeJobUpdate.mockResolvedValue({});

      const { runMerchantStructuredJob } = await import('@/lib/0g/ai-commerce');
      const result = await runMerchantStructuredJob({
        merchantId: 'merchant_123',
        kind: 'policy_eval',
        systemPrompt: 'Test prompt.',
        userPayload: { question: 'test' },
        fallback: () => ({ result: 'fallback-after-fail' }),
      });

      // Falls back
      expect(result.source).toBe('fallback');
      expect(result.output).toEqual({ result: 'fallback-after-fail' });

      // Job was marked failed
      expect(mockComputeJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_fail' },
          data: expect.objectContaining({
            status: 'failed',
            errorMessage: 'Inference engine unavailable',
          }),
        }),
      );
    });
  });
});
