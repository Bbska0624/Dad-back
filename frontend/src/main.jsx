import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/base.css';
import './pages/Account/account.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode><BrowserRouter><LanguageProvider><ThemeProvider><App /></ThemeProvider></LanguageProvider></BrowserRouter></StrictMode>,
);
