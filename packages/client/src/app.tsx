import { Navigate, Route, Routes } from 'react-router-dom';
import Town from './routes/town';

export default function App() {
  return (
    <Routes>
      <Route path="/town" element={<Town />} />
      <Route path="/town/:sceneKey" element={<Town />} />
      <Route path="*" element={<Navigate to="/town" replace />} />
    </Routes>
  );
}
