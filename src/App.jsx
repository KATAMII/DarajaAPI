import { useState } from 'react';
import './App.css'
import PaymentForm from './pages/PaymentForm'
import TransactionList from './pages/TransactionList'

function App() {
  const [activeTab, setActiveTab] = useState('payment');

  return (
    <div className="App">
      <header>
        <h1>M-Pesa Payment Integration</h1>
        <nav>
          <button 
            className={activeTab === 'payment' ? 'active' : ''} 
            onClick={() => setActiveTab('payment')}
          >
            Make Payment
          </button>
          <button 
            className={activeTab === 'transactions' ? 'active' : ''} 
            onClick={() => setActiveTab('transactions')}
          >
            View Transactions
          </button>
        </nav>
      </header>

      <main>
        {activeTab === 'payment' ? <PaymentForm /> : <TransactionList />}
      </main>

      <footer>
        <p>M-Pesa Integration with Railway &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}

export default App
