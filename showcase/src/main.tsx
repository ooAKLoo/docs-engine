import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '../../styles/index.css';
import './gallery.css';
import {Gallery} from './Gallery.js';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing showcase root element');
}

createRoot(root).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
