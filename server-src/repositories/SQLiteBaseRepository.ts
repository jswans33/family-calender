import sqlite3 from 'sqlite3';

/**
 * Base repository for shared SQLite database functionality
 * Handles database connection and initialization
 */
export abstract class SQLiteBaseRepository {
  protected db!: sqlite3.Database;
  private initPromise: Promise<void>;

  constructor(dbPath: string = './calendar.db') {
    this.initPromise = new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, err => {
        if (err) {
          console.error('Failed to connect to SQLite database:', err);
          reject(err);
          return;
        }
        this.initializeDatabase().then(resolve).catch(reject);
      });
    });
  }

  private initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const createEventsTableSQL = `
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        description TEXT,
        location TEXT,
        organizer TEXT,
        attendees TEXT,
        categories TEXT,
        priority INTEGER,
        status TEXT,
        visibility TEXT,
        dtend TEXT,
        duration TEXT,
        rrule TEXT,
        created TEXT,
        last_modified TEXT,
        sequence INTEGER,
        url TEXT,
        geo_lat REAL,
        geo_lon REAL,
        transparency TEXT,
        attachments TEXT,
        timezone TEXT,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        caldav_etag TEXT,
        caldav_filename TEXT,
        calendar_path TEXT,
        calendar_name TEXT,
        sync_status TEXT DEFAULT 'synced',
        local_modified DATETIME,
        is_vacation BOOLEAN DEFAULT 0
      )
    `;

      const createDeletedTableSQL = `
      CREATE TABLE IF NOT EXISTS deleted_events (
        id TEXT PRIMARY KEY,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_to_caldav BOOLEAN DEFAULT 0
      )
    `;

      const createVacationBalancesTableSQL = `
      CREATE TABLE IF NOT EXISTS vacation_balances (
        user_name TEXT PRIMARY KEY,
        balance_hours REAL NOT NULL DEFAULT 40.0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

      this.executeTableCreation([
        createEventsTableSQL,
        createDeletedTableSQL,
        createVacationBalancesTableSQL
      ], resolve, reject);
    });
  }

  private executeTableCreation(
    sqlStatements: string[],
    resolve: () => void,
    reject: (error: Error) => void
  ): void {
    let completedTasks = 0;
    const totalTasks = sqlStatements.length;

    const checkCompletion = () => {
      completedTasks++;
      if (completedTasks === totalTasks) {
        this.createIndexes();
        this.initializeDefaultData();
        resolve();
      }
    };

    sqlStatements.forEach(sql => {
      this.db.run(sql, err => {
        if (err) {
          console.error('Failed to create table:', err);
          reject(err);
          return;
        }
        checkCompletion();
      });
    });
  }

  private createIndexes(): void {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)`,
      `CREATE INDEX IF NOT EXISTS idx_events_sync ON events(synced_at)`
    ];

    indexes.forEach(indexSQL => {
      this.db.run(indexSQL, err => {
        if (err) console.error('Failed to create index:', err);
      });
    });
  }

  private initializeDefaultData(): void {
    const defaultUsers = [
      ['james', 40.0],
      ['morgan', 40.0]
    ];

    defaultUsers.forEach(([userName, balance]) => {
      this.db.run(
        `INSERT OR IGNORE INTO vacation_balances (user_name, balance_hours) VALUES (?, ?)`,
        [userName, balance],
        err => {
          if (err) {
            console.error(`Failed to initialize ${userName} vacation balance:`, err);
          }
        }
      );
    });
  }

  /**
   * Wait for database initialization to complete
   */
  async ready(): Promise<void> {
    return this.initPromise;
  }

  close(): void {
    this.db.close(err => {
      if (err) {
        console.error('Error closing SQLite database:', err);
      }
    });
  }
}