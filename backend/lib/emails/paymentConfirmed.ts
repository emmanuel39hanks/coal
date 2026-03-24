import { emailShell, badge, statBox, ctaButton, heading, para, divider } from './base';
import { sendEmail } from '../email';

interface PaymentConfirmedOptions {
    merchantEmail: string;
    merchantName: string;
    amount: string;
    currency: string;
    txHash: string;
    productName?: string;
    explorerUrl: string;
    consoleUrl?: string;
}

export function paymentConfirmedHtml(opts: PaymentConfirmedOptions): string {
    const {
        merchantName,
        amount,
        currency,
        txHash,
        productName,
        explorerUrl,
        consoleUrl = 'https://usecoal.xyz/console',
    } = opts;

    const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

    const body = `
    ${badge('Payment Confirmed', '#16A34A', '#F0FDF4')}
    <div style="height:20px;"></div>

    ${heading(`You received ${parseFloat(amount).toFixed(2)} ${currency}`)}
    ${para(`A payment has just been confirmed on Base${productName ? ` for <strong>${productName}</strong>` : ''}.`, false)}

    ${statBox([
        { label: 'Amount', value: `${parseFloat(amount).toFixed(2)} ${currency}` },
        ...(productName ? [{ label: 'Product', value: productName }] : []),
        { label: 'Network', value: 'Base (EVM)' },
        { label: 'Transaction', value: shortHash, mono: true },
    ])}

    ${ctaButton('View on Basescan →', explorerUrl)}

    ${divider}
    ${para(`Funds have been sent directly to your payout wallet — Coal never holds your money.`, true)}
    ${para(`<a href="${consoleUrl}" style="color:#FF5C16;font-weight:700;text-decoration:none;">View all transactions in Console →</a>`, false)}
    `;

    return emailShell({
        preheader: `You received ${parseFloat(amount).toFixed(2)} ${currency}${productName ? ` for ${productName}` : ''}.`,
        body,
    });
}

export async function sendPaymentConfirmed(opts: PaymentConfirmedOptions) {
    return sendEmail({
        to: opts.merchantEmail,
        subject: `💰 Payment received: ${parseFloat(opts.amount).toFixed(2)} ${opts.currency}`,
        html: paymentConfirmedHtml(opts),
    });
}
