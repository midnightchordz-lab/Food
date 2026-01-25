import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import AIMealPlanGenerator from '@/components/AIMealPlanGenerator';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const WeeklyPlannerPage = () => {
  const [plans, setPlans] = useState([]);
  const [currentWeek, setCurrentWeek] = useState('');
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    setCurrentWeek(weekStart.toISOString().split('T')[0]);
    
    if (isAuthenticated) {
      loadPlans();
    }
  }, [isAuthenticated]);
  
  const loadPlans = async () => {
    try {
      const response = await axios.get(`${API}/weekly-plan`);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };
  
  const handlePlanGenerated = (newPlan) => {
    setPlans(prev => [newPlan, ...prev]);
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="weekly-planner-page">
        <div className="max-w-6xl mx-auto text-center py-20">
          <Calendar className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-serif mb-2">Please log in to access meal planning</h3>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="weekly-planner-page">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h1 className="text-4xl sm:text-5xl font-serif mb-3" data-testid="page-title">
                Weekly Meal Planner
              </h1>
              <p className="text-muted-foreground" data-testid="page-description">
                AI-powered meal plans tailored to your mood and preferences.
              </p>
            </div>
            <Button
              onClick={() => setShowAIGenerator(true)}
              className="rounded-full bg-accent hover:bg-accent/90 active:scale-95 transition-all"
              data-testid="generate-ai-plan-button"
            >
              <Sparkles className="mr-2" size={20} />
              Generate AI Plan
            </Button>
          </div>
          
          {plans.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-border/40" data-testid="empty-state">
              <Calendar className="mx-auto mb-4 text-muted-foreground" size={48} />
              <h3 className="text-xl font-serif mb-2">No meal plans yet</h3>
              <p className="text-muted-foreground mb-6">Let AI create your first personalized weekly plan!</p>
              <Button
                onClick={() => setShowAIGenerator(true)}
                className="rounded-full bg-primary hover:bg-primary/90"
                data-testid="empty-generate-button"
              >
                <Sparkles className="mr-2" size={20} />
                Generate My First Plan
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {plans.map((plan, planIdx) => (
                <div
                  key={plan.id || planIdx}
                  className="bg-card rounded-3xl border border-border/40 p-6"
                  data-testid={`plan-${planIdx}`}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-serif">Week of {new Date(plan.week_start).toLocaleDateString()}</h3>
                    <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm">
                      AI Generated
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className="bg-secondary/30 rounded-2xl p-4"
                        data-testid={`day-card-${day}`}
                      >
                        <h4 className="font-serif text-lg mb-3 text-primary">{day}</h4>
                        <div className="space-y-2 text-sm">
                          {plan.meals[day] ? (
                            Object.entries(plan.meals[day]).map(([meal, dish]) => (
                              <div key={meal}>
                                <span className="text-muted-foreground capitalize">{meal}:</span>
                                <p className="font-medium">{dish}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted-foreground italic">No meals planned</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <AIMealPlanGenerator
        open={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
        onPlanGenerated={handlePlanGenerated}
      />
    </>
  );
};

export default WeeklyPlannerPage;
