import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";

export interface SessionStatus {
  isAuthenticated: boolean;
  isRefreshing: boolean;
  lastRefresh: Date | null;
  sessionExpiresAt: Date | null;
  error: string | null;
}

interface UseSessionManagerOptions {
  /** Minutes before expiry to trigger proactive refresh (default: 10) */
  refreshBeforeExpiryMinutes?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Hook for robust session management with proactive token refresh.
 * Prevents white screens by handling session expiration gracefully.
 */
export const useSessionManager = (options: UseSessionManagerOptions = {}) => {
  const { refreshBeforeExpiryMinutes = 10, debug = false } = options;

  const [status, setStatus] = useState<SessionStatus>({
    isAuthenticated: false,
    isRefreshing: false,
    lastRefresh: null,
    sessionExpiresAt: null,
    error: null,
  });

  const refreshTimerRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);
  const mountedRef = useRef(true);

  const log = useCallback(
    (message: string, data?: any) => {
      if (debug) {
        console.log(`[SessionManager] ${message}`, data || "");
      }
    },
    [debug]
  );

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  /**
   * Proactively refresh the session token
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) {
      log("Refresh already in progress, skipping");
      return false;
    }

    isRefreshingRef.current = true;
    setStatus((prev) => ({ ...prev, isRefreshing: true, error: null }));

    try {
      log("Starting proactive session refresh");

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        throw error;
      }

      if (data.session) {
        const expiresAt = new Date(data.session.expires_at! * 1000);
        
        log("Session refreshed successfully", {
          expiresAt: expiresAt.toISOString(),
          userId: data.session.user.id,
        });

        eventLogger.log(EventType.INFO, "Sesión renovada automáticamente", {
          severity: EventSeverity.SUCCESS,
          context: { expiresAt: expiresAt.toISOString() },
        });

        if (mountedRef.current) {
          setStatus((prev) => ({
            ...prev,
            isAuthenticated: true,
            isRefreshing: false,
            lastRefresh: new Date(),
            sessionExpiresAt: expiresAt,
            error: null,
          }));
        }

        return true;
      }

      return false;
    } catch (error: any) {
      const errorMessage = error?.message || "Error desconocido al renovar sesión";
      
      log("Session refresh failed", { error: errorMessage });

      // Don't log as error if it's just a network issue - we'll retry
      if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
        eventLogger.log(EventType.INFO, "Reintentando renovación de sesión (sin conexión)", {
          severity: EventSeverity.WARNING,
        });
      } else {
        eventLogger.log(EventType.AUTH_ERROR, `Error renovando sesión: ${errorMessage}`, {
          severity: EventSeverity.WARNING,
          context: { error: errorMessage },
        });
      }

      if (mountedRef.current) {
        setStatus((prev) => ({
          ...prev,
          isRefreshing: false,
          error: errorMessage,
        }));
      }

      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [log]);

  /**
   * Schedule the next proactive refresh based on token expiry
   */
  const scheduleProactiveRefresh = useCallback(
    (session: Session | null) => {
      clearRefreshTimer();

      if (!session?.expires_at) {
        log("No session or expiry time, skipping refresh scheduling");
        return;
      }

      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const refreshBeforeMs = refreshBeforeExpiryMinutes * 60 * 1000;
      const timeUntilRefresh = expiresAt - now - refreshBeforeMs;

      if (timeUntilRefresh <= 0) {
        // Token is already near expiry, refresh immediately
        log("Token near expiry, refreshing immediately");
        refreshSession();
        return;
      }

      log("Scheduling proactive refresh", {
        inMinutes: Math.round(timeUntilRefresh / 60000),
        expiresAt: new Date(expiresAt).toISOString(),
      });

      refreshTimerRef.current = window.setTimeout(() => {
        log("Proactive refresh timer triggered");
        refreshSession().then((success) => {
          if (success) {
            // Re-schedule after successful refresh
            supabase.auth.getSession().then(({ data }) => {
              if (data.session && mountedRef.current) {
                scheduleProactiveRefresh(data.session);
              }
            });
          }
        });
      }, timeUntilRefresh);
    },
    [clearRefreshTimer, log, refreshBeforeExpiryMinutes, refreshSession]
  );

  /**
   * Handle network recovery - attempt to refresh session
   */
  const handleNetworkRecovery = useCallback(async () => {
    log("Network recovered, checking session validity");

    try {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        log("No session after network recovery");
        return;
      }

      const expiresAt = data.session.expires_at! * 1000;
      const now = Date.now();
      const refreshThreshold = refreshBeforeExpiryMinutes * 60 * 1000;

      // If session is expired or near expiry, refresh it
      if (expiresAt - now < refreshThreshold) {
        log("Session near expiry after network recovery, refreshing");
        await refreshSession();
      } else {
        log("Session still valid after network recovery");
        scheduleProactiveRefresh(data.session);
      }
    } catch (error) {
      log("Error checking session after network recovery", error);
    }
  }, [log, refreshBeforeExpiryMinutes, refreshSession, scheduleProactiveRefresh]);

  /**
   * Force a session check and refresh if needed
   */
  const forceSessionCheck = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (!data.session) {
        setStatus((prev) => ({
          ...prev,
          isAuthenticated: false,
          sessionExpiresAt: null,
        }));
        return false;
      }

      const expiresAt = data.session.expires_at! * 1000;
      const now = Date.now();

      // If expired, try to refresh
      if (expiresAt < now) {
        return await refreshSession();
      }

      // If near expiry, refresh proactively
      const refreshThreshold = refreshBeforeExpiryMinutes * 60 * 1000;
      if (expiresAt - now < refreshThreshold) {
        return await refreshSession();
      }

      return true;
    } catch (error: any) {
      log("Force session check failed", error);
      return false;
    }
  }, [log, refreshBeforeExpiryMinutes, refreshSession]);

  // Initialize and listen to auth state changes
  useEffect(() => {
    mountedRef.current = true;

    const initializeSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        const expiresAt = new Date(data.session.expires_at! * 1000);
        
        setStatus({
          isAuthenticated: true,
          isRefreshing: false,
          lastRefresh: null,
          sessionExpiresAt: expiresAt,
          error: null,
        });

        scheduleProactiveRefresh(data.session);
      }
    };

    initializeSession();

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      log("Auth state changed", { event, hasSession: !!session });

      if (!mountedRef.current) return;

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session) {
          const expiresAt = new Date(session.expires_at! * 1000);
          
          setStatus((prev) => ({
            ...prev,
            isAuthenticated: true,
            sessionExpiresAt: expiresAt,
            lastRefresh: event === "TOKEN_REFRESHED" ? new Date() : prev.lastRefresh,
            error: null,
          }));

          scheduleProactiveRefresh(session);
        }
      } else if (event === "SIGNED_OUT") {
        clearRefreshTimer();
        setStatus({
          isAuthenticated: false,
          isRefreshing: false,
          lastRefresh: null,
          sessionExpiresAt: null,
          error: null,
        });
      }
    });

    // Listen for network recovery
    const handleOnline = () => {
      log("Browser came online");
      handleNetworkRecovery();
    };

    window.addEventListener("online", handleOnline);

    // Visibility change - check session when app comes to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        log("App became visible, checking session");
        forceSessionCheck();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearRefreshTimer();
      subscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearRefreshTimer, forceSessionCheck, handleNetworkRecovery, log, scheduleProactiveRefresh]);

  return {
    status,
    refreshSession,
    forceSessionCheck,
  };
};
