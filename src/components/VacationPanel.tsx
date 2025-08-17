import React, { useState, useEffect } from 'react';

interface VacationBalance {
  user_name: string;
  balance_hours: number;
  last_updated: string;
}

/**
 * VacationPanel - Modular vacation hours tracking component
 * 
 * Displays vacation balances for James and Morgan in bottom left
 * Follows component-focused architecture:
 * - Single responsibility: display vacation data
 * - No business logic (delegates to service)
 * - Clean, compact design
 * - Real-time updates
 */
export const VacationPanel: React.FC = () => {
  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVacationBalances = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/vacation-balances');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vacation balances: ${response.status}`);
      }
      
      const data = await response.json();
      setBalances(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching vacation balances:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVacationBalances();
    
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchVacationBalances, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatUserName = (userName: string): string => {
    return userName.charAt(0).toUpperCase() + userName.slice(1);
  };

  const getBalanceColor = (hours: number): string => {
    if (hours <= 8) return 'text-red-600'; // Low vacation time
    if (hours <= 16) return 'text-yellow-600'; // Medium vacation time
    return 'text-green-600'; // Good vacation time
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Vacation Hours</h3>
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Vacation Hours</h3>
        <div className="text-xs text-red-600">
          Failed to load vacation data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Vacation Hours</h3>
        <button
          onClick={fetchVacationBalances}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-2">
        {balances.length === 0 ? (
          <div className="text-xs text-gray-500">No vacation data available</div>
        ) : (
          balances.map((balance) => (
            <div key={balance.user_name} className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                {formatUserName(balance.user_name)}
              </span>
              <span className={`text-xs font-semibold ${getBalanceColor(balance.balance_hours)}`}>
                {balance.balance_hours.toFixed(1)}h
              </span>
            </div>
          ))
        )}
      </div>
      
      {balances.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            Updated: {new Date(balances[0]?.last_updated || '').toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default VacationPanel;