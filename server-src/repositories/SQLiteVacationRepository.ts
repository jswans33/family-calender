import { SQLiteBaseRepository } from './SQLiteBaseRepository.js';

interface VacationBalanceRow {
  user_name: string;
  balance_hours: number;
  last_updated: string;
}

/**
 * Repository for vacation balance operations
 * Handles vacation tracking data access
 */
export class SQLiteVacationRepository extends SQLiteBaseRepository {

  /**
   * Get vacation balances for all users
   */
  async getVacationBalances(): Promise<
    Array<{ user_name: string; balance_hours: number; last_updated: string }>
  > {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT user_name, balance_hours, last_updated FROM vacation_balances',
        (err, rows: VacationBalanceRow[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });
  }

  /**
   * Get vacation balance for a specific user
   */
  async getVacationBalance(userName: string): Promise<number> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT balance_hours FROM vacation_balances WHERE user_name = ?',
        [userName],
        (err, row: VacationBalanceRow) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? row.balance_hours : 0);
        }
      );
    });
  }

  /**
   * Update vacation balance for a specific user
   */
  async updateVacationBalance(
    userName: string,
    newBalance: number
  ): Promise<void> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE vacation_balances SET balance_hours = ?, last_updated = CURRENT_TIMESTAMP WHERE user_name = ?',
        [newBalance, userName],
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}