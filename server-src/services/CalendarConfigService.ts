interface CalendarInfo {
  name: string;
  path: string;
  displayName: string;
  count: number;
}

export class CalendarConfigService {
  private readonly calendars: CalendarInfo[] = [
    {
      name: 'shared',
      path: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
      displayName: 'Shared',
      count: 0,
    },
    {
      name: 'home',
      path: '/home/',
      displayName: 'Home',
      count: 0,
    },
    {
      name: 'work',
      path: '/work/',
      displayName: 'Work',
      count: 0,
    },
    {
      name: 'meals',
      path: '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/',
      displayName: 'Meals',
      count: 0,
    },
  ];

  getCalendars(): CalendarInfo[] {
    return this.calendars.map(cal => ({ ...cal }));
  }

  getCalendarByName(name: string): CalendarInfo | undefined {
    return this.calendars.find(cal => cal.name === name);
  }

  getBasePath(): string {
    return '/1110188709/calendars';
  }
}