# Authentication

### Why Do I Need an API Key?

The API key is required to:

* Securely identify your application or integration.
* Enable access to protected endpoints and features.
* Track usage and ensure fair access for all users.

### How to Get an API Key?

Create a MNEE Developer account and generate your API keys for free.

<a href="https://developer.mnee.net/" class="button primary" data-icon="code">Developer Portal</a>

### Using Your API Key

Once you have your API key, you can use it in your application as follows:

```typescript
import Mnee from '@mnee/ts-sdk';

const mnee = new Mnee({
  environment: 'sandbox', // or 'production'
  apiKey: 'YOUR_API_KEY_HERE',
});
```

{% hint style="danger" %}
Make sure to keep your API key private and never share it publicly.
{% endhint %}

### Troubleshooting

* If you have any questions, please contact **<developer@mnee.io>**

<br>
