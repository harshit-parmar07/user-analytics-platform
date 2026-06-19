import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SessionsList from './pages/SessionsList';
import SessionDetail from './pages/SessionDetail';
import Heatmap from './pages/Heatmap';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<SessionsList />} />
          <Route path="/sessions/:sessionId" element={<SessionDetail />} />
          <Route path="/heatmap" element={<Heatmap />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
