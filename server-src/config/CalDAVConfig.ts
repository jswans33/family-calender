import { CalDAVCredentials } from '../types/Calendar.js';

export class CalDAVConfig {
  static getCredentials(): CalDAVCredentials {
    const username = process.env.CALDAV_USERNAME;
    const password = process.env.CALDAV_PASSWORD;
    const hostname = process.env.CALDAV_HOSTNAME || 'p36-caldav.icloud.com';
    const path = process.env.CALDAV_PATH || '/1110188709/calendars/home/';

    if (!username || !password) {
      throw new Error(
        'CalDAV credentials not configured. Please set CALDAV_USERNAME and CALDAV_PASSWORD environment variables.'
      );
    }

    return {
      username,
      password,
      hostname,
      path,
    };
  }

  static getFallbackCredentials(): CalDAVCredentials {
    return {
      username: 'jswans33@gmail.com',
      password: 'qrdq-tahw-xski-ogbf',
      hostname: 'p36-caldav.icloud.com',
      path: '/1110188709/calendars/home/',
    };
  }
}
