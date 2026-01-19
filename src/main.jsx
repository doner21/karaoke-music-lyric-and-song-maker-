import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import SimpleErrorBoundary from './components/SimpleErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <SimpleErrorBoundary>
            <App />
        </SimpleErrorBoundary>
    </React.StrictMode>,
)
