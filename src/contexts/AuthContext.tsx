import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useEffect,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { service, UserMeResponse } from "../services/api";

interface AuthContextData {
  userToken: UserMeResponse | null;
  setUserToken: Dispatch<SetStateAction<UserMeResponse | null>>;
}

export const AuthContext = createContext<AuthContextData>(
  {} as AuthContextData,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userToken, setUserToken] = useState<UserMeResponse | null>(null);

  async function loadToken() {
    const token = await SecureStore.getItemAsync("token");
    if (token) {
      try {
        const userFound = await service.getSelfUser();
        setUserToken(userFound);
        console.log(userFound);
      } catch (error) {
        console.log("Erro no AuthContext");
      }
    }
  }

  useEffect(() => {
    loadToken();
  }, []);

  return (
    <AuthContext.Provider value={{ userToken, setUserToken }}>
      {children}
    </AuthContext.Provider>
  );
}
