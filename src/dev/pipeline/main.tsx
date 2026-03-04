import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css'; // Tailwind CSS
import { PipelineObservatory } from './PipelineObservatory';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PipelineObservatory />
  </React.StrictMode>,
);
