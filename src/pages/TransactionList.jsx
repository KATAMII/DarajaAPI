import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TransactionList.css';

// Use relative URLs since frontend and backend are served from the same domain
const API_URL = '';

const TransactionList = () => {
  const [transactions, setTransactions] = useState([]);
  const [successTransactions, setSuccessTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'success' or 'failed'
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    fetchTransactions();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/transactions`);
      setTransactions(response.data.transactions);
      setSuccessTransactions(response.data.successTransactions);
      
      // Filter successful and failed transactions
      const successfulTxns = response.data.transactions.filter(tx => tx.paymentStatus === 'Success');
      const failedTxns = response.data.transactions.filter(tx => tx.paymentStatus === 'Failed');
      
      if (successfulTxns.length > 0) {
        console.log("Successful transactions found:", successfulTxns);
      }
      
      if (failedTxns.length > 0) {
        console.log("Failed transactions found:", failedTxns);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const checkTransactionStatus = async (transactionId) => {
    try {
      setCheckingStatus(true);
      setStatusMessage(`Checking status of transaction ${transactionId}...`);
      
      const response = await axios.post(`${API_URL}/check-transaction-status/${transactionId}`);
      
      if (response.data.success) {
        setStatusMessage(`✅ Transaction is successful: ${response.data.message}`);
      } else {
        setStatusMessage(`ℹ️ ${response.data.message}`);
      }
      
      // Refresh transactions after status check
      fetchTransactions();
    } catch (error) {
      console.error('Error checking transaction status:', error);
      setStatusMessage(`❌ Failed to check status: ${error.response?.data?.error || error.message}`);
    } finally {
      setTimeout(() => {
        setCheckingStatus(false);
        // Clear message after 5 seconds
        setTimeout(() => setStatusMessage(''), 5000);
      }, 1000);
    }
  };

  const checkAllPendingTransactions = async () => {
    const pendingTransactions = transactions.filter(tx => tx.paymentStatus === 'Pending');
    
    if (pendingTransactions.length === 0) {
      setStatusMessage('No pending transactions to check');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }
    
    setCheckingStatus(true);
    setStatusMessage(`Checking status of ${pendingTransactions.length} pending transactions...`);
    
    for (const tx of pendingTransactions) {
      try {
        await axios.post(`${API_URL}/check-transaction-status/${tx.transactionId}`);
      } catch (error) {
        console.error(`Error checking transaction ${tx.transactionId}:`, error);
      }
    }
    
    // Refresh transactions after all checks
    await fetchTransactions();
    
    setCheckingStatus(false);
    setStatusMessage('Finished checking all pending transactions');
    setTimeout(() => setStatusMessage(''), 5000);
  };

  const showTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const closeTransactionDetails = () => {
    setSelectedTransaction(null);
  };

  const getStatusBadgeClass = (status) => {
    switch (status.toLowerCase()) {
      case 'success':
        return 'status-badge success';
      case 'pending':
        return 'status-badge pending';
      case 'failed':
        return 'status-badge failed';
      default:
        return 'status-badge';
    }
  };

  const getPaymentResultDescription = (transaction) => {
    if (transaction.paymentStatus === 'Success') {
      return 'Payment was successful';
    }
    
    if (transaction.paymentStatus === 'Failed') {
      // Different error codes and their meanings
      if (transaction.resultCode === '1032') {
        return 'Payment was cancelled by the user';
      } else if (transaction.resultCode === '2001') {
        return 'Invalid initiator information';
      } else if (transaction.resultCode === '1037') {
        return 'Timeout waiting for user input';
      } else {
        return transaction.resultDesc || 'Payment failed';
      }
    }
    
    return 'Payment is pending confirmation';
  };

  if (loading && transactions.length === 0) {
    return <div className="loading">Loading transactions...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  // Get transactions for different tabs
  const successfulTransactions = transactions.filter(tx => tx.paymentStatus === 'Success');
  const failedTransactions = transactions.filter(tx => tx.paymentStatus === 'Failed');
  
  // Determine which transactions to display based on active tab
  let displayTransactions = transactions;
  if (activeTab === 'success') {
    displayTransactions = successfulTransactions;
  } else if (activeTab === 'failed') {
    displayTransactions = failedTransactions;
  }

  return (
    <div className="transactions-container">
      <h2>Transaction History</h2>
      
      <div className="transaction-actions">
        <button 
          className="refresh-btn" 
          onClick={fetchTransactions} 
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Transactions'}
        </button>
        
        <button 
          className="check-all-btn" 
          onClick={checkAllPendingTransactions}
          disabled={checkingStatus || transactions.filter(tx => tx.paymentStatus === 'Pending').length === 0}
        >
          {checkingStatus ? 'Checking...' : 'Check All Pending Transactions'}
        </button>
      </div>
      
      {statusMessage && (
        <div className="status-message">
          {statusMessage}
        </div>
      )}
      
      <div className="transaction-tabs">
        <div className="tab-headers">
          <button 
            className={activeTab === 'all' ? 'tab-active' : ''} 
            onClick={() => setActiveTab('all')}
          >
            All Transactions ({transactions.length})
          </button>
          <button 
            className={activeTab === 'success' ? 'tab-active' : ''} 
            onClick={() => setActiveTab('success')}
          >
            Successful ({successfulTransactions.length})
          </button>
          <button 
            className={activeTab === 'failed' ? 'tab-active' : ''} 
            onClick={() => setActiveTab('failed')}
          >
            Failed ({failedTransactions.length})
          </button>
        </div>
        
        <div className="tab-content">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>Phone Number</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Receipt Number</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    {activeTab === 'all' 
                      ? 'No transactions found' 
                      : activeTab === 'success'
                        ? 'No successful transactions yet'
                        : 'No failed transactions'}
                  </td>
                </tr>
              ) : (
                displayTransactions.map(transaction => (
                  <tr 
                    key={transaction.id} 
                    className={`status-${transaction.paymentStatus.toLowerCase()}`}
                    onClick={() => showTransactionDetails(transaction)}
                  >
                    <td>{transaction.phoneNumber}</td>
                    <td>KSh {transaction.amount.toFixed(2)}</td>
                    <td>
                      <span className={getStatusBadgeClass(transaction.paymentStatus)}>
                        {transaction.paymentStatus}
                      </span>
                    </td>
                    <td>{transaction.receiptNumber || '-'}</td>
                    <td>{formatDate(transaction.createdAt)}</td>
                    <td>
                      {transaction.paymentStatus === 'Pending' && (
                        <button 
                          className="check-status-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            checkTransactionStatus(transaction.transactionId);
                          }}
                          disabled={checkingStatus}
                        >
                          Check Status
                        </button>
                      )}
                      <button 
                        className="details-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          showTransactionDetails(transaction);
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTransaction && (
        <div className="transaction-modal-overlay" onClick={closeTransactionDetails}>
          <div className="transaction-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transaction Details</h3>
              <button className="close-btn" onClick={closeTransactionDetails}>×</button>
            </div>
            <div className="modal-content">
              <div className="detail-row">
                <span className="detail-label">Transaction ID:</span>
                <span className="detail-value">{selectedTransaction.transactionId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Phone Number:</span>
                <span className="detail-value">{selectedTransaction.phoneNumber}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount:</span>
                <span className="detail-value">KSh {selectedTransaction.amount.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`detail-value ${getStatusBadgeClass(selectedTransaction.paymentStatus)}`}>
                  {selectedTransaction.paymentStatus}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{formatDate(selectedTransaction.createdAt)}</span>
              </div>
              {selectedTransaction.receiptNumber && (
                <div className="detail-row">
                  <span className="detail-label">Receipt Number:</span>
                  <span className="detail-value">{selectedTransaction.receiptNumber}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Result:</span>
                <span className="detail-value">{getPaymentResultDescription(selectedTransaction)}</span>
              </div>
              {selectedTransaction.paymentStatus === 'Pending' && (
                <div className="modal-actions">
                  <button 
                    className="check-status-btn"
                    onClick={() => checkTransactionStatus(selectedTransaction.transactionId)}
                    disabled={checkingStatus}
                  >
                    {checkingStatus ? 'Checking...' : 'Check Status'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
