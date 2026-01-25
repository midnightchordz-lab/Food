import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LanguageSelector = ({ selectedLanguage, onLanguageChange }) => {
  const [languages, setLanguages] = useState({});

  useEffect(() => {
    loadLanguages();
  }, []);

  const loadLanguages = async () => {
    try {
      const response = await axios.get(`${API}/voice/languages`);
      setLanguages(response.data.languages || {});
    } catch (error) {
      console.error('Error loading languages:', error);
      // Fallback languages
      setLanguages({
        'english': { code: 'en', name: 'English', flag: '🇺🇸' },
        'hindi': { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
        'mandarin': { code: 'zh', name: 'Mandarin', flag: '🇨🇳' },
        'spanish': { code: 'es', name: 'Spanish', flag: '🇪🇸' },
      });
    }
  };

  return (
    <div className="flex items-center gap-2" data-testid="language-selector">
      <Globe size={18} className="text-muted-foreground" />
      <Select value={selectedLanguage} onValueChange={onLanguageChange}>
        <SelectTrigger className="w-[180px] rounded-full">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(languages).map(([key, lang]) => (
            <SelectItem key={key} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
