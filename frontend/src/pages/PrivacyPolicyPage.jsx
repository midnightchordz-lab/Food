import { ArrowLeft, Shield, Mail, Database, Lock, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen pt-20 pb-24 md:pb-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-stone-50 via-background to-stone-100/50 dark:from-stone-950/50 dark:via-background dark:to-stone-900/30" data-testid="privacy-policy-page">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 rounded-full hover:bg-primary/10"
          data-testid="back-button"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back
        </Button>
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield size={32} className="text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2" data-testid="privacy-title">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">
            for MoodFood
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: 16/02/2026
          </p>
        </div>
        
        {/* Content */}
        <div className="space-y-8">
          {/* Information We Collect */}
          <section className="bg-white/80 dark:bg-card/80 backdrop-blur-sm rounded-2xl border border-border/40 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Database size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold">Information We Collect</h2>
            </div>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Email address or Phone Number for account creation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Usage data to improve the app</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Recipe preferences and cooking history</span>
              </li>
            </ul>
          </section>
          
          {/* How We Use Information */}
          <section className="bg-white/80 dark:bg-card/80 backdrop-blur-sm rounded-2xl border border-border/40 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Bell size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold">How We Use Information</h2>
            </div>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>To provide personalized recipe recommendations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>To improve app functionality</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>To send important updates about the service</span>
              </li>
            </ul>
          </section>
          
          {/* Data Security */}
          <section className="bg-white/80 dark:bg-card/80 backdrop-blur-sm rounded-2xl border border-border/40 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lock size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold">Data Security</h2>
            </div>
            <p className="text-muted-foreground">
              We implement appropriate security measures to protect your data. Your information is stored securely and we use industry-standard encryption to safeguard your personal details.
            </p>
          </section>
          
          {/* Contact Us */}
          <section className="bg-white/80 dark:bg-card/80 backdrop-blur-sm rounded-2xl border border-border/40 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Mail size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold">Contact Us</h2>
            </div>
            <p className="text-muted-foreground mb-3">
              For privacy questions, contact:
            </p>
            <a 
              href="mailto:midnightchordz@gmail.com" 
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
              data-testid="contact-email"
            >
              <Mail size={16} />
              midnightchordz@gmail.com
            </a>
          </section>
        </div>
        
        {/* Footer note */}
        <div className="mt-10 text-center text-sm text-muted-foreground">
          <p>
            By using MoodFood, you agree to this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
