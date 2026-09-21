/**
 * Checkout Failure Page
 * Displayed after failed or cancelled payment
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  XCircle, AlertTriangle, RefreshCw, ArrowLeft, 
  CreditCard, HelpCircle, MessageCircle, Shield
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';

const CheckoutFailurePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const errorCode = searchParams.get('error') || 'payment_failed';
  const planId = searchParams.get('plan') || '';
  const orderId = searchParams.get('order_id') || '';

  // Error messages mapping
  const ERROR_MESSAGES = {
    'payment_failed': {
      title: 'Payment Failed',
      description: 'Your payment could not be processed. Please try again or use a different payment method.',
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    'payment_cancelled': {
      title: 'Payment Cancelled',
      description: 'You cancelled the payment process. No charges have been made to your account.',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    'card_declined': {
      title: 'Card Declined',
      description: 'Your card was declined by your bank. Please contact your bank or try a different card.',
      icon: CreditCard,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    'insufficient_funds': {
      title: 'Insufficient Funds',
      description: 'There were insufficient funds in your account. Please ensure adequate balance and try again.',
      icon: CreditCard,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    'network_error': {
      title: 'Network Error',
      description: 'A network error occurred during payment. Please check your connection and try again.',
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    'verification_failed': {
      title: 'Verification Failed',
      description: 'Payment verification failed. If you were charged, please contact support.',
      icon: Shield,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
  };

  const errorInfo = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['payment_failed'];
  const ErrorIcon = errorInfo.icon;

  const handleRetry = () => {
    if (planId) {
      navigate(`/pricing?plan=${planId}`);
    } else {
      navigate('/pricing');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-white" data-testid="checkout-failure-page">
      <div className="max-w-lg mx-auto px-4 py-16">
        {/* Error Animation */}
        <div className="text-center mb-8">
          <div className={`inline-block ${errorInfo.bgColor} rounded-full p-6`}>
            <ErrorIcon size={64} className={errorInfo.color} />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-3">
            {errorInfo.title}
          </h1>
          <p className="text-stone-600 text-lg">
            {errorInfo.description}
          </p>
        </div>

        {/* Error Details Card */}
        <div className="bg-white rounded-2xl p-6 mb-8 border border-stone-200">
          <h3 className="font-semibold text-stone-800 mb-4">What happened?</h3>
          <div className="space-y-3 text-sm text-stone-600">
            <p>
              <strong>Error Code:</strong> {errorCode}
            </p>
            {orderId && (
              <p>
                <strong>Order Reference:</strong> {orderId}
              </p>
            )}
            <p className="text-stone-400 text-xs">
              No charges have been made to your account for this failed transaction.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-8">
          <Button 
            onClick={handleRetry}
            className="w-full rounded-full bg-primary hover:bg-primary/90 h-12 text-lg"
            data-testid="retry-payment-button"
          >
            <RefreshCw size={20} className="mr-2" />
            Try Again
          </Button>
          
          <Button 
            onClick={() => navigate('/pricing')}
            variant="outline"
            className="w-full rounded-full h-12"
            data-testid="view-plans-button"
          >
            <CreditCard size={20} className="mr-2" />
            View Other Plans
          </Button>

          <Button 
            onClick={() => navigate('/')}
            variant="ghost"
            className="w-full rounded-full h-12"
            data-testid="back-to-app-button"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to App
          </Button>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <HelpCircle size={20} />
            Common Questions
          </h3>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left text-sm">
                Was I charged for this failed payment?
              </AccordionTrigger>
              <AccordionContent className="text-stone-600 text-sm">
                No. If the payment failed, no charges were made to your account. 
                If you see any pending charges, they should be automatically reversed 
                within 3-5 business days.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left text-sm">
                Why did my payment fail?
              </AccordionTrigger>
              <AccordionContent className="text-stone-600 text-sm">
                Payments can fail for several reasons including insufficient funds, 
                card limits, bank security blocks, or incorrect card details. 
                Contact your bank if the issue persists.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left text-sm">
                Can I use a different payment method?
              </AccordionTrigger>
              <AccordionContent className="text-stone-600 text-sm">
                Yes! You can try with a different card, UPI, net banking, or other 
                payment methods available through our payment processor.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left text-sm">
                How do I contact support?
              </AccordionTrigger>
              <AccordionContent className="text-stone-600 text-sm">
                If you continue to face issues, please reach out to our support team 
                with your order reference number. We'll help resolve any payment issues.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Support Contact */}
        <div className="text-center mt-8">
          <p className="text-stone-500 text-sm mb-2">Still having trouble?</p>
          <Button 
            variant="link" 
            className="text-primary"
            onClick={() => window.location.href = 'mailto:support@moodfood.app'}
          >
            <MessageCircle size={16} className="mr-2" />
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutFailurePage;
