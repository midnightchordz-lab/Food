// Content sourced from moodfood.in (Terms, Privacy Policy, Support) — Feb 20, 2026.
// Bundled locally so the screens work offline and load instantly.

export type LegalKey = 'terms' | 'privacy' | 'support';

export const LEGAL_META: Record<LegalKey, { title: string; subtitle: string; icon: string }> = {
  terms: { title: 'Terms & Conditions', subtitle: 'Last updated: February 20, 2026', icon: 'file-document-outline' },
  privacy: { title: 'Privacy Policy', subtitle: 'Last updated: February 20, 2026', icon: 'shield-lock-outline' },
  support: { title: 'Support', subtitle: "We're here if something's not working", icon: 'lifebuoy' },
};

export const SUPPORT_EMAIL = 'support@moodfood.in';
export const PRIVACY_EMAIL = 'privacy@moodfood.app';

export const LEGAL_CONTENT: Record<LegalKey, string> = {
  terms: `These Terms & Conditions ("Terms") govern your access to and use of the MoodFood mobile application and website (together, the "Service"), operated by MoodFood ("we," "our," or "us"). By creating an account or using the Service, you agree to these Terms. If you don't agree, please don't use the Service.

## 1. Eligibility
You must be at least 13 years old to use MoodFood. By using the Service, you confirm that you meet this requirement. If you are under the age of majority in your jurisdiction, you confirm you have a parent or guardian's permission to use the Service.

## 2. Your Account
- You're responsible for keeping your account credentials secure and for all activity under your account.
- You agree to provide accurate account information and to keep it up to date.
- We may suspend or terminate accounts that violate these Terms, are inactive for an extended period, or are used fraudulently.

## 3. Subscriptions & Billing
MoodFood offers a Free plan and paid plans (currently Premium, Chef Pro, and Family).
- Paid subscriptions are billed in advance on a monthly or annual basis and renew automatically unless cancelled before the renewal date.
- Subscriptions purchased through the Apple App Store or Google Play are billed and managed through that platform's account settings — cancellations and refund requests for those purchases are handled per that platform's policies, not directly by us.
- We may change subscription pricing or features with advance notice; continued use after a price change takes effect constitutes acceptance of the new price.
- Family Plan subscriptions extend access to invited family members subject to the plan's member limits.

## 4. AI-Generated Recipes & Nutritional Information — Please Read
**MoodFood is not a medical service.** Recipes, meal plans, and nutritional or dietary information (including diabetes-friendly suggestions, net carb estimates, and glycemic index references) are generated or assisted by AI and are provided for general informational and cooking purposes only. They are not a substitute for professional medical, nutritional, or dietary advice. Always consult a qualified healthcare provider or registered dietitian before making significant dietary changes, especially if you have diabetes, a food allergy, or another medical condition. We are not responsible for any health outcome resulting from reliance on AI-generated content.

## 5. Imported & User Content
The Service lets you import recipes from links, photos, videos, or pasted text, and save, vote on, or create your own recipes ("User Content").
- You're responsible for having the right to import or submit any content you add to the Service, and for its accuracy.
- You grant us a non-exclusive, worldwide license to host, store, and display your User Content as needed to operate the Service.
- We may remove content that violates these Terms or applicable law.

## 6. Acceptable Use
You agree not to:
- Use the Service for any unlawful purpose or in violation of these Terms;
- Attempt to reverse-engineer, scrape, or disrupt the Service or its AI systems;
- Upload content that infringes someone else's rights, is abusive, or is otherwise harmful;
- Share your account or Family Plan access with anyone outside your household in a way that circumvents subscription limits.

## 7. Camera, Microphone & Other Permissions
Features like the fridge scanner, recipe photo import, and voice-guided cooking use device camera and microphone permissions. These are optional — see our Privacy Policy for details on what's collected and how it's used.

## 8. Intellectual Property
The Service, including its design, features, and AI models (but excluding your User Content), is owned by MoodFood and protected by intellectual property laws. You may not copy, modify, or redistribute any part of the Service outside of normal use of the app.

## 9. Termination
You may stop using the Service and delete your account at any time from within the app. We may suspend or terminate your access if you violate these Terms. Upon deletion, your data is handled as described in our Privacy Policy.

## 10. Disclaimer of Warranties
The Service is provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We don't guarantee the Service will be uninterrupted, error-free, or that AI-generated content will always be accurate.

## 11. Limitation of Liability
To the fullest extent permitted by law, MoodFood will not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including any health, dietary, or financial outcome resulting from recipes or nutritional information provided through the Service.

## 12. Governing Law
These Terms are governed by the laws of the applicable local jurisdiction, without regard to conflict-of-law principles.

## 13. Changes to These Terms
We may update these Terms from time to time. We'll notify you of significant changes via in-app notification, email, or an updated "Last updated" date above. Continued use of the Service after changes take effect means you accept the updated Terms.

## 14. Contact Us
Questions about these Terms? Reach us at support@moodfood.in.`,

  privacy: `Welcome to MoodFood ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our mobile application.

## Information We Collect
### Information You Provide
- **Account Information:** Email address, name, and password when you create an account
- **Profile Information:** Dietary preferences, cuisine preferences, and mood selections
- **Family Plan Information:** Family member details if you subscribe to our Family Plan
- **Recipe Interactions:** Recipes you save, vote on, or create

### Information Collected Automatically
- **Usage Data:** Features you use, recipes you view, and time spent in the app
- **Device Information:** Device type, operating system version, and unique device identifiers
- **Log Data:** App crashes, error reports, and performance data

### Permissions We Request
- **Camera:** Scanning recipes, photographing ingredients and finished dishes (optional — you can decline and still use the app)
- **Microphone:** Voice commands during hands-free cooking and AI Chef interaction (optional — you can use text instead)
- **Internet:** Required for syncing recipes, AI recipe generation, and accessing our cooking database

## How We Use Your Information
- Provide personalized recipe recommendations based on your mood and preferences
- Generate custom recipes using AI technology
- Enable voice-controlled cooking features
- Manage your Family Plan subscription and voting features
- Improve app performance and user experience
- Send important notifications about your account or recipes
- Provide customer support

## Data Sharing and Third Parties
We do **NOT** sell your personal information to third parties. We may share limited data with:
- **Cloud Service Providers:** For secure data storage and app functionality
- **Analytics Services:** To understand app usage and improve features (anonymized data only)
- **AI Service Providers:** To power recipe generation and AI Chef features (data is processed securely)

## Data Security
- Encryption of data in transit and at rest
- Secure authentication and password hashing
- Regular security audits and updates
- Secure cloud infrastructure

## Your Rights and Choices
- **Access:** Request a copy of your personal data
- **Correction:** Update or correct your information
- **Deletion:** Request deletion of your account and data
- **Opt-out:** Disable notifications or certain features
- **Data Portability:** Export your recipes and preferences

To exercise these rights, contact us at privacy@moodfood.app.

## Children's Privacy
MoodFood is not intended for children under 13. We do not knowingly collect information from children under 13. If you believe a child has provided us with their information, please contact us immediately.

## Data Retention
We retain your data for as long as your account is active, as required to provide our services, and as necessary for legal compliance. After account deletion, we retain minimal data for 30 days for recovery purposes, then permanently delete all personal information.

## Push Notifications
We may send push notifications for cooking timers and reminders, new recipe recommendations, Family Plan voting requests, and important account updates. You can disable push notifications in your device settings at any time.

## Changes to This Privacy Policy
We may update this Privacy Policy periodically. We will notify you of significant changes via in-app notification, email, or an updated "Last Updated" date. Continued use of MoodFood after changes constitutes acceptance of the updated policy.

## Contact Us
For questions or requests regarding this Privacy Policy or your data — Email: privacy@moodfood.app · Support: support@moodfood.in

## Summary of Key Points
- We collect only data necessary to provide our services
- We do NOT sell your personal information
- Camera and microphone permissions are optional
- You can delete your account and data at any time
- We use industry-standard security measures
- You control your privacy settings and notifications`,

  support: `Whether it's a billing question, a recipe that didn't import right, or you just can't find a setting — reach a real person at support@moodfood.in.

When you email us, include your account email and, if it's a recipe or app issue, a screenshot — it helps us sort things out faster.

## A few quick answers
### How do I cancel my subscription?
If you subscribed through the App Store or Google Play, cancel from that store's subscription settings on your device — we can't cancel platform purchases on our end. If you're unsure which you used, email us and we'll point you the right way.

### Can I delete my account and data?
Yes — you can delete your account from within the app at any time. See our Privacy Policy for what happens to your data afterward, or email us and we'll handle it for you.

### Is the diabetes-friendly info medical advice?
No — net carb and glycemic index suggestions are informational, generated to help with planning, not a substitute for guidance from your doctor or a registered dietitian.

### A recipe I imported looks wrong — what do I do?
Email us the original link, photo, or video along with what came out wrong — it helps us improve the import for everyone.

### How does Family Plan sharing work?
The account holder can invite family members from the app's Family settings, up to the plan's member limit. Invited members get their own moods and preferences, shared meal plans and shopping lists.`,
};

// Support "topic" shortcuts that pre-fill an email subject.
export const SUPPORT_TOPICS: { label: string; desc: string; icon: string; subject: string }[] = [
  { label: 'Billing & subscriptions', desc: 'Plans, charges, and cancellations', icon: 'credit-card-outline', subject: 'Billing & subscription question' },
  { label: 'Account & login', desc: 'Sign-in issues, password, deleting your account', icon: 'account-outline', subject: 'Account & login help' },
  { label: 'Recipes & AI chef', desc: 'Imports, mood matches, meal plans', icon: 'silverware-fork-knife', subject: 'Recipe or AI chef issue' },
  { label: 'Report a bug', desc: 'Something broken or acting up', icon: 'bug-outline', subject: 'Bug report' },
];
