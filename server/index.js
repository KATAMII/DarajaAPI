// index.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());

// Sample route to test
app.get('/', (req, res) => {
  res.send('M-Pesa API Server is running ✅');
});

app.post('/callback', async (req, res) => {
    const { Body } = req.body;
  
    try {
      const checkoutId = Body.stkCallback.CheckoutRequestID;
  
      if (Body.stkCallback.ResultCode === 0) {
        // Payment successful
        const transaction = await prisma.transaction.update({
          where: { transactionId: checkoutId },
          data: {
            paymentStatus: 'Success',
            receiptNumber: Body.stkCallback.CallbackMetadata.Item.find(
              (item) => item.Name === 'MpesaReceiptNumber'
            ).Value,
          },
        });
  
        // Save to success transaction table
        await prisma.successTransaction.create({
          data: {
            phoneNumber: transaction.phoneNumber,
            amount: transaction.amount,
            transactionId: transaction.transactionId,
            receiptNumber: transaction.receiptNumber,
          },
        });
  
        res.status(200).json({ message: 'Payment successful!' });
  
      } else {
        let resultMessage = 'Payment failed or canceled.';
  
        if (Body.stkCallback.ResultDesc.includes('Insufficient')) {
          resultMessage = 'Insufficient balance. Please top up your M-PESA account.';
        } else if (Body.stkCallback.ResultDesc.includes('cancelled')) {
          resultMessage = 'Payment cancelled by user.';
        }
  
        await prisma.transaction.update({
          where: { transactionId: checkoutId },
          data: { paymentStatus: 'Failed' },
        });
  
        res.status(200).json({ message: resultMessage });
      }
    } catch (error) {
      console.error('Callback error:', error);
      res.status(500).json({ error: 'Server error during callback processing.' });
    }
  });
  
  // Start the server
  app.listen(5000, () => console.log('✅ Server running on http://localhost:5000'));

// Example route for STK Push Simulation (Daraja API)
app.post('/stkpush', async (req, res) => {
  const { phone, amount } = req.body;

  const tokenUrl = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  const stkPushUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

  const consumerKey = process.env.CONSUMER_KEY;
  const consumerSecret = process.env.CONSUMER_SECRET;
  const shortcode = process.env.SHORTCODE;
  const passkey = process.env.PASSKEY;
  const callbackUrl = process.env.CALLBACK_URL;

  // Encode credentials
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    // Get access token
    const { data: tokenResponse } = await axios.get(tokenUrl, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    const accessToken = tokenResponse.access_token;

    // Get current timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);

    // Password
    const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');

    // Initiate STK Push
    const { data: stkResponse } = await axios.post(
      stkPushUrl,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: 'MPESA_TEST',
        TransactionDesc: 'Test Payment',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.status(200).json(stkResponse);
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'An error occurred while processing the payment.',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
