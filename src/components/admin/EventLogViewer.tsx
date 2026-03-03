import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Trash2, RefreshCw, Search } from "lucide-react";
import { EventType, EventSeverity, LogEvent } from "@/lib/eventLogger";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ExtendedLogEvent extends LogEvent {
  userName?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EventLogViewer = () => {
  const [events, setEvents] = useState<ExtendedLogEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<ExtendedLogEvent[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<any>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Combined UUID -> human-readable name cache
  const uuidCacheRef = useRef<Record<string, string>>({});

  const loadEvents = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('event_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Collect ALL UUID-like values from user_id and every context field
      const allUuids = new Set<string>();
      (data || []).forEach((log) => {
        if (log.user_id) allUuids.add(log.user_id);
        const ctx = (log.context || {}) as Record<string, any>;
        Object.values(ctx).forEach((val) => {
          if (typeof val === 'string' && UUID_REGEX.test(val)) {
            allUuids.add(val);
          }
        });
      });

      // Only fetch UUIDs we haven't resolved yet
      const unknownUuids = [...allUuids].filter(id => !(id in uuidCacheRef.current));

      if (unknownUuids.length > 0) {
        // Query all tables in parallel to resolve any UUID
        const [profilesRes, encartesRes, exhibicionesRes, productosRes, productosExhRes] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", unknownUuids),
          supabase.from("encartes").select("id, nombre").in("id", unknownUuids),
          supabase.from("exhibiciones").select("id, nombre").in("id", unknownUuids),
          supabase.from("productos").select("id, descripcion_producto_carteleria, cod_interno").in("id", unknownUuids),
          supabase.from("productos_exhibicion").select("id, descripcion_producto, cod_producto").in("id", unknownUuids),
        ]);

        const newEntries: Record<string, string> = {};

        (profilesRes.data || []).forEach((p: any) => {
          const name = (p.full_name || "").trim();
          if (name) newEntries[p.id] = name;
        });
        (encartesRes.data || []).forEach((e: any) => {
          if (e.nombre) newEntries[e.id] = e.nombre;
        });
        (exhibicionesRes.data || []).forEach((e: any) => {
          if (e.nombre && !newEntries[e.id]) newEntries[e.id] = e.nombre;
        });
        (productosRes.data || []).forEach((p: any) => {
          const label = p.cod_interno
            ? `${p.cod_interno} - ${p.descripcion_producto_carteleria}`
            : p.descripcion_producto_carteleria;
          if (label) newEntries[p.id] = label;
        });
        (productosExhRes.data || []).forEach((p: any) => {
          const label = p.cod_producto
            ? `${p.cod_producto} - ${p.descripcion_producto}`
            : p.descripcion_producto;
          if (label && !newEntries[p.id]) newEntries[p.id] = label;
        });

        uuidCacheRef.current = { ...uuidCacheRef.current, ...newEntries };
      }

      const cache = uuidCacheRef.current;

      const resolveUserLabel = (log: any) => {
        if (!log.user_id) return "Sistema";
        if (cache[log.user_id]) return cache[log.user_id];

        const ctx = (log.context || {}) as Record<string, any>;
        const fromContext =
          (typeof ctx.userName === "string" && ctx.userName.trim()) ||
          (typeof ctx.full_name === "string" && ctx.full_name.trim()) ||
          (typeof ctx.userEmail === "string" && ctx.userEmail.trim()) ||
          (typeof ctx.email === "string" && ctx.email.trim());
        if (fromContext) return fromContext;

        return `Usuario ${String(log.user_id).slice(0, 8)}…`;
      };

      const allEvents: ExtendedLogEvent[] = (data || []).map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        type: log.type as EventType,
        severity: log.severity as EventSeverity,
        message: log.message,
        context: log.context as Record<string, any> | undefined,
        userId: log.user_id || undefined,
        userName: resolveUserLabel(log),
        stackTrace: log.stack_trace || undefined,
      }));

      setEvents(allEvents);
      setFilteredEvents(allEvents);

      // Calcular estadísticas
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const twentyFourHours = 24 * oneHour;

      setStats({
        total: allEvents.length,
        lastHour: allEvents.filter(e => now - e.timestamp < oneHour).length,
        last24Hours: allEvents.filter(e => now - e.timestamp < twentyFourHours).length,
        bySeverity: allEvents.reduce((acc, e) => {
          acc[e.severity] = (acc[e.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
    } catch (error: any) {
      console.error('Error loading events:', error);
      toast.error('Error al cargar los logs');
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  /** Resolve all UUID values in a context object to human-readable names */
  const resolveContext = (context: Record<string, any>): Record<string, any> => {
    const cache = uuidCacheRef.current;
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string' && UUID_REGEX.test(value) && cache[value]) {
        resolved[key] = cache[value];
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = [...events];
    if (filterType !== "all") {
      filtered = filtered.filter(e => e.type === filterType);
    }
    if (filterSeverity !== "all") {
      filtered = filtered.filter(e => e.severity === filterSeverity);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.message.toLowerCase().includes(query) ||
        JSON.stringify(e.context).toLowerCase().includes(query)
      );
    }
    setFilteredEvents(filtered);
  }, [events, filterType, filterSeverity, searchQuery]);

  const handleExport = () => {
    const data = JSON.stringify(filteredEvents, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exportados");
  };

  const handleClear = async () => {
    if (confirm("¿Estás seguro de que quieres eliminar todos los logs?")) {
      try {
        const { error } = await supabase
          .from('event_logs')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        await loadEvents();
        toast.success("Logs eliminados");
      } catch (error: any) {
        console.error('Error deleting logs:', error);
        toast.error('Error al eliminar los logs');
      }
    }
  };

  const getSeverityColor = (severity: EventSeverity): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case EventSeverity.ERROR: return "destructive";
      case EventSeverity.WARNING: return "outline";
      case EventSeverity.SUCCESS: return "default";
      default: return "secondary";
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Eventos</CardDescription>
            <CardTitle className="text-3xl">{stats.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última Hora</CardDescription>
            <CardTitle className="text-3xl">{stats.lastHour || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Últimas 24h</CardDescription>
            <CardTitle className="text-3xl">{stats.last24Hours || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Errores</CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {stats.bySeverity?.error || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Log Viewer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registro de Eventos</CardTitle>
              <CardDescription>Historial de eventos de la aplicación</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadEvents} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Actualizando...' : 'Actualizar'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClear}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.values(EventType).map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las severidades</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="success">Success</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Event List */}
          <ScrollArea className="h-[600px] rounded-md border">
            <div className="p-4 space-y-2">
              {filteredEvents.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No hay eventos que mostrar
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <Card key={event.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={getSeverityColor(event.severity)}>
                              {event.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              👤 {event.userName || "Sistema"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                          <p className="font-medium text-sm">{event.message}</p>
                        </div>
                      </div>

                      {event.context && Object.keys(event.context).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Ver detalles
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                            {JSON.stringify(resolveContext(event.context), null, 2)}
                          </pre>
                        </details>
                      )}

                      {event.stackTrace && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-destructive hover:text-destructive/80">
                            Ver stack trace
                          </summary>
                          <pre className="mt-2 p-2 bg-destructive/10 rounded overflow-x-auto text-destructive">
                            {event.stackTrace}
                          </pre>
                        </details>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
