import type { ReactNode } from "react";
import { Link } from "wouter";
import { CURRENT_PRIVACY_VERSION } from "@workspace/api-zod";
import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      version={CURRENT_PRIVACY_VERSION}
    >
      <p>
        This Privacy Policy explains how MB Corporation, trading as AfriLance
        (“AfriLance”, “we”, “us” or “our”), collects, uses, stores, and shares
        personal data when you use our website, applications, and marketplace.
        It applies to people in Ghana and other users of the Platform. Read it
        together with our Terms of Service.
      </p>

      <Section title="1. Our responsibilities and Ghanaian data protection">
        <p>
          MB Corporation is the data controller for personal data it determines
          how and why to process. We handle personal data in accordance with the
          Data Protection Act, 2012 (Act 843), including its data protection
          principles and applicable requirements for data controllers and
          processors. We are committed to registering with the Data Protection
          Commission (DPC) where required by Act 843 and to maintaining any
          required registration. We do not claim a DPC registration number in
          this policy; applicable registration details will be published here
          when confirmed.
        </p>
        <p>
          We aim to process personal data lawfully and reasonably, for specified
          purposes, using data that is relevant and not excessive, keeping it
          accurate and secure, and retaining it only as long as reasonably
          necessary or legally required. Where we use a service provider to
          process data for us, we take appropriate steps to require
          confidentiality and safeguards consistent with applicable law.
        </p>
      </Section>

      <Section title="2. Personal data we collect">
        <ul className="list-disc space-y-2 pl-6">
          <li>Account and identity information, such as your name, email address, account identifier, and authentication details supplied through our sign-in provider.</li>
          <li>Profile information you choose to provide, such as biography, location, skills, rates, portfolio, profile image, and verification material.</li>
          <li>Marketplace information, including job posts, proposals, messages, reviews, saved items, and records of agreements or disputes you submit through the Platform.</li>
          <li>Payment-related information, such as transaction references, payment status, amounts, and billing records. Payment card and bank details are handled by the relevant payment provider and are not intended to be stored in your public profile.</li>
          <li>Technical and usage information, such as device and browser information, log data, security events, and interactions with Platform features, to the extent collected by our systems or service providers.</li>
          <li>Information you provide when contacting us or responding to a support, safety, or verification request.</li>
        </ul>
        <p>
          We may receive information from other users, authentication and
          payment providers, and public or legally available sources where
          relevant to providing the Platform, preventing fraud, or meeting a
          legal obligation. Please do not submit another person's sensitive
          personal data unless you have a lawful basis and authority to do so.
        </p>
      </Section>

      <Section title="3. How and why we use personal data">
        <p>We use personal data only for purposes connected to operating and protecting AfriLance, including to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>create and secure accounts, authenticate users, and provide requested marketplace features;</li>
          <li>display profiles and listings according to your settings, and help clients and service providers communicate;</li>
          <li>process or reconcile transactions and provide payment-related support;</li>
          <li>respond to support requests, investigate reports, enforce our Terms, and prevent fraud, abuse, and security incidents;</li>
          <li>maintain, troubleshoot, measure, and improve the reliability and accessibility of the Platform;</li>
          <li>send service, security, and policy notices, and send promotional communications only where permitted and with an opportunity to opt out where required;</li>
          <li>comply with Ghanaian law, respond to lawful requests, and establish or defend legal claims.</li>
        </ul>
        <p>
          Depending on the context and applicable requirements of Act 843, we
          process information with your consent, to take steps at your request
          or provide a service you use, to meet a legal obligation, or where
          another lawful basis is available. If a requested use depends on
          consent, you may withdraw it; withdrawal does not make prior lawful
          processing unlawful or prevent processing required on another lawful
          basis.
        </p>
      </Section>

      <Section title="4. Profiles, messages, and information visible to others">
        <p>
          Information you place in a public profile, job listing, proposal, or
          review may be visible to other users or to the public, depending on
          the feature. Do not place private contact, financial, health, identity
          document, or other sensitive information in public fields. Messages
          and project information are available to the people participating in
          the relevant conversation and may be reviewed when reasonably needed
          for support, safety, dispute handling, or legal compliance.
        </p>
      </Section>

      <Section title="5. When we share personal data">
        <p>We may share relevant information with:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>other users, as needed for the marketplace features you choose to use;</li>
          <li>service providers that help us host and secure the Platform, authenticate accounts, store files, communicate with users, or process payments, including Clerk and Paystack where their services are used;</li>
          <li>professional advisers, auditors, insurers, or prospective successors where reasonably necessary and subject to appropriate confidentiality safeguards;</li>
          <li>public authorities, regulators, courts, or law enforcement where disclosure is required by law or reasonably necessary to protect rights, safety, and the Platform; and</li>
          <li>another party where you direct us to share information or give valid consent.</li>
        </ul>
        <p>
          We do not sell personal data. We do not permit service providers to
          use personal data they process for us for their own unrelated
          purposes, except where they act as independent controllers under
          their own privacy terms and applicable law.
        </p>
      </Section>

      <Section title="6. Storage and transfers">
        <p>
          AfriLance and its service providers may store or process information
          in Ghana or in other countries where their systems operate. Where
          personal data is transferred outside Ghana, we will take steps
          required by Act 843 and other applicable law to protect it and ensure
          the transfer has an appropriate legal basis and safeguards. Internet
          transmission and electronic storage cannot be guaranteed completely
          secure, but we use reasonable technical and organisational safeguards
          appropriate to the information and risks.
        </p>
      </Section>

      <Section title="7. Retention">
        <p>
          We retain personal data for as long as needed to provide the Platform,
          maintain your account, fulfil the purposes described here, resolve
          disputes, enforce agreements, and meet applicable legal, tax,
          accounting, and security requirements. Retention periods vary by data
          type and purpose. When information is no longer reasonably needed, we
          delete it, anonymise it, or securely restrict access, subject to
          lawful retention requirements.
        </p>
        <p>
          We retain records of your Terms and Privacy Policy acceptance,
          including the accepted versions and timestamp, for accountability,
          compliance, and dispute-resolution purposes. Closing an account does
          not necessarily require immediate deletion of records we are legally
          required or permitted to keep.
        </p>
      </Section>

      <Section title="8. Your rights">
        <p>
          Subject to the requirements, exceptions, and procedures in Act 843,
          you may ask us to confirm whether we hold your personal data, access
          it, correct inaccurate or incomplete information, request deletion or
          destruction where appropriate, object to or prevent certain
          processing, and withdraw consent where processing depends on consent.
          You may also complain to the Data Protection Commission if you believe
          your data protection rights have been infringed.
        </p>
        <p>
          To make a request, contact MB Corporation using the contact channel
          published on AfriLance or in the Platform and describe the request
          clearly. We may ask for information needed to verify your identity
          and locate your records. We will respond within the period required
          by applicable law. A request may be limited where the law permits,
          including where keeping information is necessary to meet a legal
          obligation or establish, exercise, or defend a legal claim.
        </p>
        <p>
          You can update profile information through account settings and
          manage optional communications using the instructions in a message
          or the relevant account setting.
        </p>
      </Section>

      <Section title="9. Cookies and similar technologies">
        <p>
          The Platform and its service providers may use essential cookies or
          similar technologies to support sign-in, security, and core
          functionality. If we use optional analytics or advertising
          technologies, we will provide appropriate information and choices
          where required by law. You can manage cookies through your browser,
          though disabling essential cookies may prevent some features from
          working.
        </p>
      </Section>

      <Section title="10. Children and sensitive personal data">
        <p>
          The Platform is intended for people aged 18 and over. We do not
          knowingly seek to collect personal data from children for account
          creation. If you believe a child has provided personal data, contact
          us so we can assess and take appropriate action.
        </p>
        <p>
          Do not submit sensitive personal data unless a feature specifically
          requests it and you have a lawful reason to provide it. We will
          process sensitive personal data only where permitted by Act 843 and
          with any safeguards or conditions the law requires.
        </p>
      </Section>

      <Section title="11. Changes to this Policy">
        <p>
          We may update this Policy to reflect legal, technical, or operational
          changes. The current version and effective date will be shown here.
          If a change materially affects how we handle personal data or your
          rights, we will provide reasonable notice and, where required, ask
          you to accept the new version before using authenticated features.
          Previous acceptance records are retained for accountability.
        </p>
      </Section>

      <Section title="12. Contact and complaints">
        <p>
          For questions or requests about personal data, contact MB
          Corporation through the contact channel published on AfriLance or in
          the Platform. You may also contact the Data Protection Commission of
          Ghana to seek information or make a complaint under Act 843. Our
          Terms of Service are available in the <Link className="font-medium text-primary underline underline-offset-4" to="/terms">Terms of Service</Link>.
        </p>
      </Section>
    </LegalDocumentLayout>
  );
}
