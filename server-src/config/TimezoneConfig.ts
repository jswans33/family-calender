/**
 * Timezone configuration for the calendar application
 * Follows Rule #1: One Thing Per File - Only handles timezone configuration
 */
export class TimezoneConfig {
  // Default timezone for the application
  private static readonly DEFAULT_TIMEZONE =
    process.env.DEFAULT_TIMEZONE || 'America/Denver';

  // Common timezone mappings
  private static readonly TIMEZONE_MAP: Record<string, string> = {
    'GMT-0600': 'America/Denver',
    'GMT-0700': 'America/Denver',
    'GMT-0500': 'America/Chicago',
    'GMT-0400': 'America/New_York',
    'GMT-0800': 'America/Los_Angeles',
    MST: 'America/Denver',
    MDT: 'America/Denver',
    CST: 'America/Chicago',
    CDT: 'America/Chicago',
    EST: 'America/New_York',
    EDT: 'America/New_York',
    PST: 'America/Los_Angeles',
    PDT: 'America/Los_Angeles',
  };

  /**
   * Get the default timezone for the application
   */
  static getDefaultTimezone(): string {
    return this.DEFAULT_TIMEZONE;
  }

  /**
   * Map a timezone string to an IANA timezone identifier
   */
  static mapTimezone(timezone?: string): string {
    if (!timezone) {
      return this.DEFAULT_TIMEZONE;
    }

    // Check if it's already a valid IANA timezone
    if (timezone.includes('/')) {
      return timezone;
    }

    // Check our mapping
    return this.TIMEZONE_MAP[timezone] || this.DEFAULT_TIMEZONE;
  }

  /**
   * Check if a timezone needs mapping
   */
  static needsMapping(timezone: string): boolean {
    return !timezone.includes('/') && timezone !== 'Etc/UTC';
  }
}
