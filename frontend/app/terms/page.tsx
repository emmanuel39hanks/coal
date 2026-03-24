import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service | Coal',
  description: 'Terms of Service for Coal by Schema Labs.',
};

const sections = [
  {
    title: 'Acceptance of these terms',
    paragraphs: [
      'These Terms of Service govern your access to and use of Coal, including our hosted checkout, merchant dashboard, APIs, paywalls, webhooks, and related developer tools offered by Schema Labs.',
      'By creating an account, connecting a wallet, using our APIs, or accessing any part of the service, you agree to these Terms. If you use Coal on behalf of a company or other organization, you confirm that you have authority to bind that organization to these Terms.',
    ],
  },
  {
    title: 'Coal services',
    paragraphs: [
      'Coal is infrastructure for programmable commerce. We provide software that helps merchants create payment links, accept supported digital assets, automate settlement flows, and manage related transaction activity.',
      'Coal is offered on a non-custodial basis where possible. Funds are intended to settle to the wallet or destination configured by the merchant, and blockchain activity may rely on third-party networks, wallets, bridges, onramps, or routing providers.',
    ],
    bullets: [
      'Hosted checkout and payment-link flows',
      'Merchant dashboard, analytics, and team tools',
      'API access, webhook delivery, and developer documentation',
      'Optional third-party routing, swapping, onramping, and blockchain settlement integrations',
    ],
  },
  {
    title: 'Eligibility and accounts',
    paragraphs: [
      'You may use Coal only if you are legally able to enter into a binding agreement and your use of the service is not prohibited by applicable law or sanctions rules.',
      'You are responsible for maintaining the confidentiality of your account credentials, API keys, signing devices, wallet access, and any other authentication method tied to your use of Coal.',
    ],
    bullets: [
      'Provide accurate and complete registration and onboarding information',
      'Keep business, contact, and settlement-wallet details current',
      'Promptly notify us if you believe your account, wallet, or API keys have been compromised',
    ],
  },
  {
    title: 'Merchant responsibilities',
    paragraphs: [
      'You are responsible for your products, services, customer relationships, marketing claims, pricing, taxes, refunds, fulfillment, and compliance obligations. Coal is not responsible for the underlying goods or services sold through the platform.',
      'You must ensure your use of Coal complies with all laws and regulations that apply to your business, including consumer-protection, export-control, anti-money-laundering, sanctions, tax, and data-protection rules.',
    ],
    bullets: [
      'Use accurate product descriptions and pricing',
      'Honor your published customer policies, including refund or delivery commitments',
      'Maintain control over your settlement destinations and business logic',
      'Use webhook and API data responsibly and securely',
    ],
  },
  {
    title: 'Payments settlement and third parties',
    paragraphs: [
      'Coal may rely on public blockchains and third-party infrastructure providers such as wallet software, node providers, routing partners, onramp providers, and smart contracts. Those services are outside our direct control and may introduce downtime, delays, failed transactions, slippage, or other risks.',
      'Blockchain transactions are generally irreversible once confirmed. You are responsible for reviewing transaction details before initiating any payment or settlement flow, including recipient addresses, supported assets, and network conditions.',
      'Any fees charged by blockchains, routing services, wallet providers, or third parties are separate from Coal pricing unless we expressly state otherwise.',
    ],
  },
  {
    title: 'Prohibited uses',
    paragraphs: [
      'You may not use Coal for unlawful, abusive, or harmful activity, or in a way that interferes with the integrity, availability, or security of the service.',
    ],
    bullets: [
      'Selling or facilitating illegal goods, services, or restricted items',
      'Fraud, money laundering, sanctions evasion, deception, or unauthorized access',
      'Infringing intellectual property or privacy rights',
      'Uploading malware, exploiting the service, or attempting to bypass limits or controls',
      'Reverse engineering or scraping the service in a way that harms users or platform stability',
    ],
  },
  {
    title: 'Fees changes and availability',
    paragraphs: [
      'We may change or introduce pricing, product limits, features, or service tiers from time to time. If we make a material change to paid plans, we will use reasonable efforts to provide notice before the change takes effect.',
      'We may update, suspend, or discontinue any part of Coal at any time, including experimental features, beta programs, integrations, or APIs. We do not guarantee uninterrupted availability or that every feature will remain available in its current form.',
    ],
  },
  {
    title: 'Intellectual property and feedback',
    paragraphs: [
      'Coal, including our software, branding, documentation, visual design, and related materials, is owned by Schema Labs or its licensors and is protected by applicable intellectual-property laws.',
      'You retain ownership of the content and business data you submit to Coal. If you send product feedback, feature requests, or suggestions, you give us permission to use that feedback without restriction or compensation.',
    ],
  },
  {
    title: 'Disclaimers and limitation of liability',
    paragraphs: [
      'Coal is provided on an as-is and as-available basis. To the maximum extent permitted by law, Schema Labs disclaims warranties of merchantability, fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation.',
      'We are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenue, goodwill, business opportunities, data, or digital assets arising from or related to your use of Coal.',
      'To the maximum extent permitted by law, our aggregate liability for claims arising out of or relating to Coal will not exceed the greater of the amount you paid us in the three months before the claim arose or one hundred U.S. dollars.',
    ],
  },
  {
    title: 'Suspension termination and updates',
    paragraphs: [
      'We may suspend or terminate access to Coal if we believe your use violates these Terms, creates risk for the platform or other users, or is required by law, regulation, or a third-party provider. You may stop using Coal at any time.',
      'We may update these Terms from time to time. When we do, we will post the updated version on this page and revise the last-updated date. Your continued use of Coal after an update becomes effective means you accept the revised Terms.',
      'If you have questions about these Terms, contact us at hello@usecoal.xyz.',
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of Service"
      title="Rules for using Coal responsibly."
      description="These terms explain how Coal by Schema Labs may be used, what merchants are responsible for, and the boundaries around payments, settlement, and platform access."
      lastUpdated="March 22, 2026"
      sections={sections}
    />
  );
}
