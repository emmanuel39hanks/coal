import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | Coal',
  description: 'Privacy Policy for Coal by Schema Labs.',
};

const sections = [
  {
    title: 'Overview',
    paragraphs: [
      'This Privacy Policy explains how Schema Labs collects, uses, stores, and shares information when you use Coal, including our website, merchant dashboard, APIs, checkout flows, documentation, and related support channels.',
      'Coal is built for programmable commerce, which means some payment activity may involve public blockchains, third-party routing providers, wallets, and infrastructure partners. This policy describes the information we control directly and the information that may be processed by those partners as part of providing the service.',
    ],
  },
  {
    title: 'Information we collect',
    paragraphs: [
      'We collect information you provide directly, information generated through your use of Coal, and limited technical data needed to operate and secure the platform.',
    ],
    bullets: [
      'Account and onboarding details, such as name, email, company name, wallet address, and business profile information',
      'Merchant configuration data, including products, prices, payment links, paywall rules, team settings, and API credentials',
      'Transaction and event metadata, including payment status, timestamps, hashes, chain identifiers, and fulfillment or webhook delivery data',
      'Support and communications data, such as emails, support requests, or product feedback you send us',
      'Device, browser, log, and usage data that helps us secure, maintain, and improve Coal',
    ],
  },
  {
    title: 'How we use information',
    paragraphs: [
      'We use information to operate Coal, authenticate users, process and monitor payment activity, deliver webhooks, provide support, detect abuse, and improve the product experience.',
      'We may also use information to communicate with you about important account or security issues, product updates, billing matters, support requests, documentation changes, and legal notices.',
    ],
    bullets: [
      'Create and manage user accounts and merchant workspaces',
      'Power hosted checkout, payment links, API requests, and payout workflows',
      'Prevent fraud, abuse, unauthorized access, and policy violations',
      'Measure service performance and debug technical issues',
      'Comply with legal obligations and respond to lawful requests',
    ],
  },
  {
    title: 'Blockchain and payment data',
    paragraphs: [
      'Some information processed through Coal may be written to public blockchains or shared with blockchain infrastructure providers as part of transaction execution and verification. Public blockchain data is generally transparent, permanent, and not something we can delete or modify.',
      'If you use third-party payment, routing, wallet, or onramp integrations through Coal, those providers may collect and process information under their own terms and privacy policies. We encourage you to review those policies before relying on those services in production.',
    ],
  },
  {
    title: 'How we share information',
    paragraphs: [
      'We do not sell personal information. We share information only when needed to provide Coal, comply with the law, protect the platform, or complete a transaction or integration you request.',
    ],
    bullets: [
      'Infrastructure and software vendors that help us host, authenticate, monitor, and support Coal',
      'Blockchain, routing, wallet, and payment partners involved in executing or validating transactions',
      'Professional advisers, auditors, insurers, or acquirers in connection with legitimate business needs',
      'Government authorities or other parties where disclosure is required by law or needed to protect rights, safety, or the service',
    ],
  },
  {
    title: 'Data retention',
    paragraphs: [
      'We keep information for as long as reasonably necessary to operate Coal, maintain security, comply with legal obligations, resolve disputes, and enforce our agreements. Retention periods may vary depending on the type of data and how the service is used.',
      'Because blockchain activity can be permanent and externally replicated, some transaction-related data may continue to exist on public networks or third-party systems even after you stop using Coal.',
    ],
  },
  {
    title: 'Security',
    paragraphs: [
      'We use administrative, technical, and organizational safeguards designed to protect information processed through Coal. No system is perfectly secure, however, and we cannot guarantee absolute security.',
      'You are responsible for protecting your account credentials, wallet access, API keys, devices, and internal operational practices. If you suspect unauthorized access, contact us immediately at hello@usecoal.xyz.',
    ],
  },
  {
    title: 'Your choices and rights',
    paragraphs: [
      'Depending on where you live, you may have rights to access, correct, delete, or restrict certain personal information, or to object to certain processing activities. We will review and respond to requests in line with applicable law.',
      'You can also manage some information directly through your Coal account, such as merchant settings, team access, and wallet or webhook configuration. We may need to keep certain records where required for security, compliance, or legitimate business purposes.',
    ],
  },
  {
    title: 'International transfers children and updates',
    paragraphs: [
      'Coal may be operated from multiple jurisdictions and our service providers may process information in countries other than your own. By using Coal, you understand that information may be transferred to and processed in those locations, subject to reasonable safeguards where required.',
      'Coal is intended for businesses, developers, and adults, and is not directed to children. We do not knowingly collect personal information from children.',
      'We may update this Privacy Policy from time to time. When we do, we will post the revised version here and update the last-updated date. If you have questions or requests related to privacy, contact hello@usecoal.xyz.',
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy Policy"
      title="How Coal handles data and payment context."
      description="This policy explains what information Coal by Schema Labs collects, how we use it, when we share it, and what that means for merchants, developers, and customers using the platform."
      lastUpdated="March 22, 2026"
      sections={sections}
    />
  );
}
