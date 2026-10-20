import type { ReactNode } from "react";
import { CURRENT_TERMS_VERSION } from "@workspace/api-zod";
import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
      <h2 id={title.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="mb-2 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <LegalDocumentLayout
      title="Terms of Service"
      version={CURRENT_TERMS_VERSION}
    >
      <p>
        These Terms of Service (“Terms”) are an agreement between you and MB
        Corporation, trading as Afrlance (“Afrlance”, “we”, “us” or “our”).
        They govern your access to and use of the Afrlance website, applications,
        and related services (the “Platform”). By creating an account, selecting
        “I agree”, or using the Platform after being asked to accept these Terms,
        you agree to them. If you do not agree, do not use the Platform.
      </p>
      <p>
        These Terms are written for users in Ghana and are governed by the laws
        of the Republic of Ghana. They do not remove rights that cannot lawfully
        be excluded under Ghanaian law. Please obtain independent legal advice
        if you need advice about your particular circumstances.
      </p>

      <Section title="1. Eligibility and your account">
        <p>You must be at least 18 years old and legally capable of entering into a binding agreement to use the Platform. You must provide accurate account information, keep your credentials secure, and promptly correct material inaccuracies. You are responsible for activity carried out through your account unless applicable law provides otherwise.</p>
        <p>Do not create an account for another person without authority, impersonate anyone, or use the Platform while prohibited by law. We may request information reasonably needed to protect accounts, comply with law, or operate the Platform.</p>
      </Section>

      <Section title="2. Afrlance is a marketplace facilitator">
        <p>Afrlance provides an online marketplace that helps clients discover independent service providers, publish opportunities, communicate, and arrange work. Except for obligations we expressly undertake as the provider of the Platform or payment-related services described to you, Afrlance is a facilitator and is not a party to the service contract between a client and a service provider.</p>
        <p>Users—not Afrlance—choose whether to work together and are responsible for agreeing the scope, deliverables, schedule, price, payment milestones, acceptance criteria, and any other project terms. Afrlance does not employ, supervise, or guarantee either party; verify every user or listing; guarantee a project, payment, result, quality, or a user's identity; or act as an agent, employer, recruiter, or legal representative for a user. Users should perform their own checks and put important project terms in writing.</p>
      </Section>

      <Section title="3. Independent contractor relationship">
        <p>Service providers using Afrlance do so as independent businesses or independent contractors, not as employees, workers, partners, or agents of Afrlance. A service provider is not entitled, by reason only of using the Platform, to wages, employee benefits, paid leave, pension contributions, or other employment benefits from Afrlance. The client and service provider are independently responsible for determining and documenting their relationship and complying with applicable labour, social security, and other laws.</p>
        <p>Nothing in these Terms changes a legal classification that must be determined under applicable law from the actual facts and working arrangements. The label “independent contractor” cannot override mandatory legal rights or obligations.</p>
      </Section>

      <Section title="4. User responsibilities and acceptable use">
        <p>You must comply with the laws of Ghana and any other laws that apply to you, respect the rights of others, and use the Platform honestly. You must not post unlawful, fraudulent, misleading, discriminatory, abusive, or infringing material; exploit or harass another user; manipulate reviews or listings; interfere with Platform security or operation; introduce malicious code; scrape or access data without permission; or use the Platform to facilitate a prohibited transaction.</p>
        <p>You are responsible for the accuracy and legality of the content and offers you submit, for assessing whether you are qualified and authorised to perform or purchase a service, and for protecting confidential information you receive from another user.</p>
      </Section>

      <Section title="5. Projects, communications, and user disputes">
        <p>Before starting work, clients and service providers should agree in writing on the work, deadlines, payment, expenses, revisions, cancellation, and ownership or licensing of deliverables. Unless a separate written agreement or applicable law says otherwise, Afrlance does not decide whether a deliverable satisfies a project contract or resolve the merits of a user-to-user claim.</p>
        <p>Users are responsible for their communications and project decisions. We may offer tools or assistance at our discretion, but doing so does not make us a party to a user contract or guarantee a resolution.</p>
      </Section>

      <Section title="6. Fees and payments">
        <p>Any Platform fee, payment processing fee, or other charge will be disclosed before you are asked to pay it. Payment processing may be provided by a third-party provider and may be subject to that provider’s terms. We do not promise that a payment method, payment service, or transfer will always be available or immediate.</p>
        <p>Clients and service providers are responsible for agreeing the commercial terms of their projects and for keeping relevant records. Do not send payment credentials or sensitive financial information through public profile fields or messages.</p>
      </Section>

      <Section title="7. Taxes and statutory obligations">
        <p>Each user is responsible for determining, reporting, and paying their own taxes and statutory contributions arising from their use of the Platform or work arranged through it, including any applicable income tax, value added tax, withholding tax, or social security obligations in Ghana. Service providers should obtain their own advice from the Ghana Revenue Authority or a qualified tax professional. Afrlance does not provide tax advice and does not assume a user's tax obligations, except to the extent a non-waivable law expressly requires otherwise.</p>
      </Section>

      <Section title="8. Intellectual property">
        <p>Afrlance and its licensors retain rights in the Platform, branding, software, and related materials. You may use the Platform only as permitted by these Terms and applicable law.</p>
        <p>You retain rights in content you submit, subject to rights you grant to other users and any project agreement. You grant Afrlance a limited, non-exclusive, worldwide, royalty-free licence to host, reproduce, display, and process your content only as reasonably necessary to operate, secure, and improve the Platform and provide its features. You confirm that you have the rights needed to submit that content. Ownership or licensing of work created for a client should be expressly agreed between the client and service provider; Afrlance does not transfer ownership on their behalf.</p>
      </Section>

      <Section title="9. Privacy and electronic transactions">
        <p>Our Privacy Policy explains how personal data is handled in accordance with the Data Protection Act, 2012 (Act 843), including applicable data protection principles and user rights. By using electronic records, notices, and communications on the Platform, you acknowledge that electronic transactions and records may be used as contemplated by the Electronic Transactions Act, 2008 (Act 772), subject to any legal requirements for a particular transaction or notice.</p>
        <p>Electronic acceptance records may be retained as evidence of the version of these Terms and Privacy Policy that you accepted and when you accepted them.</p>
      </Section>

      <Section title="10. Suspension and termination">
        <p>You may stop using the Platform and close your account through available account settings or by contacting us. We may restrict or suspend access, remove content, or close an account where reasonably necessary for safety, suspected fraud or unlawful conduct, breach of these Terms, protection of users or the Platform, or compliance with law. Where appropriate and lawful, we will provide notice and an opportunity to address the issue.</p>
        <p>Termination does not affect accrued rights, payment obligations, lawful retention of records, or provisions that by their nature continue to apply.</p>
      </Section>

      <Section title="11. Disclaimers">
        <p>To the extent permitted by law, the Platform is provided on an “as available” basis. We do not warrant uninterrupted or error-free operation, the accuracy of user content, or the suitability, safety, legality, or performance of a user, service, or project. We do not guarantee that a client will hire, that a service provider will be hired or paid, or that a dispute will be resolved in a particular way.</p>
        <p>Nothing in these Terms excludes a consumer protection, statutory, or other guarantee that cannot lawfully be excluded.</p>
      </Section>

      <Section title="12. Limitation of liability">
        <p>To the extent permitted by the laws of the Republic of Ghana, Afrlance is not liable for indirect or consequential loss, loss of profit, opportunity, goodwill, data, or business, or for a user's acts, omissions, services, contract, or content. This does not exclude liability that cannot lawfully be excluded, including liability arising from fraud or wilful misconduct where exclusion is prohibited.</p>
        <p>To the extent liability may lawfully be limited, Afrlance's total aggregate liability arising out of or connected with the Platform or these Terms will not exceed the greater of GHS 1,000 and the Platform fees you paid or owed to Afrlance in the 12 months before the event giving rise to the claim. This limit does not apply to liability that applicable law does not permit us to limit.</p>
      </Section>

      <Section title="13. Indemnity">
        <p>To the extent permitted by law, you will indemnify Afrlance against a third-party claim and reasonable associated costs to the extent caused by your unlawful conduct, your content, your breach of these Terms, or your violation of another person's rights. We will give you reasonably prompt notice of a claim and reasonable cooperation; you may not settle a claim in a way that imposes an admission or obligation on Afrlance without our prior written consent. This clause does not require you to indemnify Afrlance for loss caused by Afrlance's own breach, negligence, or wilful misconduct.</p>
      </Section>

      <Section title="14. Changes to the Platform or these Terms">
        <p>We may update the Platform and these Terms to reflect changes in law, services, or operational needs. We will publish the current Terms and version on the Platform. If a change is material, we will give reasonable notice and, where required, ask you to accept the new version before continuing to use authenticated features. The new version applies from its stated effective date; prior acceptance records are retained as described in the Privacy Policy.</p>
      </Section>

      <Section title="15. Disputes and governing law">
        <p>These Terms and any non-contractual dispute connected with them are governed by the laws of the Republic of Ghana. Before bringing a claim, the parties should try in good faith to resolve it by written discussion where reasonably practicable. This does not prevent either party from seeking urgent relief or pursuing a claim within a statutory time limit.</p>
        <p>The courts of competent jurisdiction in Ghana have exclusive jurisdiction over disputes arising from these Terms or use of the Platform, subject to any mandatory right to bring proceedings elsewhere that cannot lawfully be waived.</p>
      </Section>

      <Section title="16. General">
        <p>If a provision is found unenforceable, it will be limited only to the extent necessary, and the remaining provisions will continue. A failure to enforce a provision is not a waiver. You may not transfer your rights or obligations under these Terms without our consent; we may transfer them as part of a lawful corporate reorganisation or transfer of the Platform, without reducing your statutory rights. These Terms, together with the Privacy Policy and any expressly incorporated terms, form the agreement between you and Afrlance about use of the Platform.</p>
      </Section>

      <Section title="17. Contact">
        <p>For questions about these Terms, contact MB Corporation through the contact channel published on Afrlance or in the Platform. For privacy matters, see the contact and complaint information in the Privacy Policy.</p>
      </Section>
    </LegalDocumentLayout>
  );
}
