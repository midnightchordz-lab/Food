/**
 * Upgrade Modal Component
 * Shows when user hits usage limit, prompting upgrade
 */
import { useNavigate } from 'react-router-dom';
import { X, Crown, Sparkles, ChefHat, ArrowRight, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { useUsageLimit } from '../hooks/useUsageLimit';
import { formatTimeUntilReset } from '../services/usageLimitService';

export const UpgradeModal = () => {
  const navigate = useNavigate();
  const { showUpgradeModal, upgradeModalData, closeUpgradeModal } = useUsageLimit();

  if (!showUpgradeModal) return null;

  const { feature, used, limit, resetAt } = upgradeModalData;
  const isRecipes = feature === 'recipes' || feature === 'recipe_search';

  const handleUpgrade = () => {
    closeUpgradeModal();
    navigate('/pricing');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeUpgradeModal}
      data-testid="upgrade-modal"
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-primary/10 via-amber-50 to-orange-50 px-6 py-8 text-center relative">
          <button 
            onClick={closeUpgradeModal}
            className="absolute top-4 right-4 p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-white/50 transition-colors"
            data-testid="close-modal-button"
          >
            <X size={20} />
          </button>
          
          <div className="inline-flex p-4 rounded-full bg-white shadow-lg mb-4">
            <Crown size={32} className="text-amber-500" />
          </div>
          
          <h2 className="text-xl font-bold text-stone-800" data-testid="modal-title">
            Daily Limit Reached
          </h2>
          
          <p className="text-stone-600 mt-2">
            You've used all {limit} {isRecipes ? 'recipes' : 'meal plans'} for {isRecipes ? 'today' : 'this week'}
          </p>
          
          {resetAt && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-sm text-stone-500">
              <Clock size={14} />
              <span>Resets in {formatTimeUntilReset(resetAt)}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* What you get */}
          <div className="mb-6">
            <p className="text-sm font-medium text-stone-700 mb-3">
              Upgrade to Premium for:
            </p>
            
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5">
                <div className="p-0.5 rounded-full bg-green-100 mt-0.5">
                  <Sparkles size={12} className="text-green-600" />
                </div>
                <span className="text-sm text-stone-600">
                  <strong className="text-stone-800">Unlimited recipes</strong> - Generate as many as you want
                </span>
              </li>
              
              <li className="flex items-start gap-2.5">
                <div className="p-0.5 rounded-full bg-green-100 mt-0.5">
                  <Sparkles size={12} className="text-green-600" />
                </div>
                <span className="text-sm text-stone-600">
                  <strong className="text-stone-800">2,000+ premium recipes</strong> - Access our full library
                </span>
              </li>
              
              <li className="flex items-start gap-2.5">
                <div className="p-0.5 rounded-full bg-green-100 mt-0.5">
                  <Sparkles size={12} className="text-green-600" />
                </div>
                <span className="text-sm text-stone-600">
                  <strong className="text-stone-800">Ad-free experience</strong> - No interruptions
                </span>
              </li>
              
              <li className="flex items-start gap-2.5">
                <div className="p-0.5 rounded-full bg-green-100 mt-0.5">
                  <Sparkles size={12} className="text-green-600" />
                </div>
                <span className="text-sm text-stone-600">
                  <strong className="text-stone-800">Recipe Import</strong> - Save recipes from anywhere
                </span>
              </li>
            </ul>
          </div>

          {/* Plan card */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 mb-5">
            <ChefHat size={28} className="text-amber-600" />
            <div className="flex-1">
              <p className="font-semibold text-stone-800">
                Premium Plan
              </p>
              <p className="text-sm text-stone-500">
                Starting at $9.99/month
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                7-day trial
              </span>
            </div>
          </div>

          {/* CTA Buttons */}
          <Button 
            onClick={handleUpgrade}
            className="w-full rounded-full bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 h-12 text-base font-semibold"
            data-testid="view-plans-button"
          >
            View Plans
            <ArrowRight size={18} className="ml-2" />
          </Button>
          
          <button
            onClick={closeUpgradeModal}
            className="w-full mt-3 text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
