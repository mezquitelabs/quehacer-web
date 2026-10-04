export type Category = 'music' | 'comedy' | 'theatre' | 'film' | 'arts' | 'sports' | 'family' | 'community' | 'other';

export interface SourceRef {
  name: string;
  url: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  start: string; // ISO 8601 with the city's local offset
  end: string | null;
  has_time: boolean;
  venue: string | null;
  category: Category;
  is_free: boolean | null; // null = unknown, never "free"
  image_url: string | null;
  url: string | null;
  source: string;
  sources: SourceRef[];
}

export interface OngoingItem {
  id: string;
  title: string;
  start: string;
  end: string | null; // null = open-ended
  venue: string | null;
  category: Category;
  url: string | null;
  image_url: string | null;
}

export interface CityFile {
  events: EventItem[];
  ongoing: OngoingItem[];
}

export interface CityMeta {
  slug: string;
  name: string;
  timezone: string;
  sources: SourceRef[];
}

export interface Meta {
  schema_version: number;
  generated_at: string;
  cities: Record<string, CityMeta>;
}

export interface City extends CityMeta, CityFile {}
