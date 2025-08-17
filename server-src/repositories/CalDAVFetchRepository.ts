import https from 'https';
import { Buffer } from 'buffer';
import { CalDAVCredentials } from '../types/Calendar.js';

export class CalDAVFetchRepository {
  private credentials: CalDAVCredentials;
  private readonly basePath: string;

  constructor(credentials: CalDAVCredentials, basePath: string) {
    this.credentials = credentials;
    this.basePath = basePath;
  }

  async fetchCalendarData(
    calendar_path: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      const timeRangeFilter = this.buildTimeRangeFilter(startDate, endDate);
      const postData = this.buildCalendarQueryXML(timeRangeFilter);

      const options: https.RequestOptions = {
        hostname: this.credentials.hostname,
        port: 443,
        path: `${this.basePath}${calendar_path}`,
        method: 'REPORT',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(postData),
          Depth: '1',
          Authorization: `Basic ${auth}`,
        },
      };

      const req = https.request(options, response => {
        let data = '';
        response.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        response.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (error: Error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async putEventData(
    eventData: string,
    eventPath: string
  ): Promise<{ success: boolean; statusCode?: number }> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      const options = {
        hostname: this.credentials.hostname,
        port: 443,
        path: eventPath,
        method: 'PUT',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Length': Buffer.byteLength(eventData),
          'User-Agent': 'Swanson-Light-Calendar/1.0',
        },
      };

      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          const success = res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204;
          if (res.statusCode !== undefined) {
            resolve({ success, statusCode: res.statusCode });
          } else {
            resolve({ success });
          }
        });
      });

      req.on('error', error => {
        reject(error);
      });

      req.write(eventData);
      req.end();
    });
  }

  async deleteEventData(eventPath: string): Promise<{ success: boolean; statusCode?: number }> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      const options = {
        hostname: this.credentials.hostname,
        port: 443,
        path: eventPath,
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${auth}`,
          'User-Agent': 'Swanson-Light-Calendar/1.0',
        },
      };

      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          const success = res.statusCode === 200 || res.statusCode === 204 || res.statusCode === 404;
          if (res.statusCode !== undefined) {
            resolve({ success, statusCode: res.statusCode });
          } else {
            resolve({ success });
          }
        });
      });

      req.on('error', error => {
        reject(error);
      });

      req.end();
    });
  }

  private buildTimeRangeFilter(startDate?: Date, endDate?: Date): string {
    if (!startDate && !endDate) return '';
    const start = startDate ? this.formatCalDAVDate(startDate) : '';
    const end = endDate ? this.formatCalDAVDate(endDate) : '';
    return `<C:time-range start="${start}" end="${end}" />`;
  }

  private buildCalendarQueryXML(timeRangeFilter: string): string {
    return `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">${timeRangeFilter}</C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;
  }

  private formatCalDAVDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
}