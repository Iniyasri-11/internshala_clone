import { createContext, useContext } from "react";

const AuthReadyContext = createContext(false);

export const AuthReadyProvider = AuthReadyContext.Provider;

export const useAuthReady = () => useContext(AuthReadyContext);
