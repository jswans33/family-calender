import React, { useState, useEffect } from 'react';

interface VacationBalance {
  user_name: string;
  balance_hours: number;
  last_updated: string;
}

interface VacationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VacationSettings: React.FC<VacationSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [formData, setFormData] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const ACCRUAL_RATE = 4.62; // hours per pay period (every 2 weeks)
  const NEXT_PAYDAY = new Date('2025-08-29');

  useEffect(() => {
    if (isOpen) {
      fetchBalances();
    }
  }, [isOpen]);

  const fetchBalances = async () => {
    try {
      const response = await fetch('http://localhost:3001/vacation-balances');
      const data = await response.json();
      setBalances(data);

      // Initialize form data with current values
      const initialData: { [key: string]: string } = {};
      data.forEach((balance: VacationBalance) => {
        initialData[balance.user_name] = balance.balance_hours.toString();
      });
      setFormData(initialData);
    } catch (err) {
      setError('Failed to fetch vacation balances');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      for (const [userName, hours] of Object.entries(formData)) {
        const response = await fetch('http://localhost:3001/vacation-balance', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userName,
            balanceHours: parseFloat(hours),
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update balance for ${userName}`);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        window.location.reload(); // Refresh to show new balances
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update balances'
      );
    } finally {
      setLoading(false);
    }
  };

  const addAccrual = (userName: string) => {
    const currentValue = parseFloat(formData[userName] || '0');
    const newValue = currentValue + ACCRUAL_RATE;
    setFormData({ ...formData, [userName]: newValue.toFixed(2) });
  };

  const calculateNextAccrual = () => {
    const today = new Date();
    const daysUntilPayday = Math.ceil(
      (NEXT_PAYDAY.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilPayday;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Vacation Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Accrual Information
          </h3>
          <div className="space-y-1 text-xs text-blue-800">
            <div>Annual: 3 weeks (120 hours)</div>
            <div>Per Pay Period: {ACCRUAL_RATE} hours (every 2 weeks)</div>
            <div>Next Payday: Aug 29 ({calculateNextAccrual()} days)</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
            Balances updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {balances.map(balance => (
            <div key={balance.user_name} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 capitalize">
                {balance.user_name}'s Balance (hours)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={formData[balance.user_name] || ''}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      [balance.user_name]: e.target.value,
                    })
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => addAccrual(balance.user_name)}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  title="Add pay period accrual"
                >
                  +{ACCRUAL_RATE}h
                </button>
              </div>
              <div className="text-xs text-gray-500">
                Current: {balance.balance_hours.toFixed(2)}h
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Updating...' : 'Update Balances'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VacationSettings;
