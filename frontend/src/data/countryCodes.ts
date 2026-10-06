export type Country = { name: string; iso2: string; dial: string; flag: string };

function flagFromIso2(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const RAW: Array<[string, string, string]> = [
  // [iso2, dial, name] — most-common markets first, then alphabetical by name
  ['IN', '91', 'India'],
  ['US', '1', 'United States'],
  ['GB', '44', 'United Kingdom'],
  ['CA', '1', 'Canada'],
  ['AU', '61', 'Australia'],
  ['AE', '971', 'United Arab Emirates'],
  ['SG', '65', 'Singapore'],

  ['AR', '54', 'Argentina'],
  ['AT', '43', 'Austria'],
  ['BD', '880', 'Bangladesh'],
  ['BE', '32', 'Belgium'],
  ['BR', '55', 'Brazil'],
  ['CH', '41', 'Switzerland'],
  ['CL', '56', 'Chile'],
  ['CN', '86', 'China'],
  ['CO', '57', 'Colombia'],
  ['CZ', '420', 'Czech Republic'],
  ['DE', '49', 'Germany'],
  ['DK', '45', 'Denmark'],
  ['ES', '34', 'Spain'],
  ['FI', '358', 'Finland'],
  ['FR', '33', 'France'],
  ['GR', '30', 'Greece'],
  ['HK', '852', 'Hong Kong'],
  ['HU', '36', 'Hungary'],
  ['ID', '62', 'Indonesia'],
  ['IE', '353', 'Ireland'],
  ['IL', '972', 'Israel'],
  ['IT', '39', 'Italy'],
  ['JP', '81', 'Japan'],
  ['KR', '82', 'South Korea'],
  ['KW', '965', 'Kuwait'],
  ['LK', '94', 'Sri Lanka'],
  ['MX', '52', 'Mexico'],
  ['MY', '60', 'Malaysia'],
  ['NL', '31', 'Netherlands'],
  ['NO', '47', 'Norway'],
  ['NP', '977', 'Nepal'],
  ['NZ', '64', 'New Zealand'],
  ['OM', '968', 'Oman'],
  ['PE', '51', 'Peru'],
  ['PH', '63', 'Philippines'],
  ['PK', '92', 'Pakistan'],
  ['PL', '48', 'Poland'],
  ['PT', '351', 'Portugal'],
  ['QA', '974', 'Qatar'],
  ['RO', '40', 'Romania'],
  ['RU', '7', 'Russia'],
  ['SA', '966', 'Saudi Arabia'],
  ['SE', '46', 'Sweden'],
  ['TH', '66', 'Thailand'],
  ['TR', '90', 'Turkey'],
  ['TW', '886', 'Taiwan'],
  ['UA', '380', 'Ukraine'],
  ['VN', '84', 'Vietnam'],
  ['ZA', '27', 'South Africa'],
];

export const COUNTRIES: Country[] = RAW.map(([iso2, dial, name]) => ({
  iso2,
  dial,
  name,
  flag: flagFromIso2(iso2),
}));

export const DEFAULT_COUNTRY: Country = COUNTRIES[0]; // India

export function findByIso2(iso2?: string | null): Country | undefined {
  if (!iso2) return undefined;
  return COUNTRIES.find((c) => c.iso2 === iso2.toUpperCase());
}
