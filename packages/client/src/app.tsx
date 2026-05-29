import { Navigate, Route, Routes } from 'react-router-dom';
import Town from './routes/town';
import QuestRoute from './routes/quest';
import PostMortem from './features/hall-of-returns/post-mortem';
import AudioControllerMount from './audio/audio-controller-mount';
import TourOverlay from './features/tour/tour-overlay';

export default function App() {
  return (
    <>
      <AudioControllerMount />
      <TourOverlay />
      <Routes>
        <Route path="/town" element={<Navigate to="/town/town-square" replace />} />
        <Route path="/town/:sceneKey" element={<Town />} />
        <Route path="/quest/:questId" element={<QuestRoute />} />
        <Route path="/hall-of-returns/:questId" element={<PostMortem />} />
        <Route path="*" element={<Navigate to="/town/town-square" replace />} />
      </Routes>
    </>
  );
}
