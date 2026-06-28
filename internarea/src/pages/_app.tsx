import Footer from "@/Components/Fotter";
import Navbar from "@/Components/Navbar";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { store } from "../store/store";
import { Provider, useDispatch } from "react-redux";
import { useEffect, useState, useCallback } from "react";
import { auth } from "@/firebase/firebase";
import { login, logout } from "@/Feature/Userslice";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthReadyProvider } from "@/Feature/AuthContext";
import { api } from "@/utils/api";
import { LanguageProvider } from "@/context/LanguageContext";


function AuthListener({ onReady }: { onReady: () => void }) {
  const dispatch = useDispatch();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authuser) => {
      if (authuser) {
        const userPayload = {
          uid: authuser.uid,
          photo: authuser.photoURL,
          name: authuser.displayName,
          email: authuser.email,
          phoneNumber: authuser.phoneNumber,
          role: 'user',
        };

        dispatch(login(userPayload));

        try {
          const res = await api.post('/users/sync', { user: userPayload });
          if (res.data?.user) {
            const backendUser = res.data.user;
            dispatch(login(backendUser));
            if (res.data?.token) {
              localStorage.setItem('token', res.data.token);
            }
            localStorage.setItem('user', JSON.stringify(backendUser));
          }
        } catch (err) {
          console.error('Backend sync failed', err);
        }

        onReady();
        return;
      }

      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("user");
          if (raw) {
            const parsed = JSON.parse(raw);
            dispatch(login(parsed));
            onReady();
            return;
          }
        } catch (e) {
          console.error("Local user restore failed", e);
        }
      }

      dispatch(logout());
      onReady();
    });

    return unsubscribe;
  }, [dispatch, onReady]);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  const [authReady, setAuthReady] = useState(false);
  const handleAuthReady = useCallback(() => setAuthReady(true), []);

  return (
    <Provider store={store}>
      <LanguageProvider>
        <AuthReadyProvider value={authReady}>
          <AuthListener onReady={handleAuthReady} />
          {authReady ? (
            <div className="bg-background text-foreground min-h-screen flex flex-col justify-between">
              <div>
                <ToastContainer />
                <Navbar />
                <main className="w-full">
                  <Component {...pageProps} />
                </main>
              </div>
              <Footer />
            </div>
          ) : (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
              <div className="rounded-3xl bg-white border border-gray-150 p-8 shadow-lg text-center">
                <p className="text-gray-600 font-medium">Loading your session...</p>
              </div>
            </div>
          )}
        </AuthReadyProvider>
      </LanguageProvider>
    </Provider>
  );
}
