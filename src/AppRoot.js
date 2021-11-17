import { getAuth } from "firebase/auth";
import { AuthProvider } from 'reactfire';
import App from "./App";

const AppRoot = () => {
  const auth = getAuth();

  return (
    <AuthProvider sdk={auth}>
      <App />
    </AuthProvider>
  );
};

export default AppRoot;
