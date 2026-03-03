import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from "react";
import { useSessionManager, SessionStatus } from "@/hooks/useSessionManager";
import { supabase } from "@/integrations/supabase/client";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";

interface SessionContextType {
  status: SessionStatus;
  refreshSession: () => Promise<boolean>;
  forceSessionCheck: () => Promise<boolean>;
  isSessionValid: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      status: {
        isAuthenticated: false,
        isRefreshing: false,
        lastRefresh: null,
        sessionExpiresAt: null,
        error: null,
      },
      refreshSession: async () => false,
      forceSessionCheck: async () => false,
      isSessionValid: false,
    };
  }
  return context;
};

interface SessionProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that wraps the app with robust session management.
 * Handles proactive token refresh and prevents white screens from session expiry.
 */
export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const { status, refreshSession, forceSessionCheck } = useSessionManager({
    refreshBeforeExpiryMinutes: 10,
    debug: process.env.NODE_ENV === "development",
  });

  const [isSessionValid, setIsSessionValid] = useState(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Determine if session is valid for operations
  useEffect(() => {
    const checkValidity = () => {
      if (!status.isAuthenticated) {
        setIsSessionValid(false);
        return;
      }

      if (!status.sessionExpiresAt) {
        setIsSessionValid(true);
        return;
      }

      const now = new Date();
      const expiresAt = status.sessionExpiresAt;
      const bufferMs = 60 * 1000; // 1 minute buffer

      setIsSessionValid(expiresAt.getTime() - now.getTime() > bufferMs);
    };

    checkValidity();

    // Check validity every 30 seconds
    const interval = setInterval(checkValidity, 30000);

    return () => clearInterval(interval);
  }, [status.isAuthenticated, status.sessionExpiresAt]);

  // Global error handler for auth-related errors
  useEffect(() => {
    const handleSupabaseError = async (error: any) => {
      // Check if it's an auth-related error
      const errorMessage = error?.message || error?.toString() || "";
      const isAuthError =
        errorMessage.includes("JWT") ||
        errorMessage.includes("token") ||
        errorMessage.includes("expired") ||
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("refresh_token");

      if (!isAuthError) return;

      console.warn("[SessionProvider] Auth error detected, attempting recovery:", errorMessage);

      eventLogger.log(EventType.AUTH_ERROR, "Error de autenticación detectado, intentando recuperación", {
        severity: EventSeverity.WARNING,
        context: { error: errorMessage },
      });

      // Attempt to refresh session
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const success = await refreshSession();

        if (success) {
          retryCountRef.current = 0;
          eventLogger.log(EventType.INFO, "Sesión recuperada exitosamente", {
            severity: EventSeverity.SUCCESS,
          });
        } else if (retryCountRef.current >= maxRetries) {
          eventLogger.log(EventType.AUTH_ERROR, "No se pudo recuperar la sesión después de múltiples intentos", {
            severity: EventSeverity.ERROR,
          });
        }
      }
    };

    // Listen for unhandled promise rejections that might be auth-related
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleSupabaseError(event.reason);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [refreshSession]);

  // Reset retry count on successful auth state
  useEffect(() => {
    if (status.isAuthenticated && !status.error) {
      retryCountRef.current = 0;
    }
  }, [status.isAuthenticated, status.error]);

  // Handle app resume from background (Capacitor-specific)
  // Note: visibilitychange is already handled in useSessionManager hook
  useEffect(() => {
    const handleResume = async () => {
      console.log("[SessionProvider] App resumed from background (Capacitor)");
      
      // Give the network a moment to stabilize
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Check if we have a valid session
      const isValid = await forceSessionCheck();
      
      if (!isValid) {
        console.warn("[SessionProvider] Session invalid after resume, checking auth state");
        
        const { data } = await supabase.auth.getSession();
        
        if (!data.session) {
          eventLogger.log(EventType.INFO, "Sesión expirada durante suspensión", {
            severity: EventSeverity.WARNING,
          });
        }
      }
    };

    // For Capacitor apps only - this handles resume from background
    // visibilitychange is already handled by useSessionManager, so we only add the Capacitor-specific "resume" event
    document.addEventListener("resume", handleResume);

    return () => {
      document.removeEventListener("resume", handleResume);
    };
  }, [forceSessionCheck]);

  const contextValue: SessionContextType = {
    status,
    refreshSession,
    forceSessionCheck,
    isSessionValid,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};
