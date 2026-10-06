export type CountryCode = {
  code: string;   // ISO 3166-1 alpha-2, e.g. "IN"
  dial: string;   // e.g. "+91"
  name: string;   // e.g. "India"
  flag: string;   // emoji flag
};

// Top countries sorted by mobile-internet user volume, then alphabetical tail.
export const COUNTRY_CODES: CountryCode[] = [
  { code: 'IN', dial: '+91',  name: 'India',                flag: '🇮🇳' },
  { code: 'US', dial: '+1',   name: 'United States',        flag: '🇺🇸' },
  { code: 'BR', dial: '+55',  name: 'Brazil',               flag: '🇧🇷' },
  { code: 'ID', dial: '+62',  name: 'Indonesia',            flag: '🇮🇩' },
  { code: 'PK', dial: '+92',  name: 'Pakistan',             flag: '🇵🇰' },
  { code: 'CN', dial: '+86',  name: 'China',                flag: '🇨🇳' },
  { code: 'BD', dial: '+880', name: 'Bangladesh',           flag: '🇧🇩' },
  { code: 'NG', dial: '+234', name: 'Nigeria',              flag: '🇳🇬' },
  { code: 'MX', dial: '+52',  name: 'Mexico',               flag: '🇲🇽' },
  { code: 'PH', dial: '+63',  name: 'Philippines',          flag: '🇵🇭' },
  { code: 'GB', dial: '+44',  name: 'United Kingdom',       flag: '🇬🇧' },
  { code: 'TH', dial: '+66',  name: 'Thailand',             flag: '🇹🇭' },
  { code: 'VN', dial: '+84',  name: 'Vietnam',              flag: '🇻🇳' },
  { code: 'TR', dial: '+90',  name: 'Turkey',               flag: '🇹🇷' },
  { code: 'DE', dial: '+49',  name: 'Germany',              flag: '🇩🇪' },
  { code: 'FR', dial: '+33',  name: 'France',               flag: '🇫🇷' },
  { code: 'IT', dial: '+39',  name: 'Italy',                flag: '🇮🇹' },
  { code: 'ES', dial: '+34',  name: 'Spain',                flag: '🇪🇸' },
  { code: 'CA', dial: '+1',   name: 'Canada',               flag: '🇨🇦' },
  { code: 'AU', dial: '+61',  name: 'Australia',            flag: '🇦🇺' },
  { code: 'AR', dial: '+54',  name: 'Argentina',            flag: '🇦🇷' },
  { code: 'CO', dial: '+57',  name: 'Colombia',             flag: '🇨🇴' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia',         flag: '🇸🇦' },
  { code: 'AE', dial: '+971', name: 'UAE',                  flag: '🇦🇪' },
  { code: 'EG', dial: '+20',  name: 'Egypt',                flag: '🇪🇬' },
  { code: 'KR', dial: '+82',  name: 'South Korea',         flag: '🇰🇷' },
  { code: 'JP', dial: '+81',  name: 'Japan',                flag: '🇯🇵' },
  { code: 'RU', dial: '+7',   name: 'Russia',               flag: '🇷🇺' },
  { code: 'ZA', dial: '+27',  name: 'South Africa',         flag: '🇿🇦' },
  { code: 'MY', dial: '+60',  name: 'Malaysia',             flag: '🇲🇾' },
  { code: 'SG', dial: '+65',  name: 'Singapore',            flag: '🇸🇬' },
  { code: 'NL', dial: '+31',  name: 'Netherlands',          flag: '🇳🇱' },
  { code: 'SE', dial: '+46',  name: 'Sweden',               flag: '🇸🇪' },
  { code: 'NO', dial: '+47',  name: 'Norway',               flag: '🇳🇴' },
  { code: 'CH', dial: '+41',  name: 'Switzerland',          flag: '🇨🇭' },
  { code: 'NZ', dial: '+64',  name: 'New Zealand',          flag: '🇳🇿' },
  { code: 'NG', dial: '+234', name: 'Nigeria',              flag: '🇳🇬' },
  { code: 'KE', dial: '+254', name: 'Kenya',                flag: '🇰🇪' },
  { code: 'GH', dial: '+233', name: 'Ghana',                flag: '🇬🇭' },
  { code: 'PL', dial: '+48',  name: 'Poland',               flag: '🇵🇱' },
  { code: 'UA', dial: '+380', name: 'Ukraine',              flag: '🇺🇦' },
  { code: 'IR', dial: '+98',  name: 'Iran',                 flag: '🇮🇷' },
  { code: 'IQ', dial: '+964', name: 'Iraq',                 flag: '🇮🇶' },
  { code: 'LK', dial: '+94',  name: 'Sri Lanka',            flag: '🇱🇰' },
  { code: 'NP', dial: '+977', name: 'Nepal',                flag: '🇳🇵' },
  { code: 'MM', dial: '+95',  name: 'Myanmar',              flag: '🇲🇲' },
  { code: 'DZ', dial: '+213', name: 'Algeria',              flag: '🇩🇿' },
  { code: 'MA', dial: '+212', name: 'Morocco',              flag: '🇲🇦' },
  { code: 'TN', dial: '+216', name: 'Tunisia',              flag: '🇹🇳' },
  { code: 'PT', dial: '+351', name: 'Portugal',             flag: '🇵🇹' },
  { code: 'BE', dial: '+32',  name: 'Belgium',              flag: '🇧🇪' },
  { code: 'AT', dial: '+43',  name: 'Austria',              flag: '🇦🇹' },
  { code: 'CL', dial: '+56',  name: 'Chile',                flag: '🇨🇱' },
  { code: 'PE', dial: '+51',  name: 'Peru',                 flag: '🇵🇪' },
  { code: 'HK', dial: '+852', name: 'Hong Kong',            flag: '🇭🇰' },
  { code: 'TW', dial: '+886', name: 'Taiwan',               flag: '🇹🇼' },
  { code: 'IL', dial: '+972', name: 'Israel',               flag: '🇮🇱' },
  { code: 'JO', dial: '+962', name: 'Jordan',               flag: '🇯🇴' },
  { code: 'KW', dial: '+965', name: 'Kuwait',               flag: '🇰🇼' },
  { code: 'QA', dial: '+974', name: 'Qatar',                flag: '🇶🇦' },
  { code: 'OM', dial: '+968', name: 'Oman',                 flag: '🇴🇲' },
  { code: 'ET', dial: '+251', name: 'Ethiopia',             flag: '🇪🇹' },
  { code: 'TZ', dial: '+255', name: 'Tanzania',             flag: '🇹🇿' },
  { code: 'UG', dial: '+256', name: 'Uganda',               flag: '🇺🇬' },
];

// Remove duplicate codes (keep first occurrence)
const seen = new Set<string>();
export const COUNTRY_CODES_DEDUPED = COUNTRY_CODES.filter((c) => {
  const key = c.code + c.dial;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

export function getCountryByRegion(regionCode: string | null | undefined): CountryCode {
  const found = COUNTRY_CODES_DEDUPED.find((c) => c.code === regionCode?.toUpperCase());
  return found ?? COUNTRY_CODES_DEDUPED[0]; // default India
}
