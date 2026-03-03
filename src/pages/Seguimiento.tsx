import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Users, Wifi, WifiOff, Activity, Store, Clock, User, LogIn } from "lucide-react";
import { toast } from "sonner";
import { usePresence, UserPresence } from "@/contexts/PresenceContext";

type RegisteredUserRow = {
  userId: string;
  fullName: string | null;
  role: string | null;
  lastActivityAt: number | null;
  lastActivityType: string | null;
  isActive: boolean;
};

const Seguimiento = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Global presence from context
  const { onlineUsers, isConnected } = usePresence();

  // All registered users with their last login
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserRow[]>([]);
  const [registeredUpdatedAt, setRegisteredUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    // Run once immediately
    checkAuth();

    // If the page loads before the session is fully hydrated (common on mobile/webview),
    // we re-check on auth events.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        checkAuth();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Seguimiento: getSession error", sessionError);
      }

      if (!session?.user) {
        navigate("/login");
        return;
      }

      setUserEmail(session.user.email);

      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roleError) {
        console.error("Seguimiento: role lookup error", roleError);
      }

      if (userRole?.role !== "admin") {
        navigate("/encuestador");
        return;
      }

      setLoading(false);
    } catch (err) {
      console.error("Seguimiento: checkAuth failed", err);
      toast.error("No se pudo validar la sesión.");
      navigate("/login");
    }
  };

  const handleRefresh = () => {
    setLastUpdate(new Date());
    fetchRegisteredUsers();
    toast.success("Actualizado");
  };

  const getActivityBadge = (activity: UserPresence["activity"]) => {
    switch (activity.type) {
      case "encarte":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Encarte</Badge>;
      case "exhibicion":
        return <Badge className="bg-purple-500 hover:bg-purple-600">Exhibición</Badge>;
      default:
        return <Badge variant="secondary">Sin actividad</Badge>;
    }
  };

  const getTimeSince = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return "Hace un momento";
    if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} hrs`;
    return `Hace ${Math.floor(diffSec / 86400)} días`;
  };

  const getTimeSinceMs = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return "Hace un momento";
    if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} hrs`;
    return `Hace ${Math.floor(diffSec / 86400)} días`;
  };



  // Fetch ALL registered users with their last login
  const fetchRegisteredUsers = useCallback(async () => {
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true });

    if (profilesError) {
      console.error("Seguimiento: profiles error", profilesError);
      return;
    }

    // Get all user_roles for is_active status
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role, is_active");

    if (rolesError) {
      console.error("Seguimiento: user_roles error", rolesError);
    }

    const activeById = new Map<string, { role: string; isActive: boolean }>();
    for (const ur of userRoles || []) {
      activeById.set(ur.user_id, { role: ur.role, isActive: ur.is_active });
    }

    // Get last activity event for each user (LOGIN, SAVE_SUCCESS, SYNC_SUCCESS, SYNC_START, etc.)
    const { data: activityLogs, error: activityError } = await supabase
      .from("event_logs")
      .select("user_id, timestamp, type")
      .in("type", ["LOGIN", "SAVE_SUCCESS", "SAVE_OFFLINE", "SYNC_START", "SYNC_SUCCESS", "SYNC_ITEM_SUCCESS", "PHOTO_UPLOAD", "FORM_SUBMIT"])
      .order("timestamp", { ascending: false })
      .limit(2000);

    if (activityError) {
      console.error("Seguimiento: activity logs error", activityError);
    }

    const lastActivityById = new Map<string, { timestamp: number; type: string }>();
    for (const log of activityLogs || []) {
      if (log.user_id && !lastActivityById.has(log.user_id)) {
        lastActivityById.set(log.user_id, { timestamp: log.timestamp, type: log.type });
      }
    }

    const users: RegisteredUserRow[] = (profiles || []).map((p) => {
      const roleInfo = activeById.get(p.id);
      const activity = lastActivityById.get(p.id);
      return {
        userId: p.id,
        fullName: p.full_name,
        role: roleInfo?.role || p.role,
        lastActivityAt: activity?.timestamp || null,
        lastActivityType: activity?.type || null,
        isActive: roleInfo?.isActive ?? true,
      };
    });

    // Sort by last activity (most recent first), users without activity at the end
    users.sort((a, b) => {
      if (a.lastActivityAt && b.lastActivityAt) return b.lastActivityAt - a.lastActivityAt;
      if (a.lastActivityAt) return -1;
      if (b.lastActivityAt) return 1;
      return (a.fullName || "").localeCompare(b.fullName || "");
    });

    setRegisteredUsers(users);
    setRegisteredUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    if (loading) return;

    fetchRegisteredUsers();
    const t = window.setInterval(fetchRegisteredUsers, 60000); // refresh every minute
    return () => window.clearInterval(t);
  }, [fetchRegisteredUsers, loading]);

  // Filter users working (not idle)
  const workingUsers = useMemo(() => onlineUsers.filter((u) => u.activity.type !== "idle"), [onlineUsers]);
  const idleUsers = useMemo(() => onlineUsers.filter((u) => u.activity.type === "idle"), [onlineUsers]);

  // Users who had activity recently (last 24 hours)
  const recentlyActive = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return registeredUsers.filter((u) => u.lastActivityAt && u.lastActivityAt > oneDayAgo);
  }, [registeredUsers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader userEmail={userEmail} />
      <main className="container px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard Admin
            </Button>
            <h1 className="text-2xl font-bold">Seguimiento en Tiempo Real</h1>
            {isConnected ? (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                <Wifi className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                <WifiOff className="h-3 w-3 mr-1" />
                Desconectado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastUpdate.toLocaleTimeString()}
            </span>
            <Button onClick={handleRefresh} size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Registrados</p>
                  <p className="text-3xl font-bold">{registeredUsers.length}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Activos últimas 24h</p>
                  <p className="text-3xl font-bold text-blue-600">{recentlyActive.length}</p>
                </div>
                <LogIn className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Trabajando (RT)</p>
                  <p className="text-3xl font-bold text-green-600">{workingUsers.length}</p>
                </div>
                <Activity className="h-8 w-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ALL REGISTERED USERS - Primary Section */}
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Todos los Usuarios Registrados
                <Badge className="bg-blue-500">{registeredUsers.length}</Badge>
              </span>
              <div className="flex items-center gap-2">
                {registeredUpdatedAt && (
                  <span className="text-xs text-muted-foreground">
                    Actualizado: {registeredUpdatedAt.toLocaleTimeString()}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={fetchRegisteredUsers}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {registeredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No se encontraron usuarios registrados</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {registeredUsers.map((user) => {
                  const isRecentlyActive = user.lastActivityAt && Date.now() - user.lastActivityAt < 30 * 60 * 1000;
                  const isActiveToday = user.lastActivityAt && Date.now() - user.lastActivityAt < 24 * 60 * 60 * 1000;
                  return (
                    <div
                      key={user.userId}
                      className={`flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border p-3 ${isRecentlyActive
                        ? "border-green-200 bg-green-50/50 dark:bg-green-950/20"
                        : isActiveToday
                          ? "border-blue-100 bg-blue-50/30 dark:bg-blue-950/10"
                          : ""
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${isRecentlyActive ? "bg-green-500" : "bg-gray-400"
                              }`}
                          >
                            {(user.fullName?.trim()[0] || "U").toUpperCase()}
                          </div>
                          {isRecentlyActive && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-white animate-pulse" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{user.fullName || `Usuario ${user.userId.slice(0, 8)}`}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {user.role || "sin rol"}
                            </Badge>
                            {user.lastActivityType && (
                              <Badge variant="secondary" className="text-xs">
                                {user.lastActivityType}
                              </Badge>
                            )}
                            {!user.isActive && (
                              <Badge variant="destructive" className="text-xs">
                                Inactivo
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {user.lastActivityAt ? (
                          <span className={isRecentlyActive ? "text-green-600 font-medium" : ""}>
                            {getTimeSinceMs(user.lastActivityAt)}
                          </span>
                        ) : (
                          <span className="italic">Sin actividad registrada</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Working Users - Realtime Section */}
        <Card className="border-2 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-green-500" />
              Usuarios Trabajando Ahora (Realtime)
              {workingUsers.length > 0 && <Badge className="bg-green-500">{workingUsers.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workingUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No hay usuarios trabajando en este momento (vía Realtime)</p>
                <p className="text-sm mt-1">Consulta los paneles de fallback abajo para ver actividad detectada por DB</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 rounded-lg border-2 border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-900"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const displayName = user.email || user.fullName || `Usuario ${user.id.slice(0, 8)}`;
                          const initial = (displayName.trim()[0] || "U").toUpperCase();

                          return (
                            <>
                              <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                                  {initial}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white animate-pulse" />
                              </div>
                              <div>
                                <p className="font-semibold">{displayName}</p>
                                <p className="text-xs text-muted-foreground">{getTimeSince(user.lastSeen)}</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                        <div>{getActivityBadge(user.activity)}</div>

                        {user.activity.studyName && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px]" title={user.activity.studyName}>
                              {user.activity.studyName}
                            </span>
                          </div>
                        )}

                        {user.activity.tienda && (
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{user.activity.tienda}</span>
                          </div>
                        )}

                        {user.activity.totalProducts && user.activity.totalProducts > 0 && (
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <Progress value={user.activity.progress || 0} className="h-3 flex-1" />
                            <div className="text-right">
                              <span className="text-lg font-bold text-green-600">{user.activity.progress || 0}%</span>
                              <p className="text-xs text-muted-foreground">
                                {user.activity.currentProductIndex || 0} / {user.activity.totalProducts}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Idle Users */}
        {idleUsers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
                <User className="h-5 w-5" />
                Usuarios Conectados (Sin Actividad)
                <Badge variant="secondary">{idleUsers.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {idleUsers.map((user) => {
                  const displayName = user.email || user.fullName || `Usuario ${user.id.slice(0, 8)}`;
                  return (
                    <div key={user.id} className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 border">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-sm">{displayName}</span>
                      <span className="text-xs text-muted-foreground">{getTimeSince(user.lastSeen)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  );
};

export default Seguimiento;
