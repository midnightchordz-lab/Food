import { ArrowLeft, Shield, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  const termsFeedUrl = 'https://www.termsfeed.com/live/b7d423d9-b86b-4642-a9ab-3fc13fcb730d';
  
  return (
    <div className="min-h-screen pt-20 pb-24 md:pb-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-stone-50 via-background to-stone-100/50 dark:from-stone-950/50 dark:via-background dark:to-stone-900/30" data-testid="privacy-policy-page">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="rounded-full hover:bg-primary/10"
            data-testid="back-button"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
          <a
            href={termsFeedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            data-testid="open-in-new-tab"
          >
            <ExternalLink size={16} />
            Open in new tab
          </a>
        </div>
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <Shield size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold mb-1" data-testid="privacy-title">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm">
            for MoodFood
          </p>
        </div>
        
        {/* Embedded Privacy Policy from TermsFeed */}
        <div className="bg-white dark:bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
          <iframe
            src={termsFeedUrl}
            title="Privacy Policy"
            className="w-full border-0"
            style={{ minHeight: '70vh', height: '800px' }}
            data-testid="privacy-policy-iframe"
          />
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
