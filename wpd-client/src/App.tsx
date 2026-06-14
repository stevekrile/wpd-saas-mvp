import { WpdAuthProvider } from './features/auth/AuthContext';
import AppRoutes from './routes';

function App() {
  return (
    <WpdAuthProvider>
      <AppRoutes />
    </WpdAuthProvider>
  );
}

export default App;