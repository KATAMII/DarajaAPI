import React, { useEffect, useState } from 'react';
import axios from 'axios';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      const res = await axios.get('http://localhost:5000/transactions');
      setTransactions(res.data);
    };
    fetchTransactions();
  }, []);

  // Determine the status color based on result code
  const getStatusColor = (code) => {
    if (code === 0) return 'green';  // Success
    if (code === 1032) return 'orange'; // Cancelled by user
    return 'red';  // Other errors
  };

  return (
    <div>
      <h2>Transaction Status Dashboard</h2>
      <table>
        <thead>
          <tr>
            <th>Phone</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Receipt</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.id}>
              <td>{tx.phone || 'N/A'}</td>
              <td>{tx.amount || 'N/A'}</td>
              <td style={{ color: getStatusColor(tx.resultCode) }}>{tx.resultDesc}</td>
              <td>{tx.receiptNumber || '---'}</td>
              <td>{new Date(tx.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TransactionList;
