import { Navigate, Route, Routes } from 'react-router-dom';
import Town from './routes/town';
import QuestRoute from './routes/quest';

export default function App() {
  return (
    <Routes>
      <Route path="/town" element={<Navigate to="/town/town-square" replace />} />
      <Route path="/town/:sceneKey" element={<Town />} />
      <Route path="/quest/:questId" element={<QuestRoute />} />
      <Route path="*" element={<Navigate to="/town/town-square" replace />} />
    </Routes>
  );
}
