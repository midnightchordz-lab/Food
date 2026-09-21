import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, Filter } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';

const MOOD_TAGS = ['comfort', 'energizing', 'calming', 'celebratory', 'healing', 'creative'];
const DIETARY_TAGS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free'];
const COMPLEXITY_OPTIONS = ['quick', 'standard', 'involved'];

const RecipeSearchFilter = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [moodTags, setMoodTags] = useState([]);
  const [dietaryTags, setDietaryTags] = useState([]);
  const [complexity, setComplexity] = useState('');

  const toggleMoodTag = (tag) => {
    setMoodTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleDietaryTag = (tag) => {
    setDietaryTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSearch = () => {
    onSearch({
      query: query.trim() || null,
      mood_tags: moodTags.length > 0 ? moodTags : null,
      dietary_tags: dietaryTags.length > 0 ? dietaryTags : null,
      complexity: complexity || null
    });
  };

  const clearFilters = () => {
    setQuery('');
    setMoodTags([]);
    setDietaryTags([]);
    setComplexity('');
    onSearch({ query: null, mood_tags: null, dietary_tags: null, complexity: null });
  };

  return (
    <div className="flex gap-3 items-end" data-testid="recipe-search-filter">
      <div className="flex-1">
        <Label htmlFor="search">Search Recipes</Label>
        <Input
          id="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name or description..."
          className="rounded-xl mt-1"
          data-testid="search-input"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="rounded-full" data-testid="filter-button">
            <Filter size={18} className="mr-2" />
            Filters
            {(moodTags.length + dietaryTags.length + (complexity ? 1 : 0)) > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                {moodTags.length + dietaryTags.length + (complexity ? 1 : 0)}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Mood Tags</Label>
              <div className="flex flex-wrap gap-2">
                {MOOD_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleMoodTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                      moodTags.includes(tag)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                    data-testid={`mood-filter-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Dietary Filters</Label>
              <div className="space-y-2">
                {DIETARY_TAGS.map(tag => (
                  <div key={tag} className="flex items-center gap-2">
                    <Checkbox
                      id={`dietary-${tag}`}
                      checked={dietaryTags.includes(tag)}
                      onCheckedChange={() => toggleDietaryTag(tag)}
                      data-testid={`dietary-filter-${tag}`}
                    />
                    <Label htmlFor={`dietary-${tag}`} className="text-sm cursor-pointer">
                      {tag}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Complexity</Label>
              <div className="flex gap-2">
                {COMPLEXITY_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setComplexity(option === complexity ? '' : option)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm transition-all ${
                      complexity === option
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                    data-testid={`complexity-${option}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={clearFilters}
              variant="outline"
              className="w-full rounded-full"
              data-testid="clear-filters-button"
            >
              Clear All Filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button onClick={handleSearch} className="rounded-full" data-testid="search-button">
        <Search size={18} />
      </Button>
    </div>
  );
};

export default RecipeSearchFilter;