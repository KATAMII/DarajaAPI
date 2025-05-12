import React, { useState } from 'react';
import axios from 'axios';
import './PaymentForm.css';

const PaymentForm = () => {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    let formattedPhone = phone;
    if (phone.startsWith('07')) {
      formattedPhone = '254' + phone.slice(1);
    }

    try {
      const response = await axios.post('http://localhost:5000/stkpush', {
        phone: formattedPhone,
        amount,
      });

      const transactionId = response.data.transactionId;

      setMessage('✅ Payment request sent! Please complete it on your phone.');
      setMessageType('success');

      // Poll for payment status
      const checkStatus = setInterval(async () => {
        const statusRes = await axios.get(
          `http://localhost:5000/payment-status/${transactionId}`
        );

        if (statusRes.data.status === 'Success') {
          setMessage('🎉 Payment was successful!');
          setMessageType('success');
          clearInterval(checkStatus);
        }
      }, 3000); // every 3 seconds

    } catch (error) {
      console.error(error.response ? error.response.data : error.message);

      const errorMsg = error.response?.data?.message || '❌ Payment failed. Try again.';
      setMessage(errorMsg);
      setMessageType('error');
    }
  };

  return (
    <div className="form-container">
      <h2>M-Pesa Payment</h2>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Phone Number (2547...)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <button type="submit">Pay Now</button>
      </form>
    </div>
  );
};

export default PaymentForm;
