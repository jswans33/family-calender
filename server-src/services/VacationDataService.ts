import { SQLiteCompositeRepository } from '../repositories/SQLiteCompositeRepository.js';

/**
 * VacationDataService - Handles vacation data access
 * Acts as the service layer between VacationService and SQLiteCompositeRepository
 * Follows Rule #3: Simple Data Flow (Service → Service → Repository)
 */
export class VacationDataService {
  constructor(private sqliteRepository: SQLiteCompositeRepository) {}

  async getVacationBalance(userName: string): Promise<number> {
    try {
      return await this.sqliteRepository.getVacationBalance(userName);
    } catch (error) {
      console.error(`Error getting vacation balance for ${userName}:`, error);
      return 0; // Default to 0 if error
    }
  }

  async updateVacationBalance(
    userName: string,
    balance: number
  ): Promise<void> {
    try {
      await this.sqliteRepository.updateVacationBalance(userName, balance);
    } catch (error) {
      console.error(`Error updating vacation balance for ${userName}:`, error);
      throw error;
    }
  }

  async getVacationBalances(): Promise<
    Array<{ user_name: string; balance_hours: number; last_updated: string }>
  > {
    try {
      return await this.sqliteRepository.getVacationBalances();
    } catch (error) {
      console.error('Error getting vacation balances:', error);
      return [];
    }
  }
}
