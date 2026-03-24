# Coal Checkout — AgentKit Action

Use this action to let AI agents create Coal payment checkout sessions.

## Setup

```bash
npm install zod
```

Set environment variables:
```
COAL_API_KEY=your_coal_api_key
COAL_API_URL=https://api.usecoal.xyz  # optional, defaults to production
```

## Usage with AgentKit

```typescript
import { createCoalCheckoutAction } from './coal-checkout-action';

// Register with your AgentKit agent
agent.addAction(createCoalCheckoutAction);
```

## Example agent prompt

```
Create a payment checkout for $25 USDC for "Premium subscription"
```

The agent will call `coal_create_checkout` and return a payment URL to share with the customer.

## API Key

Get your API key from the [Coal Console](https://usecoal.xyz/console/keys).
