# Quick Start

{% hint style="warning" %}
If you’re not planning to use a Node.js environment, please [use the MNEE API directly](https://docs.mnee.io/api-reference/mnee-api). We’re actively developing SDKs for other popular frameworks.
{% endhint %}

{% hint style="success" %}
Give your AI or LLM of choice [all the context they need](https://docs.mnee.io/dev-tools/llm-context).
{% endhint %}

### 1. Get your API keys

Create your MNEE Developer account and generate your API keys.

<a href="https://developer.mnee.net/" class="button primary" data-icon="code">Developer Portal</a>

### 2. Install the [Typescript SDK](https://github.com/mnee-xyz/mnee)

```bash
npm i @mnee/ts-sdk
```

### 3. Configure the SDK

Configure the SDK with your API settings and call `config()`. This will return the [current configuration](https://docs.mnee.io/mnee-sdk/config) of the MNEE API based on your environment.

```typescript
import Mnee from '@mnee/ts-sdk';

const config = {
  environment: 'sandbox', // or 'production'
  apiKey: 'your-api-key'
};

const mnee = new Mnee(config);

mnee.config().then(mneeConfig => {
  console.log('MNEE Configuration:', mneeConfig);
});

```

{% hint style="success" %}
If you see the configuration log, you've successfully made your first request!
{% endhint %}

### 4. Send MNEE

After ensuring that you've funded your wallet, you can easily [send MNEE](https://docs.mnee.io/mnee-sdk/transfer) using the `transfer()` method.

{% hint style="warning" %}
If you need MNEE for testing, your sandbox keys can request 10 MNEE every 24 hours using the [sandbox faucet found here](https://docs.mnee.io/dev-tools/coin-faucet).

\
Note: If you're using the [MNEE CLI](https://docs.mnee.io/dev-tools/mnee-cli), you can get your WIF by [running mnee export](https://docs.mnee.io/dev-tools/mnee-cli#export-private-key).
{% endhint %}

```typescript
const recipient = 'recipient-mnee-address';
const amount = 0.01; // Amount in MNEE as float (up to 5 decimals)
const wif = 'your-wif-private-key';

// Prepare the transfer request
const request = [
  {
    address: recipient,
    amount,
  },
];

// Send the payment
mnee.transfer(request, wif).then(response => {
  console.log('Transfer result:', response);
});
```

If you'd like to review the MNEE SDK code, it's open-source and available here:\
<https://github.com/mnee-xyz/mnee>
