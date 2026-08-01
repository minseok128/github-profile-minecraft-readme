export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface CalendarDay {
    contributionCount: number;
    contributionLevel: ContributionLevel;
    date: string;
}

export interface ContributionProfile {
    username: string;
    calendar: Array<CalendarDay>;
    totalContributions: number;
}

export type ProfilePeriod =
    | {
          mode: 'trailing';
          days: number;
      }
    | {
          mode: 'year';
          year: number;
      };

export interface ContributionWindow {
    from: string;
    to: string;
}
