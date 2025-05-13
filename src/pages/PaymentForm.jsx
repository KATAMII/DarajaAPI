import React, { useState } from 'react';
import axios from 'axios';
import './PaymentForm.css';

// Determine API URL based on environment
const API_URL = 
  process.env.NODE_ENV === 'production' 
    ? 'https://darajaapi-production.up.railway.app' // Updated to match your actual Railway URL
    : 'http://localhost:5001';

const PaymentForm = () => {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('');
  const [transactionId, setTransactionId] = useState(null);
  const [transactionTimeout, setTransactionTimeout] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.post(`${API_URL}/stkpush`, {
        phone,
        amount,
      });

      if (response.data.success) {
        const checkoutRequestId = response.data.data.CheckoutRequestID;
        setTransactionId(checkoutRequestId);
        
        setMessage('✅ Payment request sent! Please check your phone and complete the payment.');
        setMessageType('success');
        
        // Instead of continuous polling, we'll set a timeout to check once after 60 seconds
        // Safaricom typically responds within this timeframe
        clearTimeout(transactionTimeout);
        const timeout = setTimeout(() => {
          // Single status check after a reasonable time
          checkStatusOnce(checkoutRequestId);
        }, 60000); // Check once after 60 seconds
        
        setTransactionTimeout(timeout);
      } else {
        setMessage('❌ Failed to initiate payment. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMsg = error.response?.data?.error || '❌ Payment failed. Please try again.';
      setMessage(errorMsg);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const checkStatusOnce = async (id) => {
    try {
      const statusRes = await axios.get(`${API_URL}/transaction/${id}`);
      const transaction = statusRes.data.transaction;
      
      if (transaction.paymentStatus === 'Success') {
        setMessage(`🎉 Payment successful! Receipt: ${transaction.receiptNumber}`);
        setMessageType('success');
      } else if (transaction.paymentStatus === 'Failed') {
        setMessage('❌ Payment failed or was cancelled. Please try again.');
        setMessageType('error');
      } else {
        // Still pending
        setMessage('Status is still pending. The transaction may still be processing or you can manually check the status in the Transactions tab.');
        setMessageType('warning');
      }
    } catch (err) {
      console.error('Status check error:', err);
      setMessage('Unable to verify payment status. Please check the Transactions tab for updates.');
      setMessageType('warning');
    }
  };

  const validatePhone = (input) => {
    // Allow only numbers and remove spaces
    const value = input.replace(/\s/g, '').replace(/[^0-9+]/g, '');
    setPhone(value);
  };

  // Clean up timeout on component unmount
  React.useEffect(() => {
    return () => {
      if (transactionTimeout) {
        clearTimeout(transactionTimeout);
      }
    };
  }, [transactionTimeout]);

  return (
    <div className="form-container">
      <h2>M-Pesa Payment</h2>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            type="text"
            placeholder="e.g. 0712345678 or 254712345678"
            value={phone}
            onChange={(e) => validatePhone(e.target.value)}
            required
            disabled={loading}
          />
          <small>Format: 07XX XXX XXX or 254 7XX XXX XXX</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="amount">Amount (KSh)</label>
          <input
            id="amount"
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            required
            disabled={loading}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !phone || !amount}
        >
          {loading ? 'Processing...' : 'Pay Now'}
        </button>
      </form>

      {transactionId && (
        <div className="transaction-info">
          <p>Transaction ID: {transactionId}</p>
          <p className="transaction-note">
            Please complete the payment on your phone. You will be notified when the payment is processed.
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;
