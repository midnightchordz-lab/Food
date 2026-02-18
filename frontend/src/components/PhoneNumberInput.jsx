import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Phone Number Input Component
 * For SMS notifications (Family Plan only)
 */
const PhoneNumberInput = ({ value, onChange, required = false, className = '' }) => {
  const [phone, setPhone] = useState(value || '');

  const handleChange = (e) => {
    let input = e.target.value;
    
    // Remove non-digits except +
    input = input.replace(/[^\d+]/g, '');
    
    // Ensure + is only at the start
    if (input.includes('+')) {
      input = '+' + input.replace(/\+/g, '');
    }
    
    setPhone(input);
    if (onChange) onChange(input);
  };

  const isValid = !phone || phone.startsWith('+');

  return (
    <div className={`phone-input-group space-y-2 ${className}`}>
      <Label htmlFor="phone-number">
        Phone Number {!required && <span className="text-muted-foreground">(Optional)</span>}
      </Label>
      <p className="text-sm text-muted-foreground">
        Get SMS notifications (Family Plan only)
      </p>
      <Input
        id="phone-number"
        type="tel"
        value={phone}
        onChange={handleChange}
        placeholder="+1 234 567 8900"
        className={`rounded-xl ${!isValid ? 'border-orange-500' : ''}`}
        data-testid="phone-number-input"
      />
      {phone && !isValid && (
        <p className="text-sm text-orange-500">
          Please include country code (e.g., +1 for US, +91 for India)
        </p>
      )}
    </div>
  );
};

export default PhoneNumberInput;
