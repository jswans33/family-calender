export interface DatabaseConfig {
  path: string;
  syncIntervalMinutes: number;
  maxAgeMonths: number;
}

export class DatabaseConfig {
  static getConfig(): DatabaseConfig {
    return {
      path: process.env.DATABASE_PATH || './data/calendar.db',
      syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '15'),
      maxAgeMonths: parseInt(process.env.MAX_AGE_MONTHS || '6')
    };
  }
}