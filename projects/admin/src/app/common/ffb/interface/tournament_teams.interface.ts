import { TeamItem } from './team-search.interface';

/**
 * Represents teams participating in a tournament (hybrid V1/V2)
 * Combines FFB V2 team items with tournament session metadata
 */
export interface TournamentTeams {
  // Metadata from session (for backward compatibility & matching)
  subscription_tournament: {
    id: number; // groupSessionId from FFB V2
    organization_club_tournament: {
      date: string; // ISO date of tournament
      tournament_name: string;
      session_name: string;
      time: string;
    };
  };
  // Teams from FFB V2 API
  items: TeamItem[];
  pagination?: {
    total_pages: number;
    total_items: number;
    current_page: number;
  };
}
