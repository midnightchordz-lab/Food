/**
 * Usage Limit Banner Component
 * Shows remaining usage at the top of pages for free users
 */
import { Link } from 'react-router-dom';
import { Sparkles, ChefHat, AlertTriangle } from 'lucide-react';
import { useUsageLimit } from '../hooks/useUsageLimit';
import { formatTimeUntilReset } from '../services/usageLimitService';

export const UsageLimitBanner = ({ type = 'recipes' }) => {
  const { usage, loading, isFreeTier } = useUsageLimit();

  // Don't show for paid users or while loading
  if (loading || !isFreeTier || !usage) return null;

  const data = type === 'recipes' ? usage.recipes : usage.meal_plans;
  const { used_today, used_this_week, limit, remaining, reset_at } = data;
  const used = type === 'recipes' ? used_today : used_this_week;

  // Don't show if unlimited
  if (limit === -1) return null;

  // Determine banner state
  const isNearLimit = remaining <= 2 && remaining > 0;
  const isAtLimit = remaining === 0;

  // Calculate progress percentage
  const progressPercent = Math.min(100, (used / limit) * 100);

  return (
    <div 
      className={`mx-4 mb-4 rounded-xl p-3 ${
        isAtLimit 
          ? 'bg-red-50 border border-red-200' 
          : isNearLimit 
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-stone-50 border border-stone-200'
      }`}
      data-testid="usage-limit-banner"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isAtLimit ? (
            <AlertTriangle size={18} className="text-red-500" />
          ) : isNearLimit ? (
            <AlertTriangle size={18} className="text-amber-500" />
          ) : (
            <ChefHat size={18} className="text-stone-500" />
          )}
          
          <div>
            <p className={`text-sm font-medium ${
              isAtLimit ? 'text-red-700' : isNearLimit ? 'text-amber-700' : 'text-stone-700'
            }`}>
              {isAtLimit 
                ? `Daily ${type === 'recipes' ? 'recipe' : 'meal plan'} limit reached`
                : `${remaining} ${type === 'recipes' ? 'recipes' : 'meal plans'} remaining ${type === 'recipes' ? 'today' : 'this week'}`
              }
            </p>
            
            {isAtLimit && reset_at && (
              <p className="text-xs text-stone-500">
                Resets in {formatTimeUntilReset(reset_at)}
              </p>
            )}
          </div>
        </div>

        <Link 
          to="/pricing"
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            isAtLimit || isNearLimit
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
          data-testid="upgrade-link"
        >
          <Sparkles size={14} />
          {isAtLimit ? 'Upgrade Now' : 'Go Unlimited'}
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${
            isAtLimit 
              ? 'bg-red-500' 
              : isNearLimit 
                ? 'bg-amber-500'
                : 'bg-primary'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      <p className="text-xs text-stone-400 mt-1 text-right">
        {used} / {limit} used
      </p>
    </div>
  );
};

export default UsageLimitBanner;
