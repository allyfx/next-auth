import axios, { AxiosError } from "axios";
import { parseCookies, setCookie } from "nookies";

import { signOut } from "../contexts/AuthContext";
import { AuthTokenError } from "./errors/AuthTokenError";

let isRefreshing = false;
let failedRequestQuere = [];

export function setupApiClient(ctx = undefined) {
  let cookies = parseCookies(ctx);

  const api = axios.create({
    baseURL: 'http://localhost:3333',
    headers: {
      Authorization: `Bearer ${cookies['nextauth.token']}`
    }
  });
  
  api.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
      if (error.response.status === 401) {
        if (error.response.data?.code === 'token.expired') {
          cookies = parseCookies(ctx);
          
          const { 'nextauth.refreshToken': refreshToken } = cookies;
          const originalConfig = error.config;
  
          if (!isRefreshing) {
            isRefreshing = true;
            api.post('/refresh', {
              refreshToken,
            }).then(response => {
              const { token } = response.data;
    
              setCookie(ctx, 'nextauth.token', token, {
                maxAge: 60 * 60 * 24 * 30, // 30 days
              });
              setCookie(ctx, 'nextauth.refreshToken', response.data.refreshToken, {
                maxAge: 60 * 60 * 24 * 30, // 30 days
              });
    
              api.defaults.headers['Authorization'] = `Bearer ${token}`;
  
              failedRequestQuere.forEach(request => request.onSuccess(token));
              failedRequestQuere = [];
            }).catch(err => {
              failedRequestQuere.forEach(request => request.onFailure(err));
              failedRequestQuere = [];
  
              if (process.browser) {
                signOut();
              }
            }).finally(() => {
              isRefreshing = false;
            });
          }
  
          return new Promise((resolve, reject) => {
            failedRequestQuere.push({
              onSuccess: (token: string) => {
                originalConfig.headers['Authorization'] = `Bearer ${token}`;
                
                resolve(api(originalConfig));
              },
              onFailure: (err: AxiosError) => reject(err),
            })
          });
        } else {
          if (process.browser) {
            signOut();
          } else {
            Promise.reject(new AuthTokenError());
          }
        }
      }
  
      return Promise.reject(error);
    }
  )

  return api;
}
