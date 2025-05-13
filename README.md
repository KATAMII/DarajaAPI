# M-Pesa Payment Integration

This application demonstrates how to integrate the M-Pesa STK Push API into a React application with a Node.js backend.

## Features

- Send STK push notifications to customers for payment
- Process callback responses from M-Pesa
- Store transaction details in a PostgreSQL database
- Real-time transaction status updates

## Project Structure

- `src/` - React frontend application
- `server/` - Express backend API for M-Pesa integration

## Setup Instructions

### Prerequisites

- Node.js and npm installed
- PostgreSQL database 
- M-Pesa Daraja API credentials (Consumer Key, Consumer Secret)

### Environment Variables

Create a `.env` file in the server directory with the following variables:

```
DATABASE_URL="your_postgresql_connection_string"
CONSUMER_KEY="your_mpesa_consumer_key"
CONSUMER_SECRET="your_mpesa_consumer_secret"
SHORTCODE="your_mpesa_shortcode" 
PASSKEY="your_mpesa_passkey"
PORT=5001
CALLBACK_URL="your_callback_url/callback"
```

### Database Setup

1. The application uses Prisma ORM to manage the database.
2. Run the following commands to set up the database:

```bash
cd server
npx prisma migrate dev --name init
```

### Installation

1. Clone the repository
2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd server
npm install
```

### Running the Application

1. Start the backend server:
```bash
cd server
npm run dev
```

2. Start the frontend application:
```bash
npm run dev
```

## API Endpoints

- `POST /stkpush` - Initiates an STK push request
- `POST /callback` - Receives callback from M-Pesa
- `GET /transaction/:id` - Checks transaction status

## Deploying to Railway

1. Create a new Railway project
2. Add a PostgreSQL database service
3. Add a service for your application code
4. Set the following environment variables in Railway:
   - `DATABASE_URL` (automatically provided by Railway PostgreSQL)
   - `CONSUMER_KEY`
   - `CONSUMER_SECRET`
   - `SHORTCODE`
   - `PASSKEY`
   - `CALLBACK_URL` (use your Railway app URL + /callback)
   - `PORT` (Railway will set this automatically)
5. Make sure to update the `API_URL` in `src/pages/PaymentForm.jsx` with your actual Railway API URL
6. Deploy your application with:
   - Build Command: `npm install && cd server && npm install && npx prisma migrate deploy`
   - Start Command: `cd server && npm start`

### Important Railway-specific Notes

1. The Procfile is already configured for Railway deployment
2. Ensure your M-Pesa callback URL is updated to point to your Railway app URL
3. For production, consider setting up CORS to restrict to specific origins
4. Railway will automatically expose the PORT environment variable
5. If you have separate frontend and backend services, you'll need to update the API_URL accordingly

## Notes for Production

- For production, use the production M-Pesa API endpoints
- Ensure your callback URL is publicly accessible
- Configure proper error handling and logging
- Set up proper security measures for API keys and credentials
