import { NextResponse } from 'next/server';
import { CHAIN_ID, getSettlementToken, IS_TESTNET } from '@/lib/chain';

export async function GET() {
  const settlementToken = getSettlementToken();
  const settlementCurrencyDefault = settlementToken.symbol.toUpperCase();
  const paymentMethodNetwork = IS_TESTNET ? 'base-sepolia' : 'base';
  const supportedCheckoutCurrencies = Array.from(new Set([settlementCurrencyDefault, 'USDC', 'ETH']));
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Coal Payment API',
      version: '1.0.0',
      description:
        'Coal is a crypto-native payment infrastructure for merchants and AI agents. ' +
        'This reference covers all public endpoints, the Merchant API (API key), ' +
        'and the Console API (Bearer token via Privy).',
      contact: {
        name: 'Coal Support',
        url: 'https://usecoal.xyz',
        email: 'support@usecoal.xyz',
      },
    },
    servers: [
      { url: 'https://api.usecoal.xyz', description: 'Production' },
      { url: 'http://localhost:3001', description: 'Local development' },
    ],
    tags: [
      { name: 'Public', description: 'No authentication required' },
      { name: 'Payments', description: 'Payment session flow' },
      { name: 'Paywalls', description: 'x402 / agent-payable content gates' },
      { name: 'Merchant API', description: 'Requires X-API-Key header' },
      { name: 'Console — Products', description: 'Requires Bearer token (Privy)' },
      { name: 'Console — Links', description: 'Requires Bearer token (Privy)' },
      { name: 'Console — Keys', description: 'Requires Bearer token (Privy)' },
      { name: 'Console — Paywalls', description: 'Requires Bearer token (Privy)' },
      { name: 'Console — Splits', description: 'Requires Bearer token (Privy)' },
      { name: 'Discovery', description: 'Public agent discovery — browse merchants, products, paywalls. No auth required.' },
      { name: '0G Events', description: 'DA event stream visibility' },
      { name: 'Console — Analytics', description: 'Requires Bearer token (Privy)' },
      { name: 'Console — Settings', description: 'Requires Bearer token (Privy)' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key obtained from the Coal Console. Format: `coal_live_<hex>`.',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Privy access token returned after social/wallet login.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'requestId'],
              properties: {
                code: {
                  type: 'string',
                  example: 'NOT_FOUND',
                  description: 'Machine-readable error code.',
                },
                message: { type: 'string', example: 'Resource not found' },
                requestId: {
                  type: 'string',
                  example: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                },
                details: {
                  type: 'object',
                  additionalProperties: true,
                  description: 'Optional field-level validation errors.',
                },
              },
            },
          },
        },
        CheckoutStatus: {
          type: 'string',
          enum: ['pending', 'verifying', 'confirmed', 'failed', 'expired'],
        },
        EvmAddress: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        },
        TxHash: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{64}$',
          example: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        },
        PayerInfoConfig: {
          type: 'object',
          properties: {
            required: { type: 'boolean', example: true },
            fields: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['fullName', 'email', 'phone', 'company', 'country'],
              },
              example: ['fullName', 'email'],
            },
          },
        },
        PayerInfoValues: {
          type: 'object',
          properties: {
            fullName: { type: 'string', example: 'Ada Lovelace' },
            email: { type: 'string', format: 'email', example: 'ada@example.com' },
            phone: { type: 'string', example: '+260970000000' },
            company: { type: 'string', example: 'Schema Labs' },
            country: { type: 'string', example: 'Zambia' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'prod_01hw3zk7p3qhxn6fbwvdmjc4r2' },
            name: { type: 'string', example: 'Pro Plan' },
            description: { type: 'string', nullable: true, example: 'Unlimited API calls per month' },
            price: { type: 'string', example: '49.99' },
            image: { type: 'string', nullable: true, format: 'uri', example: 'https://cdn.usecoal.xyz/img/pro-plan.png' },
            sales: { type: 'integer', example: 12 },
          },
        },
        PaymentLink: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'lnk_01hw3zk7p3qhxn6fbwvdmjc4r2' },
            slug: { type: 'string', example: 'pro-monthly' },
            url: { type: 'string', format: 'uri', example: 'https://usecoal.xyz/pay/pro-monthly' },
            productName: { type: 'string', example: 'Pro Plan' },
            productImage: { type: 'string', nullable: true, format: 'uri' },
            price: { type: 'string', example: '49.99' },
            payerInfoConfig: { $ref: '#/components/schemas/PayerInfoConfig' },
            active: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'key_01hw3zk7p3qhxn6fbwvdmjc4r2' },
            name: { type: 'string', example: 'Production Key' },
            prefix: { type: 'string', example: 'coal_live_' },
            lastUsed: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Paywall: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'pw_01hw3zk7p3qhxn6fbwvdmjc4r2' },
            name: { type: 'string', example: 'Premium Article' },
            description: { type: 'string', nullable: true, example: 'Full access to research report' },
            price: { type: 'string', example: '1.50' },
            currency: { type: 'string', example: 'USDC' },
            contentType: { type: 'string', example: 'api' },
            pricingModel: { type: 'string', example: 'one_time' },
            active: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            _count: {
              type: 'object',
              properties: {
                accesses: { type: 'integer', example: 43 },
              },
            },
          },
        },
        SplitRecipient: {
          type: 'object',
          required: ['address', 'percent'],
          properties: {
            address: { $ref: '#/components/schemas/EvmAddress' },
            percent: { type: 'integer', minimum: 1, maximum: 100, example: 70 },
            label: { type: 'string', example: 'Founder' },
          },
        },
        SplitConfig: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'spl_01hw3zk7p3qhxn6fbwvdmjc4r2' },
            name: { type: 'string', example: 'Team Split' },
            recipients: {
              type: 'array',
              items: { $ref: '#/components/schemas/SplitRecipient' },
            },
            active: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid authentication credentials.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Invalid or missing authentication',
                  requestId: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                },
              },
            },
          },
        },
        NotFound: {
          description: 'The requested resource was not found.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  code: 'NOT_FOUND',
                  message: 'Resource not found',
                  requestId: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Request body failed schema validation.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Validation failed',
                  requestId: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                  details: { amount: ['Amount must be positive'] },
                },
              },
            },
          },
        },
        RateLimited: {
          description: 'Too many requests.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  code: 'RATE_LIMITED',
                  message: 'Too many requests. Please try again later.',
                  requestId: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                },
              },
            },
          },
        },
        InternalError: {
          description: 'Unexpected server error.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Internal server error',
                  requestId: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                },
              },
            },
          },
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          tags: ['Public'],
          operationId: 'getHealth',
          summary: 'Health check',
          description:
            'Returns the operational status of the API and its dependencies (database and blockchain RPC). ' +
            'Always returns HTTP 200; check `status` field for degradation.',
          responses: {
            '200': {
              description: 'Service status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time', example: '2024-03-22T12:00:00.000Z' },
                      responseTimeMs: { type: 'integer', example: 42 },
                      checks: {
                        type: 'object',
                        properties: {
                          db: {
                            type: 'object',
                            properties: {
                              ok: { type: 'boolean', example: true },
                              latencyMs: { type: 'integer', example: 8 },
                            },
                          },
                          rpc: {
                            type: 'object',
                            properties: {
                              ok: { type: 'boolean', example: true },
                              latencyMs: { type: 'integer', example: 34 },
                            },
                          },
                        },
                      },
                    },
                  },
                  example: {
                    status: 'ok',
                    timestamp: '2024-03-22T12:00:00.000Z',
                    responseTimeMs: 42,
                    checks: {
                      db: { ok: true, latencyMs: 8 },
                      rpc: { ok: true, latencyMs: 34 },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/0g/health': {
        get: {
          tags: ['Public'],
          operationId: 'getZeroGHealth',
          summary: '0G integration health',
          description:
            'Returns the readiness of Coal x 0G, including storage, chain, and compute configuration details.',
          responses: {
            '200': {
              description: '0G health and configuration status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'disabled' },
                      timestamp: { type: 'string', format: 'date-time' },
                      targetStorageMbps: { type: 'integer', nullable: true, example: 200 },
                      retrievalPlaybook: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      checks: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
                  },
                  example: {
                    status: 'disabled',
                    timestamp: '2026-03-23T01:03:43.221Z',
                    checks: {
                      zeroG: {
                        ok: false,
                        reason: 'ZERO_G_ENABLED=false and ZERO_G_COMPUTE_ENABLED=false',
                      },
                    },
                  },
                },
              },
            },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/pay/nonce': {
        get: {
          tags: ['Payments'],
          operationId: 'getNonce',
          summary: 'Get replay-protection nonce',
          description:
            'Returns the current nonce for a wallet address. Used to construct EIP-712 signatures ' +
            'that prevent replay attacks. Pass the address as a query parameter.',
          parameters: [
            {
              name: 'address',
              in: 'query',
              required: true,
              description: 'EVM wallet address (checksummed or lowercase).',
              schema: { $ref: '#/components/schemas/EvmAddress' },
              example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
            },
          ],
          responses: {
            '200': {
              description: 'Nonce for the address',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      address: { $ref: '#/components/schemas/EvmAddress' },
                      nonce: { type: 'integer', example: 3 },
                    },
                  },
                  example: {
                    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
                    nonce: 3,
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/pay/session': {
        post: {
          tags: ['Payments'],
          operationId: 'createPaySession',
          summary: 'Create a payment session from a link',
          description:
            'Initialises a payment session from a payment link slug or ID. ' +
            'If the link is tied to a fixed-price product the amount is taken from there; ' +
            'otherwise you must supply `amount`.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['linkId'],
                  properties: {
                    linkId: { type: 'string', description: 'Payment link ID.', example: 'lnk_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                    amount: { type: 'number', description: 'Required for flexible (no-product) links.', example: 10.0 },
                  },
                },
                example: { linkId: 'lnk_01hw3zk7p3qhxn6fbwvdmjc4r2' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      sessionId: { type: 'string', example: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                    },
                  },
                  example: { sessionId: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/pay/confirm': {
        post: {
          tags: ['Payments'],
          operationId: 'confirmPayment',
          summary: 'Submit a transaction hash for a session',
          description:
            'After broadcasting a payment on-chain, call this endpoint with the session ID and transaction hash. ' +
            'The session moves to `verifying` and a background job confirms the on-chain transfer. ' +
            'Submitting the same `sessionId` + `txHash` pair is idempotent.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'txHash'],
                  properties: {
                    sessionId: { type: 'string', example: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                    txHash: { $ref: '#/components/schemas/TxHash' },
                    signature: {
                      type: 'string',
                      description: 'Optional EIP-712 signature for added security.',
                      example: '0xdeadbeef...',
                    },
                  },
                },
                example: {
                  sessionId: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2',
                  txHash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Session queued for on-chain verification',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'verifying' },
                      sessionId: { type: 'string', example: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                    },
                  },
                  example: { status: 'verifying', sessionId: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': {
              description: 'Conflict — session already confirmed, expired, or tx hash reused.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: {
                    error: {
                      code: 'TXHASH_ALREADY_USED',
                      message: 'Transaction hash already used',
                      requestId: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                    },
                  },
                },
              },
            },
            '410': {
              description: 'Session has expired.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: {
                    error: {
                      code: 'GONE',
                      message: 'Checkout session has expired',
                      requestId: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                    },
                  },
                },
              },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/pay/status/{sessionId}': {
        get: {
          tags: ['Payments'],
          operationId: 'getPayStatus',
          summary: 'Poll payment session status',
          description:
            'Returns the current status of a payment session. Poll at ~2s intervals after calling `/confirm` ' +
            'until `status` is `confirmed` or `failed`.',
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2',
            },
          ],
          responses: {
            '200': {
              description: 'Session status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { $ref: '#/components/schemas/CheckoutStatus' },
                      txHash: { type: 'string', nullable: true, example: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1' },
                      redirectUrl: { type: 'string', nullable: true, format: 'uri', description: 'Only populated when `status` is `confirmed`.' },
                    },
                  },
                  example: {
                    status: 'confirmed',
                    txHash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
                    redirectUrl: 'https://yoursite.com/thank-you?session=ses_01hw',
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/resolve/link': {
        get: {
          tags: ['Public'],
          operationId: 'resolveLink',
          summary: 'Resolve a payment link by slug',
          description:
            'Returns full payment link details including the linked product and merchant information. ' +
            'Used by the hosted payment page to render the payment UI.',
          parameters: [
            {
              name: 'slug',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              example: 'pro-monthly',
            },
          ],
          responses: {
            '200': {
              description: 'Payment link details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'lnk_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                      slug: { type: 'string', example: 'pro-monthly' },
                      title: { type: 'string', nullable: true },
                      description: { type: 'string', nullable: true },
                      active: { type: 'boolean' },
                      product: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          name: { type: 'string' },
                          price: { type: 'number' },
                          image: { type: 'string', nullable: true },
                        },
                      },
                      merchant: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', example: 'Acme Corp' },
                          image: { type: 'string', nullable: true },
                          payoutAddress: { $ref: '#/components/schemas/EvmAddress' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },

      '/api/paywalls/{id}/verify': {
        get: {
          tags: ['Paywalls'],
          operationId: 'verifyPaywall',
          summary: 'Verify access to a paywall (x402 compatible)',
          description:
            'Check whether a wallet address has paid for access to this paywall. ' +
            'Returns **200** with unlocked content if access exists; ' +
            'returns **402 Payment Required** with payment instructions otherwise. ' +
            'Omitting `address` always returns 402 — useful for discovering payment requirements.',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'pw_01hw3zk7p3qhxn6fbwvdmjc4r2',
            },
            {
              name: 'address',
              in: 'query',
              required: false,
              schema: { $ref: '#/components/schemas/EvmAddress' },
              description: 'Wallet address to check for existing access.',
            },
          ],
          responses: {
            '200': {
              description: 'Access granted — content returned.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      paid: { type: 'boolean', example: true },
                      content: { type: 'object', additionalProperties: true, description: 'Arbitrary JSON content data.' },
                      contentUrl: { type: 'string', nullable: true, format: 'uri' },
                      accessCount: { type: 'integer', example: 2 },
                    },
                  },
                },
              },
            },
            '402': {
              description: 'Payment required. Response body contains payment instructions.',
              headers: {
                'X-Payment-Required': { schema: { type: 'string', example: 'true' } },
                'X-Price': { schema: { type: 'string', example: '1.50 USDC' } },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      paid: { type: 'boolean', example: false },
                      paywallId: { type: 'string' },
                      name: { type: 'string', example: 'Premium Research Report' },
                      price: { type: 'string', example: '1.50' },
                      currency: { type: 'string', example: 'USDC' },
                      paymentMethods: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', example: 'coal-native' },
                            network: { type: 'string', example: paymentMethodNetwork },
                            chainId: { type: 'integer', example: CHAIN_ID },
                            token: { type: 'string', example: settlementToken.address },
                            recipient: { $ref: '#/components/schemas/EvmAddress' },
                            amount: { type: 'string', example: '1.50' },
                          },
                        },
                      },
                    },
                  },
                  example: {
                    paid: false,
                    paywallId: 'pw_01hw3zk7p3qhxn6fbwvdmjc4r2',
                    name: 'Premium Research Report',
                    price: '1.50',
                    currency: 'USDC',
                    paymentMethods: [
                      {
                        type: 'coal-native',
                        network: paymentMethodNetwork,
                        chainId: CHAIN_ID,
                        token: settlementToken.address,
                        recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
                        amount: '1.50',
                      },
                      {
                        type: 'x402',
                        facilitator: 'https://api.usecoal.xyz',
                        paymentUrl: 'https://api.usecoal.xyz/api/paywalls/pw_01hw3zk7p3qhxn6fbwvdmjc4r2/pay',
                      },
                    ],
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/paywalls/{id}/pay': {
        post: {
          tags: ['Paywalls'],
          operationId: 'payPaywall',
          summary: 'Register an on-chain payment for a paywall',
          description:
            'Submit a wallet address and on-chain transaction hash to unlock access. ' +
            'The system records the access grant; subsequent calls to `GET /verify?address=...` will return 200.',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'pw_01hw3zk7p3qhxn6fbwvdmjc4r2',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address', 'txHash'],
                  properties: {
                    address: { $ref: '#/components/schemas/EvmAddress' },
                    txHash: { $ref: '#/components/schemas/TxHash' },
                  },
                },
                example: {
                  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
                  txHash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Access granted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      accessCount: { type: 'integer', example: 1 },
                      paywallId: { type: 'string', example: 'pw_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': {
              description: 'Transaction hash already used.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: {
                    error: {
                      code: 'TXHASH_ALREADY_USED',
                      message: 'Transaction hash already used',
                      requestId: 'req_a1b2c3d4e5f6a7b8c9d0e1f2',
                    },
                  },
                },
              },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/checkouts': {
        post: {
          tags: ['Merchant API'],
          operationId: 'createCheckout',
          summary: 'Create a checkout session',
          description:
            'Creates a hosted checkout session. Redirect your customer to the returned `url` to complete payment. ' +
            'The session expires after 24 hours.',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount'],
                  properties: {
                    amount: { type: 'number', minimum: 0.000001, maximum: 1000000, example: 49.99 },
                    currency: {
                      type: 'string',
                      enum: supportedCheckoutCurrencies,
                      default: settlementCurrencyDefault,
                      example: settlementCurrencyDefault,
                      description: 'Settlement currency. Defaults to the configured settlement token.',
                    },
                    productId: { type: 'string', description: 'Link to an existing product.', example: 'prod_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                    productName: { type: 'string', maxLength: 200, example: 'Pro Plan' },
                    productDescription: { type: 'string', maxLength: 2000, example: 'Unlimited API calls' },
                    productImage: { type: 'string', format: 'uri', example: 'https://cdn.usecoal.xyz/img/pro.png' },
                    description: { type: 'string', maxLength: 500, example: 'Monthly subscription' },
                    redirectUrl: { type: 'string', format: 'uri', description: 'Where to send the customer after payment.', example: 'https://yoursite.com/thank-you' },
                    callbackUrl: { type: 'string', format: 'uri', description: 'Webhook URL for this specific checkout (overrides default).', example: 'https://yoursite.com/webhooks/coal' },
                    metadata: { type: 'object', additionalProperties: true, description: 'Arbitrary key-value pairs attached to the checkout.', example: { orderId: 'ord_999', userId: 'usr_42' } },
                    splitConfigId: { type: 'string', description: 'Apply a revenue split configuration.', example: 'spl_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                    payerInfo: { $ref: '#/components/schemas/PayerInfoConfig' },
                  },
                },
                example: {
                  amount: 49.99,
                  currency: 'USDC',
                  productName: 'Pro Plan',
                  redirectUrl: 'https://yoursite.com/thank-you',
                  payerInfo: { required: true, fields: ['fullName', 'email'] },
                  metadata: { orderId: 'ord_999', userId: 'usr_42' },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Checkout session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                      url: { type: 'string', format: 'uri', example: 'https://usecoal.xyz/pay/checkout/ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                      status: { $ref: '#/components/schemas/CheckoutStatus' },
                      amount: { type: 'number', example: 49.99 },
                      currency: { type: 'string', example: 'USDC' },
                      productName: { type: 'string', nullable: true, example: 'Pro Plan' },
                      expiresAt: { type: 'string', format: 'date-time' },
                      splitConfigId: { type: 'string', nullable: true },
                    },
                  },
                  example: {
                    id: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2',
                    url: 'https://usecoal.xyz/pay/checkout/ses_01hw3zk7p3qhxn6fbwvdmjc4r2',
                    status: 'pending',
                    amount: 49.99,
                    currency: 'USDC',
                    productName: 'Pro Plan',
                    expiresAt: '2024-03-23T12:00:00.000Z',
                    splitConfigId: null,
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/checkouts/{id}': {
        get: {
          tags: ['Merchant API'],
          operationId: 'getCheckout',
          summary: 'Get a checkout session',
          description: 'Retrieve the details of a checkout session, including merchant and product info.',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2',
            },
          ],
          responses: {
            '200': {
              description: 'Checkout session details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      amount: { type: 'string', example: '49.99' },
                      currency: { type: 'string', example: 'USDC' },
                      description: { type: 'string' },
                      status: { $ref: '#/components/schemas/CheckoutStatus' },
                      payerInfoConfig: { $ref: '#/components/schemas/PayerInfoConfig' },
                      payerInfo: { $ref: '#/components/schemas/PayerInfoValues' },
                      expiresAt: { type: 'string', format: 'date-time' },
                      merchant: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          image: { type: 'string', nullable: true },
                        },
                      },
                      product: { type: 'object', nullable: true },
                      splits: { type: 'object', nullable: true },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/checkout': {
        post: {
          tags: ['Merchant API'],
          operationId: 'createAgentCheckout',
          summary: 'Create a checkout session (agent-optimised)',
          description:
            'Identical to `POST /api/checkouts` but designed for autonomous agents. ' +
            'Session expires in 30 minutes (shorter window suitable for agent workflows). ' +
            'Returns a `paymentUrl` the agent can present to a user or process autonomously.',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount'],
                  properties: {
                    amount: { type: 'number', minimum: 0.000001, example: 5.00 },
                    currency: {
                      type: 'string',
                      enum: supportedCheckoutCurrencies,
                      default: settlementCurrencyDefault,
                      example: settlementCurrencyDefault,
                      description: 'Settlement currency. Defaults to the configured settlement token.',
                    },
                    description: { type: 'string', example: 'GPT-4o API call batch' },
                    redirectUrl: { type: 'string', format: 'uri' },
                    callbackUrl: { type: 'string', format: 'uri' },
                    metadata: { type: 'object', additionalProperties: true, example: { agentId: 'agent_xyz', task: 'summarise' } },
                  },
                },
                example: {
                  amount: 5.00,
                  currency: 'USDC',
                  description: 'GPT-4o API call batch',
                  metadata: { agentId: 'agent_xyz', task: 'summarise' },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Agent checkout created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      checkoutId: { type: 'string', example: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                      paymentUrl: { type: 'string', format: 'uri', example: 'https://usecoal.xyz/pay/checkout/ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                      status: { $ref: '#/components/schemas/CheckoutStatus' },
                      amount: { type: 'number', example: 5.00 },
                      currency: { type: 'string', example: 'USDC' },
                      expiresAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/merchant-profiles/{merchantId}': {
        get: {
          tags: ['Public'],
          operationId: 'getAgentMerchantProfile',
          summary: 'Get a merchant profile for agent discovery',
          parameters: [
            {
              name: 'merchantId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Merchant profile bundle',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      merchantId: { type: 'string' },
                      profile: { type: 'object', additionalProperties: true },
                      zeroG: {
                        type: 'object',
                        properties: {
                          published: { type: 'boolean' },
                          created: { type: 'boolean' },
                          storageUri: { type: 'string', nullable: true },
                          storageRoot: { type: 'string', nullable: true },
                          payloadHash: { type: 'string', nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/paywalls/{id}/manifest': {
        get: {
          tags: ['Paywalls'],
          operationId: 'getAgentPaywallManifest',
          summary: 'Get the latest agent-readable paywall manifest',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Paywall manifest',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      paywallId: { type: 'string' },
                      manifest: { type: 'object', additionalProperties: true },
                      zeroG: {
                        type: 'object',
                        properties: {
                          published: { type: 'boolean' },
                          created: { type: 'boolean' },
                          storageUri: { type: 'string', nullable: true },
                          storageRoot: { type: 'string', nullable: true },
                          payloadHash: { type: 'string', nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/paywalls/{id}/verify': {
        get: {
          tags: ['Paywalls'],
          operationId: 'verifyAgentPaywallAccess',
          summary: 'Check paywall access state without 402 semantics',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'address',
              in: 'query',
              required: false,
              schema: { $ref: '#/components/schemas/EvmAddress' },
            },
            {
              name: 'did',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'agentId',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Structured paywall access state',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      paymentRequired: { type: 'boolean' },
                      paid: { type: 'boolean' },
                      paywallId: { type: 'string' },
                      entitlement: { type: 'object', additionalProperties: true },
                      zeroG: { type: 'object', additionalProperties: true },
                      paymentMethods: {
                        type: 'array',
                        items: { type: 'object', additionalProperties: true },
                      },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/paywalls/{id}/pay-intent': {
        post: {
          tags: ['Merchant API'],
          operationId: 'createAgentPaywallIntent',
          summary: 'Create a paywall-specific checkout intent',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    redirectUrl: { type: 'string', format: 'uri' },
                    callbackUrl: { type: 'string', format: 'uri' },
                    metadata: { type: 'object', additionalProperties: true },
                    subject: {
                      type: 'object',
                      properties: {
                        walletAddress: { $ref: '#/components/schemas/EvmAddress' },
                        did: { type: 'string' },
                        agentId: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Paywall payment intent created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      checkoutId: { type: 'string' },
                      paywallId: { type: 'string' },
                      paymentUrl: { type: 'string', format: 'uri' },
                      verifyUrl: { type: 'string', format: 'uri' },
                      receiptVerifyUrlTemplate: { type: 'string' },
                      zeroG: { type: 'object', additionalProperties: true },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/memory/query': {
        post: {
          tags: ['Merchant API'],
          operationId: 'queryMerchantMemory',
          summary: 'Query merchant memory for cited answers',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['query'],
                  properties: {
                    query: { type: 'string', example: 'Which paywalls are currently active?' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Memory-backed answer',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      merchantId: { type: 'string' },
                      response: { type: 'object', additionalProperties: true },
                      source: { type: 'string' },
                      computeJobId: { type: 'string', nullable: true },
                      zeroG: { type: 'object', additionalProperties: true },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/memory/ingest': {
        post: {
          tags: ['Merchant API'],
          operationId: 'ingestMerchantMemory',
          summary: 'Backfill or refresh merchant 0G artifacts',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            '200': {
              description: 'Latest profile and memory publication state',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      merchantId: { type: 'string' },
                      ingestedAt: { type: 'string', format: 'date-time' },
                      zeroG: { type: 'object', additionalProperties: true },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/receipts/{checkoutId}/verify': {
        get: {
          tags: ['Merchant API'],
          operationId: 'verifyAgentReceipt',
          summary: 'Verify a checkout receipt and expose 0G proof metadata',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: 'checkoutId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Receipt verification result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      checkoutId: { type: 'string' },
                      status: { $ref: '#/components/schemas/CheckoutStatus' },
                      verified: { type: 'boolean' },
                      receipt: { type: 'object', nullable: true, additionalProperties: true },
                      zeroG: { type: 'object', nullable: true, additionalProperties: true },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/commerce/route': {
        post: {
          tags: ['Merchant API'],
          operationId: 'routeCommerceIntent',
          summary: 'Choose the best commerce surface for a goal',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['goal'],
                  properties: {
                    goal: { type: 'string', example: 'Unlock premium API access for a user' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Commerce route decision',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      merchantId: { type: 'string' },
                      route: { type: 'object', additionalProperties: true },
                      computeConfigured: { type: 'boolean' },
                      zeroG: { type: 'object', additionalProperties: true },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/commerce/support-answer': {
        post: {
          tags: ['Merchant API'],
          operationId: 'generateSupportAnswer',
          summary: 'Generate a cited support answer from merchant memory',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['question'],
                  properties: {
                    question: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Support answer',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      merchantId: { type: 'string' },
                      response: { type: 'object', additionalProperties: true },
                      source: { type: 'string' },
                      computeJobId: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/commerce/policy-eval': {
        post: {
          tags: ['Merchant API'],
          operationId: 'evaluateCommercePolicy',
          summary: 'Evaluate a commerce policy scenario',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['scenario'],
                  properties: {
                    scenario: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Policy evaluation',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      merchantId: { type: 'string' },
                      evaluation: { type: 'object', additionalProperties: true },
                      source: { type: 'string' },
                      computeJobId: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/commerce/recommend': {
        post: {
          tags: ['Merchant API'],
          operationId: 'recommendCommerceSurface',
          summary: 'Recommend a product or paywall for a goal',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['goal'],
                  properties: {
                    goal: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Recommendation result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      merchantId: { type: 'string' },
                      recommendation: { type: 'object', additionalProperties: true },
                      source: { type: 'string' },
                      computeJobId: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/widget/session': {
        post: {
          tags: ['Merchant API'],
          operationId: 'createWidgetSession',
          summary: 'Create a widget checkout session',
          description:
            'Creates a session for embedding the Coal payment widget in your site. ' +
            'Returns a `checkoutUrl` you pass to the widget iframe or coal.js library.',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount'],
                  properties: {
                    amount: { type: 'number', minimum: 0, example: 19.99 },
                    currency: { type: 'string', default: 'USDC', example: 'USDC' },
                    description: { type: 'string', example: 'Starter Plan checkout' },
                    redirectUrl: { type: 'string', format: 'uri', example: 'https://yoursite.com/success' },
                    payerInfo: { $ref: '#/components/schemas/PayerInfoConfig' },
                  },
                },
                example: {
                  amount: 19.99,
                  currency: 'USDC',
                  description: 'Starter Plan checkout',
                  redirectUrl: 'https://yoursite.com/success',
                  payerInfo: { required: true, fields: ['fullName', 'email'] },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Widget session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      sessionId: { type: 'string', example: 'ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                      checkoutUrl: { type: 'string', format: 'uri', example: 'https://usecoal.xyz/embed/ses_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                      expiresAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/products': {
        get: {
          tags: ['Console — Products'],
          operationId: 'listProducts',
          summary: 'List all active products',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Product list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    },
                  },
                  example: {
                    products: [
                      { id: 'prod_01hw', name: 'Pro Plan', description: 'Unlimited access', price: '49.99', image: null, sales: 12 },
                    ],
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Console — Products'],
          operationId: 'createProduct',
          summary: 'Create a product',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'price'],
                  properties: {
                    name: { type: 'string', maxLength: 200, example: 'Pro Plan' },
                    description: { type: 'string', maxLength: 2000, example: 'Unlimited API calls per month' },
                    price: { type: 'number', example: 49.99 },
                    image: { type: 'string', format: 'uri', example: 'https://cdn.usecoal.xyz/img/pro.png' },
                  },
                },
                example: { name: 'Pro Plan', description: 'Unlimited API calls per month', price: 49.99 },
              },
            },
          },
          responses: {
            '201': {
              description: 'Product created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Product' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/products/{id}': {
        put: {
          tags: ['Console — Products'],
          operationId: 'updateProduct',
          summary: 'Update a product',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', maxLength: 200 },
                    description: { type: 'string', maxLength: 2000 },
                    price: { type: 'number' },
                    image: { type: 'string', format: 'uri' },
                  },
                },
                example: { price: 59.99 },
              },
            },
          },
          responses: {
            '200': { description: 'Updated product', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Console — Products'],
          operationId: 'deleteProduct',
          summary: 'Soft-delete a product',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Product deactivated' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/links': {
        get: {
          tags: ['Console — Links'],
          operationId: 'listLinks',
          summary: 'List all active payment links',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Payment link list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      links: { type: 'array', items: { $ref: '#/components/schemas/PaymentLink' } },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Console — Links'],
          operationId: 'createLink',
          summary: 'Create a payment link',
          description: 'Generates a shareable payment link. If `slug` is omitted a random 8-char slug is generated.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string', example: 'prod_01hw3zk7p3qhxn6fbwvdmjc4r2' },
                    slug: { type: 'string', maxLength: 64, pattern: '^[a-zA-Z0-9_-]+$', example: 'pro-monthly' },
                    title: { type: 'string', maxLength: 200, example: 'Monthly Pro subscription' },
                    description: { type: 'string', maxLength: 500 },
                    payerInfo: { $ref: '#/components/schemas/PayerInfoConfig' },
                  },
                },
                example: {
                  productId: 'prod_01hw3zk7p3qhxn6fbwvdmjc4r2',
                  slug: 'pro-monthly',
                  payerInfo: { required: true, fields: ['fullName', 'email'] },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Payment link created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentLink' } } } },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '409': {
              description: 'Slug already taken.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: { error: { code: 'SLUG_TAKEN', message: 'Slug already taken', requestId: 'req_abc' } },
                },
              },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/links/{id}': {
        delete: {
          tags: ['Console — Links'],
          operationId: 'deleteLink',
          summary: 'Deactivate a payment link',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Link deactivated' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/keys': {
        get: {
          tags: ['Console — Keys'],
          operationId: 'listApiKeys',
          summary: 'List API keys',
          description: 'Returns all non-revoked API keys. The secret is never returned after creation.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'API key list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      keys: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } },
                    },
                  },
                  example: {
                    keys: [
                      { id: 'key_01hw', name: 'Production Key', prefix: 'coal_live_', lastUsed: '2024-03-20T08:00:00.000Z', createdAt: '2024-01-01T00:00:00.000Z' },
                    ],
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Console — Keys'],
          operationId: 'createApiKey',
          summary: 'Create an API key',
          description: 'Generates a new API key. **The secret is only returned once — store it immediately.**',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', maxLength: 100, example: 'Production Key' },
                  },
                },
                example: { name: 'Production Key' },
              },
            },
          },
          responses: {
            '201': {
              description: 'API key created — secret shown once',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      key: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          secret: { type: 'string', description: 'Full API key — only shown at creation time.', example: 'coal_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4' },
                          createdAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },

      '/api/console/keys/{id}': {
        delete: {
          tags: ['Console — Keys'],
          operationId: 'revokeApiKey',
          summary: 'Revoke an API key',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Key revoked' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },

      '/api/console/stats': {
        get: {
          tags: ['Console — Analytics'],
          operationId: 'getStats',
          summary: 'Dashboard overview stats',
          description: 'Returns total revenue, transaction count, active product count, and the 5 most recent transactions.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Dashboard stats',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      revenue: { type: 'string', example: '1234.56' },
                      totalTransactions: { type: 'integer', example: 42 },
                      activeItems: { type: 'integer', example: 5 },
                      recentActivity: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            amount: { type: 'string', example: '49.99' },
                            status: { type: 'string' },
                            date: { type: 'string', format: 'date-time' },
                            product: { type: 'string', example: 'Pro Plan' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/analytics': {
        get: {
          tags: ['Console — Analytics'],
          operationId: 'getAnalytics',
          summary: 'Time-series analytics with period comparison',
          description: 'Returns revenue and transaction metrics grouped over a selected period, plus top products by revenue.',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'period',
              in: 'query',
              schema: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' },
              description: 'Time window for the current period.',
            },
            {
              name: 'groupBy',
              in: 'query',
              schema: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' },
              description: 'Granularity of chart data.',
            },
          ],
          responses: {
            '200': {
              description: 'Analytics data',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      revenue: {
                        type: 'object',
                        properties: {
                          total: { type: 'string', example: '1234.56' },
                          change: { type: 'number', description: 'Percent change vs previous period.', example: 12.5 },
                        },
                      },
                      transactions: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer', example: 42 },
                          change: { type: 'number', example: -3.7 },
                        },
                      },
                      avgOrderValue: {
                        type: 'object',
                        properties: {
                          total: { type: 'string', example: '29.39' },
                          change: { type: 'number', example: 5.1 },
                        },
                      },
                      chart: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            date: { type: 'string', example: '2024-03-01' },
                            revenue: { type: 'string', example: '199.97' },
                            count: { type: 'integer', example: 4 },
                          },
                        },
                      },
                      topProducts: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string', example: 'Pro Plan' },
                            revenue: { type: 'string', example: '749.85' },
                            count: { type: 'integer', example: 15 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },

      '/api/console/export': {
        get: {
          tags: ['Console — Analytics'],
          operationId: 'exportTransactions',
          summary: 'Export transactions as CSV',
          description: 'Download all transactions (optionally filtered by date range) as a CSV file.',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'from',
              in: 'query',
              schema: { type: 'string', format: 'date' },
              description: 'Start date (ISO 8601). Example: `2024-01-01`.',
              example: '2024-01-01',
            },
            {
              name: 'to',
              in: 'query',
              schema: { type: 'string', format: 'date' },
              description: 'End date (ISO 8601). Example: `2024-03-31`.',
              example: '2024-03-31',
            },
          ],
          responses: {
            '200': {
              description: 'CSV file download',
              headers: {
                'Content-Disposition': { schema: { type: 'string', example: 'attachment; filename="coal-transactions-2024-03-22.csv"' } },
              },
              content: {
                'text/csv': {
                  schema: { type: 'string' },
                  example: 'Date,TxHash,Amount,Currency,Status,Product,From\n2024-03-22T12:00:00.000Z,0xabc1...,49.99,USDC,confirmed,Pro Plan,0xd8dA...',
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },

      '/api/console/paywalls': {
        get: {
          tags: ['Console — Paywalls'],
          operationId: 'listPaywalls',
          summary: 'List all paywalls',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Paywall list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      paywalls: { type: 'array', items: { $ref: '#/components/schemas/Paywall' } },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Console — Paywalls'],
          operationId: 'createPaywall',
          summary: 'Create a paywall',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'price'],
                  properties: {
                    name: { type: 'string', maxLength: 200, example: 'Premium Research Report' },
                    price: { type: 'number', example: 1.50 },
                    currency: { type: 'string', default: 'USDC', example: 'USDC' },
                    description: { type: 'string', maxLength: 2000 },
                    contentType: { type: 'string', default: 'api', example: 'api', description: 'Type of gated content: `api`, `url`, `text`, etc.' },
                    contentData: { type: 'object', additionalProperties: true, description: 'Arbitrary JSON payload returned to paying users.' },
                    contentUrl: { type: 'string', format: 'uri', description: 'URL returned to paying users.' },
                    pricingModel: { type: 'string', default: 'one_time', example: 'one_time' },
                  },
                },
                example: {
                  name: 'Premium Research Report',
                  price: 1.50,
                  currency: 'USDC',
                  contentType: 'url',
                  contentUrl: 'https://cdn.usecoal.xyz/reports/q1-2024.pdf',
                },
              },
            },
          },
          responses: {
            '201': { description: 'Paywall created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Paywall' } } } },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/paywalls/{id}': {
        put: {
          tags: ['Console — Paywalls'],
          operationId: 'updatePaywall',
          summary: 'Update a paywall',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', maxLength: 200 },
                    description: { type: 'string', maxLength: 2000 },
                    price: { type: 'number' },
                    contentData: { type: 'object', additionalProperties: true },
                    contentUrl: { type: 'string', format: 'uri' },
                    active: { type: 'boolean' },
                    pricingModel: { type: 'string' },
                  },
                },
                example: { price: 2.00, active: true },
              },
            },
          },
          responses: {
            '200': { description: 'Updated paywall', content: { 'application/json': { schema: { $ref: '#/components/schemas/Paywall' } } } },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Console — Paywalls'],
          operationId: 'deletePaywall',
          summary: 'Deactivate a paywall',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Paywall deactivated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } } } },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/splits': {
        get: {
          tags: ['Console — Splits'],
          operationId: 'listSplits',
          summary: 'List all split configurations',
          description: 'Revenue split configs define how payment proceeds are distributed among multiple addresses.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Split config list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      splits: { type: 'array', items: { $ref: '#/components/schemas/SplitConfig' } },
                    },
                  },
                  example: {
                    splits: [
                      {
                        id: 'spl_01hw',
                        name: 'Team Split',
                        recipients: [
                          { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', percent: 70, label: 'Founder' },
                          { address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', percent: 30, label: 'Co-founder' },
                        ],
                        active: true,
                        createdAt: '2024-01-01T00:00:00.000Z',
                      },
                    ],
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Console — Splits'],
          operationId: 'createSplit',
          summary: 'Create a split configuration',
          description: 'Recipients\' `percent` values must sum to 100.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'recipients'],
                  properties: {
                    name: { type: 'string', maxLength: 200, example: 'Team Split' },
                    recipients: {
                      type: 'array',
                      minItems: 1,
                      items: { $ref: '#/components/schemas/SplitRecipient' },
                    },
                  },
                },
                example: {
                  name: 'Team Split',
                  recipients: [
                    { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', percent: 70, label: 'Founder' },
                    { address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', percent: 30, label: 'Co-founder' },
                  ],
                },
              },
            },
          },
          responses: {
            '201': { description: 'Split config created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SplitConfig' } } } },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/splits/{id}': {
        put: {
          tags: ['Console — Splits'],
          operationId: 'updateSplit',
          summary: 'Update a split configuration',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', maxLength: 200 },
                    recipients: { type: 'array', items: { $ref: '#/components/schemas/SplitRecipient' } },
                  },
                },
                example: { recipients: [{ address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', percent: 100 }] },
              },
            },
          },
          responses: {
            '200': { description: 'Updated split config', content: { 'application/json': { schema: { $ref: '#/components/schemas/SplitConfig' } } } },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { description: 'Forbidden — you do not own this split config.' },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Console — Splits'],
          operationId: 'deleteSplit',
          summary: 'Deactivate a split configuration',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Split config deactivated' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { description: 'Forbidden.' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/console/settings': {
        get: {
          tags: ['Console — Settings'],
          operationId: 'getSettings',
          summary: 'Get merchant settings',
          description: 'Returns the merchant profile including a masked webhook secret.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Merchant settings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'Acme Corp' },
                      email: { type: 'string', format: 'email', example: 'acme@example.com' },
                      payoutAddress: { type: 'string', nullable: true, example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
                      webhookSecretMasked: { type: 'string', example: 'whsec_a1b2...f3g4' },
                      webhookUrl: { type: 'string', nullable: true, format: 'uri', example: 'https://yoursite.com/webhooks/coal' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        put: {
          tags: ['Console — Settings'],
          operationId: 'updateSettings',
          summary: 'Update merchant settings',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', minLength: 1, maxLength: 200, example: 'Acme Corp' },
                    payoutAddress: { $ref: '#/components/schemas/EvmAddress' },
                    webhookUrl: { type: 'string', format: 'uri', example: 'https://yoursite.com/webhooks/coal' },
                  },
                },
                example: { webhookUrl: 'https://yoursite.com/webhooks/coal', payoutAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated settings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      email: { type: 'string' },
                      payoutAddress: { type: 'string', nullable: true },
                      webhookUrl: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/agent/discover': {
        get: {
          tags: ['Discovery'],
          operationId: 'discoverMerchants',
          summary: 'Browse all merchants with products and paywalls',
          description:
            'Public discovery endpoint for AI agents. Returns all active merchants with their top products, ' +
            'paywalls, 0G publication status, and API endpoints. No authentication required.',
          responses: {
            '200': {
              description: 'Marketplace overview',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      merchants: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            productCount: { type: 'integer' },
                            paywallCount: { type: 'integer' },
                            topProducts: { type: 'array', items: { type: 'object' } },
                            topPaywalls: { type: 'array', items: { type: 'object' } },
                            zeroG: { type: 'object', properties: { published: { type: 'boolean' }, storageRoot: { type: 'string' } } },
                            endpoints: { type: 'object' },
                          },
                        },
                      },
                      stats: {
                        type: 'object',
                        properties: {
                          totalMerchants: { type: 'integer' },
                          totalProducts: { type: 'integer' },
                          totalPaywalls: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },

      '/api/agent/discover/products': {
        get: {
          tags: ['Discovery'],
          operationId: 'discoverProducts',
          summary: 'Search products across all merchants',
          description: 'Browse and search active products. Filter by name, max price, or tag.',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filter by product name (case-insensitive)' },
            { name: 'maxPrice', in: 'query', schema: { type: 'number' }, description: 'Maximum price in USD' },
            { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Filter by product tag' },
          ],
          responses: {
            '200': {
              description: 'Product listing',
              content: { 'application/json': { schema: { type: 'object', properties: { products: { type: 'array' }, total: { type: 'integer' } } } } },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },

      '/api/agent/discover/paywalls': {
        get: {
          tags: ['Discovery'],
          operationId: 'discoverPaywalls',
          summary: 'List all active paywalls with verify URLs',
          description: 'Browse active agent-payable gates. Each paywall includes its x402 verify URL for immediate agent use.',
          responses: {
            '200': {
              description: 'Paywall listing',
              content: { 'application/json': { schema: { type: 'object', properties: { paywalls: { type: 'array' }, total: { type: 'integer' } } } } },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },

      '/api/0g/da-events': {
        get: {
          tags: ['0G Events'],
          operationId: 'getDAEvents',
          summary: 'Recent DA event stream',
          description:
            'Returns recent payment events posted to 0G Data Availability layer. ' +
            'Events include payment confirmations, subscription lifecycle, and paywall access grants.',
          responses: {
            '200': {
              description: 'DA event log',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      events: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            kind: { type: 'string', enum: ['payment_confirmed', 'subscription_renewed', 'subscription_created', 'webhook_delivered', 'paywall_access_granted', 'receipt_anchored'] },
                            merchantId: { type: 'string' },
                            requestId: { type: 'string', nullable: true },
                            status: { type: 'string' },
                            byteSize: { type: 'integer' },
                            timestamp: { type: 'string', format: 'date-time' },
                            payloadHash: { type: 'string' },
                          },
                        },
                      },
                      total: { type: 'integer' },
                      daEnabled: { type: 'boolean' },
                      daEndpoint: { type: 'string' },
                    },
                  },
                },
              },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}
