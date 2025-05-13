// index.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { PrismaClient } from './generated/prisma';

// Load environment variables from .env file
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration
app.use(cors({
  origin: '*', // Update this to your specific frontend URL in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Validate M-Pesa transaction ID for security
const isValidMpesaTransactionId = (transactionId) => {
  // M-Pesa CheckoutRequestIDs follow a specific format
  // Example: ws_CO_07072023063237986224931
  const mpesaIdRegex = /^ws_CO_\d{17}\d+$/;
  return typeof transactionId === 'string' && mpesaIdRegex.test(transactionId);
};

// Sample route to test
app.get('/', (req, res) => {
  res.send('M-Pesa API Server is running ✅');
});

// Get environment info for debugging
app.get('/env-info', (req, res) => {
  res.json({
    callbackUrl: process.env.CALLBACK_URL,
    databaseConnected: !!prisma,
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT
  });
});

// Get all transactions
app.get('/transactions', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    const successTransactions = await prisma.successTransaction.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ 
      transactions,
      successTransactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// STK Push endpoint
app.post('/stkpush', async (req, res) => {
  const { phone, amount } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ error: 'Phone number and amount are required' });
  }

  // Format phone number (remove leading 0 or +254 and add 254)
  const formattedPhone = phone.startsWith('+254') 
    ? phone.substring(1) 
    : phone.startsWith('0') 
      ? '254' + phone.substring(1) 
      : phone;

  const tokenUrl = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  const stkPushUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

  const consumerKey = process.env.CONSUMER_KEY;
  const consumerSecret = process.env.CONSUMER_SECRET;
  const shortcode = process.env.SHORTCODE;
  const passkey = process.env.PASSKEY;
  const callbackUrl = process.env.CALLBACK_URL;

  console.log('Using callback URL:', callbackUrl);

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
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
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

    // Save transaction in the database
    await prisma.transaction.create({
      data: {
        phoneNumber: formattedPhone,
        amount: parseFloat(amount),
        transactionId: stkResponse.CheckoutRequestID,
        paymentStatus: 'Pending'
      }
    });

    res.status(200).json({
      success: true,
      message: 'STK push sent successfully',
      data: stkResponse
    });
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'An error occurred while processing the payment.',
      details: error.response?.data || error.message
    });
  }
});

// Callback endpoint for M-Pesa
app.post('/callback', async (req, res) => {
  console.log('Callback received:', JSON.stringify(req.body));
  const { Body } = req.body;

  try {
    const checkoutId = Body.stkCallback.CheckoutRequestID;
    console.log(`Processing callback for transaction: ${checkoutId}`);

    // Find the transaction in our database
    const transaction = await prisma.transaction.findUnique({
      where: { transactionId: checkoutId }
    });

    if (!transaction) {
      console.error(`Transaction with ID ${checkoutId} not found in database`);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Transaction not found but acknowledged' });
    }

    if (Body.stkCallback.ResultCode === 0) {
      // Extract payment details from callback metadata
      const callbackItems = Body.stkCallback.CallbackMetadata.Item;
      const receiptNumber = callbackItems.find(item => item.Name === 'MpesaReceiptNumber').Value;
      const amount = callbackItems.find(item => item.Name === 'Amount').Value;
      const phoneNumber = callbackItems.find(item => item.Name === 'PhoneNumber').Value;
      const transactionDate = callbackItems.find(item => item.Name === 'TransactionDate')?.Value;

      console.log(`Payment successful: ${receiptNumber}, Amount: ${amount}, Phone: ${phoneNumber}`);

      // Update transaction status
      await prisma.transaction.update({
        where: { transactionId: checkoutId },
        data: {
          paymentStatus: 'Success',
          receiptNumber: receiptNumber,
        },
      });

      // Save to success transaction table
      await prisma.successTransaction.create({
        data: {
          phoneNumber: transaction.phoneNumber,
          amount: transaction.amount,
          transactionId: transaction.transactionId,
          receiptNumber: receiptNumber,
        },
      });

      // You could trigger any other business logic here
      // Such as sending confirmation emails, updating inventory, etc.
    } else {
      // Payment failed
      console.log(`Payment failed: ${Body.stkCallback.ResultDesc}, Code: ${Body.stkCallback.ResultCode}`);
      
      await prisma.transaction.update({
        where: { transactionId: checkoutId },
        data: { 
          paymentStatus: 'Failed',
          resultCode: Body.stkCallback.ResultCode.toString(),
          resultDesc: Body.stkCallback.ResultDesc
        },
      });
    }

    // Always respond with 200 to M-Pesa
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback processed successfully' });
  } catch (error) {
    console.error('Callback processing error:', error);
    // Still return 200 to acknowledge receipt even if there was an error processing
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received' });
  }
});

// Check transaction status endpoint
app.get('/transaction/:id', async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    // Validate transaction ID format for security
    if (!isValidMpesaTransactionId(transactionId)) {
      return res.status(400).json({ 
        error: 'Invalid transaction ID format',
        details: 'The provided transaction ID does not match the expected M-Pesa format' 
      });
    }
    
    const transaction = await prisma.transaction.findUnique({
      where: { transactionId: req.params.id }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.status(200).json({ transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
});

// Query M-Pesa for transaction status
app.post('/check-transaction-status/:id', async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    // Validate transaction ID format for security
    if (!isValidMpesaTransactionId(transactionId)) {
      return res.status(400).json({ 
        error: 'Invalid transaction ID format',
        details: 'The provided transaction ID does not match the expected M-Pesa format' 
      });
    }
    
    // First get the transaction from our database
    const transaction = await prisma.transaction.findUnique({
      where: { transactionId }
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Only check pending transactions
    if (transaction.paymentStatus !== 'Pending') {
      return res.status(200).json({ 
        transaction,
        message: `Transaction is already marked as ${transaction.paymentStatus}`
      });
    }

    // Get access token for M-Pesa API
    const tokenUrl = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    const consumerKey = process.env.CONSUMER_KEY;
    const consumerSecret = process.env.CONSUMER_SECRET;
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    const { data: tokenResponse } = await axios.get(tokenUrl, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    const accessToken = tokenResponse.access_token;
    
    // M-Pesa Query URL
    const queryUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';
    
    // Get current timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);
    
    // Password
    const shortcode = process.env.SHORTCODE;
    const passkey = process.env.PASSKEY;
    const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');
    
    // Query STK status
    const { data: queryResponse } = await axios.post(
      queryUrl,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: transactionId
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    console.log('Mpesa Query Response:', queryResponse);
    
    // Update transaction based on response
    if (queryResponse.ResultCode === 0) {
      // Transaction was successful
      await prisma.transaction.update({
        where: { transactionId },
        data: {
          paymentStatus: 'Success',
          // You might not get receipt number in query response
        },
      });
      
      res.status(200).json({
        success: true,
        message: 'Transaction was successful',
        data: queryResponse
      });
    } else {
      // Transaction failed or is still pending
      const statusMessage = queryResponse.ResultDesc || 'Unknown status';
      
      // If we get a definitive failure response, mark as failed
      if (queryResponse.ResultCode !== 1037) { // 1037 is "timeout" which might mean still pending
        await prisma.transaction.update({
          where: { transactionId },
          data: {
            paymentStatus: 'Failed',
            resultCode: queryResponse.ResultCode.toString(),
            resultDesc: queryResponse.ResultDesc
          },
        });
      }
      
      res.status(200).json({
        success: false,
        message: statusMessage,
        data: queryResponse
      });
    }
  } catch (error) {
    console.error('Error checking transaction status:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check transaction status',
      details: error.response?.data || error.message
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
