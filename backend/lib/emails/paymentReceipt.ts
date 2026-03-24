import { emailShell, badge, statBox, ctaButton, heading, para, divider } from './base';
import { sendEmail } from '../email';

interface PaymentReceiptOptions {
    customerEmail: string;
    merchantName: string;
    amount: string;
    currency: string;
    txHash: string;
    productName?: string;
    productDescription?: string;
    explorerUrl: string;
    redirectUrl?: string;
}

export function paymentReceiptHtml(opts: PaymentReceiptOptions): string {
    const {
        merchantName,
        amount,
        currency,
        txHash,
        productName,
        productDescription,
        explorerUrl,
        redirectUrl,
    } = opts;

    const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

    const body = `
    ${badge('Payment Verified ✓', '#16A34A', '#F0FDF4')}
    <div style="height:20px;"></div>

    ${heading('Your payment was sent!')}
    ${para(`Your payment to <strong>${merchantName}</strong> has been verified on the Base blockchain.`, false)}

    ${statBox([
        { label: 'Paid to', value: merchantName },
        ...(productName ? [{ label: 'Item', value: productName }] : []),
        ...(productDescription ? [{ label: 'Description', value: productDescription }] : []),
        { label: 'Amount', value: `${parseFloat(amount).toFixed(2)} ${currency}` },
        { label: 'Transaction', value: shortHash, mono: true },
        { label: 'Network', value: 'Base · Confirmed' },
    ])}

    ${ctaButton('View transaction on Basescan →', explorerUrl)}

    ${redirectUrl ? `${ctaButton(`Return to ${merchantName} →`, redirectUrl)}` : ''}

    ${divider}
    ${para('Keep this email as your payment receipt. The transaction hash above is your permanent proof of payment on the Base blockchain.', true)}
    `;

    return emailShell({
        preheader: `Your ${parseFloat(amount).toFixed(2)} ${currency} payment to ${merchantName} is confirmed.`,
        body,
    });
}

export async function sendPaymentReceipt(opts: PaymentReceiptOptions) {
    return sendEmail({
        to: opts.customerEmail,
        subject: `Receipt: ${parseFloat(opts.amount).toFixed(2)} ${opts.currency} to ${opts.merchantName}`,
        html: paymentReceiptHtml(opts),
    });
}
