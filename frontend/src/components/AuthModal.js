import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Phone, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DIETARY_OPTIONS = [
  'Non-Vegetarian',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Halal',
  'Kosher',
  'Low-Carb',
  'Keto',
  'Paleo'
];

const CUISINE_OPTIONS = [
  { name: 'Indian', flag: '🇮🇳' },
  { name: 'Chinese', flag: '🇨🇳' },
  { name: 'Italian', flag: '🇮🇹' },
  { name: 'Mexican', flag: '🇲🇽' },
  { name: 'Japanese', flag: '🇯🇵' },
  { name: 'Thai', flag: '🇹🇭' },
  { name: 'Mediterranean', flag: '🌊' },
  { name: 'American', flag: '🇺🇸' },
  { name: 'French', flag: '🇫🇷' },
  { name: 'Korean', flag: '🇰🇷' },
  { name: 'Middle Eastern', flag: '🌍' },
];

const AuthModal = ({ open, onClose }) => {
  // Auth method: 'email' or 'phone'
  const [authMethod, setAuthMethod] = useState('email');
  
  // Email auth state
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState([]);
  const [cuisinePreferences, setCuisinePreferences] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Phone auth state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [isNewPhoneUser, setIsNewPhoneUser] = useState(false);
  
  const { register, login, loginWithToken } = useAuth();

  // Email authentication
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let success;
    if (isLogin) {
      success = await login(email, password);
    } else {
      success = await register(email, password, name, dietaryRestrictions, cuisinePreferences);
    }

    setLoading(false);
    if (success) {
      onClose();
      resetForm();
    }
  };

  // Phone authentication - Send OTP
  const handleSendOTP = async () => {
    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
    
    if (phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/phone/send-otp`, {
        phone_number: fullPhone
      });
      
      setOtpSent(true);
      toast.success('Verification code sent!');
      
      // In demo mode, show the OTP
      if (response.data.demo_otp) {
        toast.info(`Demo OTP: ${response.data.demo_otp}`, { duration: 10000 });
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toast.error(error.response?.data?.detail || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Phone authentication - Verify OTP
  const handleVerifyOTP = async () => {
    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
    
    if (otpCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/phone/verify-otp`, {
        phone_number: fullPhone,
        code: otpCode
      });
      
      setOtpVerified(true);
      setIsNewPhoneUser(response.data.is_new_user);
      
      if (response.data.is_new_user) {
        // New user - show profile setup
        toast.success('Phone verified! Please complete your profile.');
      } else {
        // Existing user - login directly
        await loginWithToken(response.data.access_token, response.data.user);
        toast.success('Welcome back!');
        onClose();
        resetForm();
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  // Complete phone registration (for new users)
  const handleCompletePhoneRegistration = async () => {
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    // For now, just use the token we already have and update profile
    // In a real app, you'd call an update profile endpoint
    toast.success(`Welcome to MoodFood, ${name}!`);
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setDietaryRestrictions([]);
    setCuisinePreferences([]);
    setPhoneNumber('');
    setOtpCode('');
    setOtpSent(false);
    setOtpVerified(false);
    setIsNewPhoneUser(false);
  };

  const toggleDietary = (option) => {
    setDietaryRestrictions(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const toggleCuisine = (cuisine) => {
    setCuisinePreferences(prev =>
      prev.includes(cuisine)
        ? prev.filter(item => item !== cuisine)
        : [...prev, cuisine]
    );
  };

  // Phone number formatting
  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="auth-modal">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
          <DialogTitle className="text-3xl font-serif">
            Welcome to MoodFood
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Meals that match your mood</p>
        </DialogHeader>

        {/* Auth Method Selector */}
        <div className="flex gap-2 p-1 bg-secondary/50 rounded-xl mb-4">
          <Button
            type="button"
            variant={authMethod === 'email' ? 'default' : 'ghost'}
            className={`flex-1 rounded-lg ${authMethod === 'email' ? '' : 'hover:bg-secondary'}`}
            onClick={() => setAuthMethod('email')}
            data-testid="email-tab"
          >
            <Mail size={16} className="mr-2" />
            Email
          </Button>
          <Button
            type="button"
            variant={authMethod === 'phone' ? 'default' : 'ghost'}
            className={`flex-1 rounded-lg ${authMethod === 'phone' ? '' : 'hover:bg-secondary'}`}
            onClick={() => setAuthMethod('phone')}
            data-testid="phone-tab"
          >
            <Phone size={16} className="mr-2" />
            Phone
          </Button>
        </div>

        {/* Email Authentication */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Tabs value={isLogin ? 'login' : 'register'} onValueChange={(v) => setIsLogin(v === 'login')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>
            </Tabs>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-xl"
                  placeholder="What should we call you?"
                  data-testid="name-input"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
                placeholder="you@example.com"
                data-testid="email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl"
                placeholder="••••••••"
                data-testid="password-input"
              />
            </div>

            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label>Dietary Preferences</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_OPTIONS.slice(0, 6).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleDietary(option)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          dietaryRestrictions.includes(option)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary hover:bg-secondary/80'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Favorite Cuisines</Label>
                  <div className="flex flex-wrap gap-2">
                    {CUISINE_OPTIONS.map((cuisine) => (
                      <button
                        key={cuisine.name}
                        type="button"
                        onClick={() => toggleCuisine(cuisine.name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                          cuisinePreferences.includes(cuisine.name)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary hover:bg-secondary/80'
                        }`}
                      >
                        <span>{cuisine.flag}</span>
                        {cuisine.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full rounded-xl py-6"
              disabled={loading}
              data-testid="submit-button"
            >
              {loading ? (
                <Loader2 className="animate-spin mr-2" size={18} />
              ) : null}
              {isLogin ? 'Log In' : 'Create Account'}
            </Button>
          </form>
        )}

        {/* Phone Authentication */}
        {authMethod === 'phone' && (
          <div className="space-y-4">
            {!otpSent ? (
              // Step 1: Enter phone number
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="px-3 py-2 rounded-xl border bg-background text-sm w-24"
                      data-testid="country-code-select"
                    >
                      <option value="+1">+1 🇺🇸</option>
                      <option value="+44">+44 🇬🇧</option>
                      <option value="+91">+91 🇮🇳</option>
                      <option value="+86">+86 🇨🇳</option>
                      <option value="+81">+81 🇯🇵</option>
                      <option value="+49">+49 🇩🇪</option>
                      <option value="+33">+33 🇫🇷</option>
                      <option value="+61">+61 🇦🇺</option>
                      <option value="+55">+55 🇧🇷</option>
                      <option value="+52">+52 🇲🇽</option>
                    </select>
                    <Input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                      placeholder="555-123-4567"
                      className="flex-1 rounded-xl"
                      data-testid="phone-input"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We'll send you a verification code via SMS
                  </p>
                </div>
                
                <Button
                  type="button"
                  onClick={handleSendOTP}
                  className="w-full rounded-xl py-6"
                  disabled={loading || phoneNumber.length < 10}
                  data-testid="send-otp-button"
                >
                  {loading ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : (
                    <Phone className="mr-2" size={18} />
                  )}
                  Send Verification Code
                </Button>
              </div>
            ) : !otpVerified ? (
              // Step 2: Enter OTP
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Phone className="text-primary" size={32} />
                  </div>
                  <h3 className="font-semibold">Enter Verification Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Sent to {countryCode} {phoneNumber}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-[0.5em] rounded-xl py-6 font-mono"
                    maxLength={6}
                    data-testid="otp-input"
                  />
                </div>
                
                <Button
                  type="button"
                  onClick={handleVerifyOTP}
                  className="w-full rounded-xl py-6"
                  disabled={loading || otpCode.length !== 6}
                  data-testid="verify-otp-button"
                >
                  {loading ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : (
                    <ArrowRight className="mr-2" size={18} />
                  )}
                  Verify Code
                </Button>
                
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="w-full text-sm text-muted-foreground hover:text-primary"
                >
                  ← Use different phone number
                </button>
              </div>
            ) : isNewPhoneUser ? (
              // Step 3: New user profile setup
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="text-green-600" size={32} />
                  </div>
                  <h3 className="font-semibold">Phone Verified!</h3>
                  <p className="text-sm text-muted-foreground">
                    Let's set up your profile
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone-name">What should we call you?</Label>
                  <Input
                    id="phone-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="rounded-xl"
                    data-testid="phone-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Dietary Preference</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Vegetarian', 'Vegan', 'Non-Vegetarian', 'Pescatarian'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setDietaryRestrictions([option])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          dietaryRestrictions.includes(option)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary hover:bg-secondary/80'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Favorite Cuisines (select multiple)</Label>
                  <div className="flex flex-wrap gap-2">
                    {CUISINE_OPTIONS.slice(0, 8).map((cuisine) => (
                      <button
                        key={cuisine.name}
                        type="button"
                        onClick={() => toggleCuisine(cuisine.name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                          cuisinePreferences.includes(cuisine.name)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary hover:bg-secondary/80'
                        }`}
                      >
                        <span>{cuisine.flag}</span>
                        {cuisine.name}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleCompletePhoneRegistration}
                  className="w-full rounded-xl py-6"
                  disabled={loading}
                  data-testid="complete-phone-registration"
                >
                  {loading ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : (
                    <CheckCircle className="mr-2" size={18} />
                  )}
                  Complete Setup
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
