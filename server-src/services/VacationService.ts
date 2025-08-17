import { SQLiteRepository } from '../repositories/SQLiteRepository.js';
import { CalendarEvent } from '../types/Calendar.js';

/**
 * VacationService - Handles vacation business logic (MODULAR)
 *
 * Follows clean architecture principles:
 * - One responsibility: vacation hours calculation and management
 * - No data access logic (delegates to repository)
 * - Pure business rules and validation
 * - Simple, testable functions
 */
export class VacationService {
  constructor(private sqliteRepository: SQLiteRepository) {}

  /**
   * Calculate vacation hours to deduct for an event
   * Business rule: 8 hours deducted for work day vacation events
   */
  calculateVacationHours(event: CalendarEvent): number {
    if (!event.isVacation || event.calendar_name !== 'work') {
      return 0;
    }

    if (!this.isWorkDay(event.date)) {
      return 0; // No vacation hours deducted for weekends/holidays
    }

    // Standard 8-hour work day deduction
    return 8;
  }

  /**
   * Determine if a date is a work day
   * Business rule: Monday-Friday, excluding holidays
   */
  isWorkDay(dateString: string): boolean {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();

    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // TODO: Add holiday checking logic here
    // For now, assume all weekdays are work days
    return true;
  }

  /**
   * Process vacation event creation
   * Deducts vacation hours when appropriate
   */
  async processVacationEventCreation(event: CalendarEvent): Promise<void> {
    const hoursToDeduct = this.calculateVacationHours(event);

    if (hoursToDeduct === 0) {
      return; // No vacation processing needed
    }

    // Determine user based on calendar (simple logic for now)
    const userName = this.determineUserFromEvent(event);
    if (!userName) {
      return;
    }

    // Get current balance and deduct hours
    const currentBalance =
      await this.sqliteRepository.getVacationBalance(userName);
    const newBalance = Math.max(0, currentBalance - hoursToDeduct);

    await this.sqliteRepository.updateVacationBalance(userName, newBalance);
  }

  /**
   * Process vacation event deletion
   * Restores vacation hours when appropriate
   */
  async processVacationEventDeletion(event: CalendarEvent): Promise<void> {
    const hoursToRestore = this.calculateVacationHours(event);

    if (hoursToRestore === 0) {
      return; // No vacation processing needed
    }

    const userName = this.determineUserFromEvent(event);
    if (!userName) {
      return;
    }

    // Get current balance and restore hours
    const currentBalance =
      await this.sqliteRepository.getVacationBalance(userName);
    const newBalance = currentBalance + hoursToRestore;

    await this.sqliteRepository.updateVacationBalance(userName, newBalance);
  }

  /**
   * Get vacation balances for all users
   */
  async getVacationBalances(): Promise<
    Array<{ user_name: string; balance_hours: number; last_updated: string }>
  > {
    return await this.sqliteRepository.getVacationBalances();
  }

  /**
   * Determine user from event context
   * Simple business rule: assume work calendar events are for james
   * TODO: Enhance with more sophisticated user detection logic
   */
  private determineUserFromEvent(event: CalendarEvent): string | null {
    // For now, default to 'james' for work calendar vacation events
    // This can be enhanced later with user assignment logic
    if (event.calendar_name === 'work') {
      return 'james';
    }

    // Could add logic to determine user from event title, description, etc.
    return null;
  }

  /**
   * Validate vacation event
   * Business rules for vacation event validation
   */
  validateVacationEvent(event: CalendarEvent): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (event.isVacation && event.calendar_name !== 'work') {
      errors.push('Vacation events can only be created in the work calendar');
    }

    if (event.isVacation && !event.date) {
      errors.push('Vacation events must have a valid date');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
