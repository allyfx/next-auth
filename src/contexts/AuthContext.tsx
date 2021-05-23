import { createContext, ReactNode, useEffect, useState } from "react";
import Router from "next/router";
import { setCookie, parseCookies, destroyCookie } from "nookies";

import { api } from "../services/apiClient";

type IUser = {
  email: string;
  permissions: string[];
  roles: string[];
}

type ISignInCredentials = {
  email: string;
  password: string;
}

type IAuthContextData = {
  signIn(credentials: ISignInCredentials): Promise<void>;
  signOut(): void;
  user: IUser;
  isAuthenticated: boolean;
}

type IAuthProviderProps = {
  children: ReactNode;
}

export const AuthContext = createContext({} as IAuthContextData);

let authChannel: BroadcastChannel;

export function signOut() {
  destroyCookie(undefined, 'nextauth.token');
  destroyCookie(undefined, 'nextauth.refreshToken');

  authChannel.postMessage('signOut');

  Router.push('/');
}

export function AuthProvider({ children }: IAuthProviderProps) {
  const [user, setUser] = useState<IUser>();
  const isAuthenticated = !!user;

  useEffect(() => {
    authChannel = new BroadcastChannel('auth');

    authChannel.onmessage = (message) => {
      switch(message.data) {
        case 'signOut':
          signOut();
          break;
        default:
          break;
      }
    }
  }, []);

  useEffect(() => {
    const { 'nextauth.token': token } = parseCookies();
    
    if (token) {
      api.get("/me")
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          signOut();
        })
    }
  }, []);

  async function signIn({ email, password }: ISignInCredentials) {
    try {
      const response = await api.post('/sessions', {
        email,
        password,
      });

      const { token, refreshToken, permissions, roles } = response.data;

      setCookie(undefined, 'nextauth.token', token, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      setCookie(undefined, 'nextauth.refreshToken', refreshToken, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      api.defaults.headers['Authorization'] = `Bearer ${token}`;

      setUser({
        email,
        permissions,
        roles,
      });

      Router.push('/dashboard');
    } catch(err) {
      console.log(err);
    }
  }

  return (
    <AuthContext.Provider value={{
      signIn,
      signOut,
      user,
      isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  )
}
