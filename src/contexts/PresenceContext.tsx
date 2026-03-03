import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface UserActivity {
  type: "idle" | "encarte" | "exhibicion";
  studyName?: string;
  tienda?: string;
  currentProductIndex?: number;
  totalProducts?: number;
  progress?: number;
}

export interface UserPresence {
  id: string;
  email: string;
  fullName: string;
  lastSeen: string;
  activity: UserActivity;
}

interface PresenceContextType {
  onlineUsers: UserPresence[];
  isConnected: boolean;
  trackActivity: (activity: UserActivity) => Promise<void>;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    // Return a no-op version if used outside provider
    return {
      onlineUsers: [],
      isConnected: false,
      trackActivity: async () => { },
    };
  }
  return context;
};

type PresencePayload = Omit<UserPresence, "id">;

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentActivityRef = useRef<UserActivity>({ type: "idle" });
  const isConnectedRef = useRef(false);
  const trackTimeoutRef = useRef<number | null>(null);

  const userIdRef = useRef<string | null>(null);
  const userEmailRef = useRef<string>("");
  const userFullNameRef = useRef<string>("");

  // Defensive grace period handled inside syncUsers
  // to avoid the Seguimiento UI “flashing” when users update presence.

  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  const buildUsersFromState = useCallback((state: Record<string, any[]>): UserPresence[] => {
    const users: UserPresence[] = [];

    const extractPayload = (p: any): PresencePayload | null => {
      if (!p || typeof p !== "object") return null;

      // supabase-js can wrap tracked presence inside different keys depending on version
      const candidate =
        "payload" in p
          ? (p as any).payload
          : "metas" in p
            ? (p as any).metas
            : "meta" in p
              ? (p as any).meta
              : p;

      if (!candidate || typeof candidate !== "object") return null;

      // Some versions nest again
      const nested =
        "payload" in candidate
          ? (candidate as any).payload
          : "data" in candidate
            ? (candidate as any).data
            : candidate;

      return nested as PresencePayload;
    };

    Object.entries(state).forEach(([id, presences]) => {
      if (!presences || presences.length === 0) return;

      const latest = extractPayload(presences[presences.length - 1]);

      // Si Supabase devuelve un payload vacío o erróneo en medio del flickering,
      // la ignoramos totalmente. Así evitamos insertarlo con { type: "idle" } 
      // y permitimos que el Grace Period actúe para mantener su estado anterior real.
      if (!latest || !latest.activity) return;

      const email = latest.email || "";

      users.push({
        id,
        email,
        fullName: latest.fullName || (email ? email.split("@")[0] : `Usuario ${id.slice(0, 8)}`),
        lastSeen: latest.lastSeen || new Date().toISOString(),
        activity: latest.activity,
      });
    });

    // Keep deterministic order even if email is missing
    users.sort((a, b) => (a.email || a.id).localeCompare(b.email || b.id));
    return users;
  }, []);


  const safeClearReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const trackActivity = useCallback(async (activity: UserActivity) => {
    currentActivityRef.current = activity;

    if (trackTimeoutRef.current) {
      window.clearTimeout(trackTimeoutRef.current);
    }

    trackTimeoutRef.current = window.setTimeout(async () => {
      if (channelRef.current && isConnectedRef.current) {
        const userPresence: PresencePayload = {
          email: userEmailRef.current,
          fullName: userFullNameRef.current,
          lastSeen: new Date().toISOString(),
          activity: currentActivityRef.current,
        };

        try {
          await channelRef.current.track(userPresence);
        } catch (error) {
          console.error("Error tracking presence:", error);
        }
      }
    }, 1500);
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncUsers = (channel?: RealtimeChannel) => {
      if (!mounted) return;
      const ch = channel || channelRef.current;
      if (!ch) return;

      const state = ch.presenceState();
      const newUsers = buildUsersFromState(state);

      setOnlineUsers((prevUsers) => {
        const now = Date.now();
        const nextUserMap = new Map<string, any>();

        // 1. Agregar todos los usuarios activos del estado actual de Supabase
        newUsers.forEach((u) => {
          nextUserMap.set(u.id, { ...u, _lastSeenLocal: now });
        });

        // 2. Si un usuario anterior no está en el nuevo estado, 
        // conservarlo si desapareció hace menos de 4000ms (Grace period anti-flickering).
        prevUsers.forEach((pu) => {
          if (!nextUserMap.has(pu.id)) {
            const lastSeenLocal = (pu as any)._lastSeenLocal || now;
            if (now - lastSeenLocal < 5000) {
              nextUserMap.set(pu.id, pu);
            }
          }
        });

        const finalUsers = Array.from(nextUserMap.values());
        finalUsers.sort((a, b) => (a.email || a.id).localeCompare(b.email || b.id));

        // 3. DEEP EQUALITY CHECK para evitar que react deseche el DOM
        // Comparamos identificadores, fechas reducidas y porcentajes. Si son iguales, devolver la misma REF en memoria.
        const stringifySubset = (users: any[]) =>
          JSON.stringify(users.map(u => ({
            id: u.id,
            type: u.activity?.type,
            pct: u.activity?.progress,
            tienda: u.activity?.tienda,
            studyName: u.activity?.studyName,
            cPI: u.activity?.currentProductIndex
          })));

        const nextStr = stringifySubset(finalUsers);
        const prevStr = stringifySubset(prevUsers);

        if (nextStr === prevStr) {
          // Si nada "visual" ha cambiado (solo timestamps de latidos), abortar re-render
          return prevUsers;
        }

        if (finalUsers.length !== prevUsers.length) {
          console.log("🟢 Presence sync (anti-flicker): Cambió conteo", prevUsers.length, "->", finalUsers.length);
        }

        return finalUsers as UserPresence[];
      });
    };

    const teardown = async () => {
      safeClearReconnect();
      if (channelRef.current) {
        try {
          await supabase.removeChannel(channelRef.current);
        } finally {
          channelRef.current = null;
        }
      }
      setIsConnected(false);
      isConnectedRef.current = false;
    };

    const scheduleReconnect = (reason: string) => {
      if (!mounted) return;
      // If we're already scheduled, don't stack timers
      if (reconnectTimerRef.current) return;

      setIsConnected(false);
      isConnectedRef.current = false;

      const attempt = reconnectAttemptRef.current;
      // Exponential backoff: 1s, 2s, 4s, ... up to 30s
      const delayMs = Math.min(30000, 1000 * Math.pow(2, attempt));
      reconnectAttemptRef.current = Math.min(10, attempt + 1);

      console.warn(`🔁 Presence reconnect scheduled in ${delayMs}ms (attempt ${attempt + 1}) — reason: ${reason}`);

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        setupPresence("reconnect");
      }, delayMs);
    };

    const setupPresence = async (source: "mount" | "auth" | "reconnect" | "online" = "mount") => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user || !mounted) return;

        // reset backoff once we have a valid session and attempt a fresh connect
        safeClearReconnect();

        userIdRef.current = session.user.id;
        userEmailRef.current = session.user.email || "";
        userFullNameRef.current = session.user.email?.split("@")[0] || "Usuario";

        // Clean up existing channel if any
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase.channel("global-presence", {
          config: {
            presence: {
              key: session.user.id,
            },
          },
        });

        channelRef.current = channel;

        const isStaleChannel = () => channelRef.current !== channel;

        channel
          .on("presence", { event: "sync" }, () => {
            if (isStaleChannel()) return;
            syncUsers(channel);
          })
          .on("presence", { event: "join" }, ({ key }) => {
            if (isStaleChannel()) return;
            console.log("🟢 User joined:", key);
            syncUsers(channel);
          })
          .on("presence", { event: "leave" }, ({ key }) => {
            if (isStaleChannel()) return;
            console.log("🔴 User left:", key);
            syncUsers(channel);
          })
          .subscribe(async (status: string) => {
            if (!mounted || isStaleChannel()) return;

            console.log("🔵 Presence channel status:", status, `(source: ${source})`);

            if (status === "SUBSCRIBED") {
              setIsConnected(true);
              isConnectedRef.current = true;
              reconnectAttemptRef.current = 0;

              try {
                await channel.track({
                  email: userEmailRef.current,
                  fullName: userFullNameRef.current,
                  lastSeen: new Date().toISOString(),
                  activity: currentActivityRef.current,
                });
                console.log("✅ Initial presence tracked");

                // Defensive: some clients miss the first "presence:sync" event.
                // Pull state shortly after tracking so Seguimiento never stays empty.
                window.setTimeout(() => {
                  if (!mounted || isStaleChannel()) return;
                  syncUsers(channel);
                }, 500);
              } catch (error) {
                console.error("Error tracking initial presence:", error);
              }
            }

            // Reconnect only on real failures/timeouts.
            // "CLOSED" can be emitted during normal lifecycle (tab background / intentional removeChannel),
            // and reconnecting on it can create a connect/disconnect loop.
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.error("❌ Presence channel error:", status);
              scheduleReconnect(status);
            }
          });
      } catch (e) {
        console.error("❌ Presence setup failed:", e);
        scheduleReconnect("setup_failed");
      }
    };

    // Setup on mount
    setupPresence("mount");

    // Listen for browser network regain to reconnect quickly
    const handleOnline = () => {
      scheduleReconnect("browser_online");
      // scheduleReconnect calls setupPresence via timer; if we want immediate attempt after online:
      safeClearReconnect();
      reconnectAttemptRef.current = 0;
      setupPresence("online");
    };
    window.addEventListener("online", handleOnline);

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session) => {
      console.log("🔐 Auth state change:", event);
      if (event === "SIGNED_IN" && session) {
        reconnectAttemptRef.current = 0;
        setupPresence("auth");
      } else if (event === "SIGNED_OUT") {
        teardown();
        setOnlineUsers([]);
        userIdRef.current = null;
        userEmailRef.current = "";
        userFullNameRef.current = "";
      }
    });

    // Heartbeat to keep presence fresh
    const heartbeatInterval = window.setInterval(() => {
      if (channelRef.current && isConnectedRef.current) {
        trackActivity(currentActivityRef.current);
      }
    }, 20000); // Every 20 seconds

    // Safety net: poll presenceState periodically.
    // Some environments miss presence events, so this ensures Seguimiento eventually reflects reality.
    const presencePollInterval = window.setInterval(() => {
      if (!mounted) return;
      if (channelRef.current && isConnectedRef.current) {
        syncUsers(channelRef.current);
      }
    }, 5000);

    return () => {
      mounted = false;
      safeClearReconnect();
      if (trackTimeoutRef.current) {
        window.clearTimeout(trackTimeoutRef.current);
      }
      window.removeEventListener("online", handleOnline);
      window.clearInterval(heartbeatInterval);
      window.clearInterval(presencePollInterval);
      subscription.unsubscribe();
      teardown();
    };
  }, [buildUsersFromState, safeClearReconnect, trackActivity]);

  return (
    <PresenceContext.Provider value={{ onlineUsers, isConnected, trackActivity }}>
      {children}
    </PresenceContext.Provider>
  );
};
