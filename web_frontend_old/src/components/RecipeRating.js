import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RecipeRating = ({ recipeId, existingRating = null }) => {
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(existingRating?.review || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/recipes/${recipeId}/rate`, {
        rating,
        review: review.trim() || null
      });
      toast.success('Rating submitted successfully!');
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="recipe-rating">
      <div>
        <p className="text-sm font-medium mb-2">Your Rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-110"
              data-testid={`star-${star}`}
            >
              <Star
                size={28}
                className={`${
                  star <= (hover || rating)
                    ? 'fill-accent text-accent'
                    : 'text-muted-foreground'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Review (Optional)</p>
        <Textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your thoughts about this recipe..."
          className="rounded-xl"
          data-testid="review-input"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="rounded-full bg-primary hover:bg-primary/90"
        data-testid="submit-rating-button"
      >
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </Button>
    </div>
  );
};

export default RecipeRating;