import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'discover_merchants',
      description:
        'Browse the Coal marketplace to discover available merchants, their products, and paywalls. Returns all active merchants with their offerings, prices, and 0G publication status. Use this to find what\'s available before buying.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional search term to filter products by name' },
          maxPrice: { type: 'number', description: 'Optional max price in USD to filter products' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discover_merchant_on_0g',
      description:
        'Download data directly from 0G Storage by root hash. Works for public artifacts like merchant profiles (coal.merchant_profile.v1) and receipts (coal.receipt.v1). Shows download performance metrics from decentralized storage nodes. This does NOT use the Coal API — it reads directly from the 0G network.',
      parameters: {
        type: 'object',
        properties: {
          rootHash: {
            type: 'string',
            description: 'The 0G Storage root hash (0x-prefixed hex). Known hashes: merchant profile = 0xfb508c72dddcfb2a8448affebb37f6c083df1eb8b5b98e200a246f2838d3c1c1, receipt = 0x35828e3970e04d2e5257df86a415e060f75c88050aacb48357cee7b1fb4dbe47, encrypted memory = 0xab6cd288ba6ffd441c520b6ba950ecb3f178ef76729d1cef849dd9486b117017',
          },
          label: {
            type: 'string',
            description: 'A human-readable label for this artifact (e.g. "Merchant Profile", "Payment Receipt")',
          },
        },
        required: ['rootHash'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_merchant_profile',
      description:
        "Fetch a merchant's public profile from Coal's API, including 0G Storage publication status, product/paywall counts, supported networks and tokens, and agent-facing API endpoints. This is what an AI agent reads to understand a merchant's capabilities.",
      parameters: {
        type: 'object',
        properties: {
          merchantId: {
            type: 'string',
            description: 'The merchant ID. Known demo merchant: lst00PqEWRwcM4roiOcSpD8WfxlBc2hH',
          },
        },
        required: ['merchantId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_merchant_memory',
      description:
        "Ask a natural language question about the merchant's products, paywalls, settings, and configuration. Uses 0G Compute with Sealed Inference (TEE) for privacy-preserving AI inference. Returns an answer with citations and recommended actions.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language question about the merchant (e.g. "What products do you sell?", "What payment methods are accepted?")',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'route_commerce_request',
      description:
        'Given a commerce goal, use 0G Compute to route to the best Coal surface: product checkout, paywall manifest, or manual review. Analyzes the merchant catalog to find the right match.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The commerce intent (e.g. "I want to buy a chocolate cake", "I need access to premium API content")',
          },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recommendations',
      description:
        'Get AI-powered product and paywall recommendations for a given goal. Returns multiple items with citations from the merchant catalog, powered by 0G Compute.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'What the customer is looking for (e.g. "something sweet to eat", "API access for my app")',
          },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'evaluate_policy',
      description:
        "Evaluate a commerce policy scenario against the merchant's configuration using 0G Sealed Inference (TEE). Returns an allow/deny/review decision with rationale. Great for refund policies, access disputes, and compliance questions.",
      parameters: {
        type: 'object',
        properties: {
          scenario: {
            type: 'string',
            description: 'The policy scenario to evaluate (e.g. "customer wants a refund after 30 days", "agent requests bulk discount")',
          },
        },
        required: ['scenario'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_paywall',
      description:
        "Check whether a wallet address or agent has paid for access to a paywall. Returns payment status and x402 payment requirements if unpaid. This is a public endpoint — no API key needed.",
      parameters: {
        type: 'object',
        properties: {
          paywallId: { type: 'string', description: 'The paywall ID to check' },
          address: { type: 'string', description: 'Wallet address to check (optional)' },
          agentId: { type: 'string', description: 'Agent ID to check (optional)' },
        },
        required: ['paywallId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_checkout',
      description:
        'Create a Coal payment checkout session. Returns a checkout card with a Pay button. The user can click to pay with their connected wallet. After payment, the checkout ID can be used with verify_receipt to show the 0G proof trail.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Payment amount in USD (e.g. 0.05)' },
          currency: { type: 'string', description: 'Token to accept (default: USDC)', enum: ['USDC'] },
          description: { type: 'string', description: 'What this payment is for' },
          productName: { type: 'string', description: 'Name of the product being purchased' },
          productImage: { type: 'string', description: 'URL of the product image (if known from merchant profile or memory query)' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_paywall_pay_intent',
      description:
        'Create a pay intent for a paywall (agent-to-paywall payment). Links a checkout session to a paywall so access is granted after payment. Returns a payment URL.',
      parameters: {
        type: 'object',
        properties: {
          paywallId: { type: 'string', description: 'The paywall ID to pay for' },
          agentId: { type: 'string', description: 'Agent identifier for tracking (optional)' },
        },
        required: ['paywallId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_receipt',
      description:
        'Verify a payment receipt and get the full 0G proof trail. Shows: (1) payment confirmed on Base, (2) receipt published to 0G Storage, (3) receipt hash anchored on 0G Chain. This is the core of Coal\'s verifiable commerce.',
      parameters: {
        type: 'object',
        properties: {
          checkoutId: { type: 'string', description: 'The checkout session ID to verify' },
        },
        required: ['checkoutId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_payment',
      description:
        'Autonomously pay for a checkout session using the agent wallet. Sends real USDC on Base from the agent\'s own wallet — no human interaction needed. Use this after create_checkout or create_paywall_pay_intent to complete payment. Maximum $5.00 per transaction. Returns the on-chain transaction hash.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'The checkout session ID to pay for' },
          amount: { type: 'number', description: 'Payment amount in USD (max $5.00)' },
          recipient: { type: 'string', description: 'Merchant payout wallet address (0x...)' },
          purpose: { type: 'string', description: 'What this payment is for', enum: ['paywall', 'checkout'] },
        },
        required: ['sessionId', 'amount', 'recipient', 'purpose'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_agent_wallet',
      description:
        'Check the agent wallet balance and address. Returns the USDC balance on Base. Use this before making payments to ensure sufficient funds.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_paywall_content',
      description:
        'Fetch content from a paywall-protected URL after payment. Use this after paying a paywall to retrieve the actual data (e.g., price data from the oracle). Pass the content URL and the wallet address that paid.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The content URL to fetch (e.g., https://oracle.usecoal.xyz/api/price/ETH)' },
          address: { type: 'string', description: 'The wallet address that paid for access' },
        },
        required: ['url', 'address'],
      },
    },
  },
];
