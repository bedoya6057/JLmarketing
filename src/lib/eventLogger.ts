/**
 * Sistema de logging de eventos para la aplicación
 * Registra eventos importantes con timestamps y contexto
 */

import { supabase } from "@/integrations/supabase/client";

export enum EventType {
  // Auth events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  AUTH_ERROR = 'AUTH_ERROR',
  
  // Network events
  NETWORK_ONLINE = 'NETWORK_ONLINE',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  
  // Data events
  SAVE_SUCCESS = 'SAVE_SUCCESS',
  SAVE_ERROR = 'SAVE_ERROR',
  SAVE_OFFLINE = 'SAVE_OFFLINE',
  
  // Sync events
  SYNC_START = 'SYNC_START',
  SYNC_SUCCESS = 'SYNC_SUCCESS',
  SYNC_ERROR = 'SYNC_ERROR',
  SYNC_ITEM_SUCCESS = 'SYNC_ITEM_SUCCESS',
  SYNC_ITEM_ERROR = 'SYNC_ITEM_ERROR',
  
  // Form events
  FORM_SUBMIT = 'FORM_SUBMIT',
  FORM_ERROR = 'FORM_ERROR',
  PHOTO_UPLOAD = 'PHOTO_UPLOAD',
  PHOTO_ERROR = 'PHOTO_ERROR',
  
  // General errors
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export enum EventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success'
}

export interface LogEvent {
  id: string;
  timestamp: number;
  type: EventType;
  severity: EventSeverity;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  stackTrace?: string;
}

class EventLogger {
  private events: LogEvent[] = [];
  private maxEvents = 1000; // Máximo de eventos en memoria
  private storageKey = 'app_event_logs';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Registra un evento
   */
  log(
    type: EventType,
    message: string,
    options?: {
      severity?: EventSeverity;
      context?: Record<string, any>;
      userId?: string;
      error?: Error;
    }
  ): void {
    const event: LogEvent = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      severity: options?.severity || this.getDefaultSeverity(type),
      message,
      context: options?.context,
      userId: options?.userId,
      stackTrace: options?.error?.stack
    };

    this.events.push(event);
    
    // Mantener solo los últimos maxEvents
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.saveToStorage();
    this.consoleLog(event);
    
    // Guardar en Supabase de forma asíncrona sin bloquear
    this.saveToSupabase(event);
  }

  /**
    * Guarda un evento en Supabase
    */
  private async saveToSupabase(event: LogEvent): Promise<void> {
    // No guardar eventos de red en el servidor (solo generar ruido y costo)
    if (event.type === EventType.NETWORK_ONLINE || event.type === EventType.NETWORK_OFFLINE) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('event_logs').insert({
        timestamp: event.timestamp,
        type: event.type,
        severity: event.severity,
        message: event.message,
        context: event.context,
        user_id: event.userId || user?.id,
        stack_trace: event.stackTrace
      });
    } catch (error) {
      // No hacer nada para evitar loops de logging
    }
  }

  /**
   * Obtiene todos los eventos
   */
  getEvents(filter?: {
    type?: EventType;
    severity?: EventSeverity;
    startDate?: number;
    endDate?: number;
    userId?: string;
  }): LogEvent[] {
    let filtered = [...this.events];

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        filtered = filtered.filter(e => e.severity === filter.severity);
      }
      if (filter.startDate) {
        filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
      }
      if (filter.userId) {
        filtered = filtered.filter(e => e.userId === filter.userId);
      }
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Obtiene eventos recientes
   */
  getRecentEvents(limit: number = 50): LogEvent[] {
    return this.events.slice(-limit).reverse();
  }

  /**
   * Limpia todos los eventos
   */
  clearEvents(): void {
    this.events = [];
    this.saveToStorage();
    console.log('[EventLogger] Eventos limpiados');
  }

  /**
   * Exporta eventos como JSON
   */
  exportEvents(filter?: Parameters<typeof this.getEvents>[0]): string {
    const events = filter ? this.getEvents(filter) : this.events;
    return JSON.stringify(events, null, 2);
  }

  /**
   * Obtiene estadísticas de eventos
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    lastHour: number;
    last24Hours: number;
  } {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const twentyFourHours = 24 * oneHour;

    return {
      total: this.events.length,
      byType: this.countByProperty('type'),
      bySeverity: this.countByProperty('severity'),
      lastHour: this.events.filter(e => now - e.timestamp < oneHour).length,
      last24Hours: this.events.filter(e => now - e.timestamp < twentyFourHours).length
    };
  }

  private countByProperty(property: keyof LogEvent): Record<string, number> {
    return this.events.reduce((acc, event) => {
      const key = String(event[property]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultSeverity(type: EventType): EventSeverity {
    if (type.includes('ERROR')) return EventSeverity.ERROR;
    if (type.includes('WARNING')) return EventSeverity.WARNING;
    if (type.includes('SUCCESS')) return EventSeverity.SUCCESS;
    return EventSeverity.INFO;
  }

  private consoleLog(event: LogEvent): void {
    const prefix = `[${event.type}]`;
    const timestamp = new Date(event.timestamp).toISOString();
    const message = `${prefix} ${timestamp} - ${event.message}`;

    switch (event.severity) {
      case EventSeverity.ERROR:
        console.error(message, event.context);
        if (event.stackTrace) console.error(event.stackTrace);
        break;
      case EventSeverity.WARNING:
        console.warn(message, event.context);
        break;
      case EventSeverity.SUCCESS:
        console.log(`✅ ${message}`, event.context);
        break;
      default:
        console.log(message, event.context);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch (error) {
      console.error('[EventLogger] Error guardando eventos:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[EventLogger] Error cargando eventos:', error);
      this.events = [];
    }
  }
}

// Instancia singleton
export const eventLogger = new EventLogger();

// Helper functions para uso común
export const logInfo = (message: string, context?: Record<string, any>) => {
  eventLogger.log(EventType.INFO, message, { severity: EventSeverity.INFO, context });
};

export const logWarning = (message: string, context?: Record<string, any>) => {
  eventLogger.log(EventType.WARNING, message, { severity: EventSeverity.WARNING, context });
};

export const logError = (message: string, error?: Error, context?: Record<string, any>) => {
  eventLogger.log(EventType.ERROR, message, { 
    severity: EventSeverity.ERROR, 
    error,
    context 
  });
};

export const logSuccess = (message: string, context?: Record<string, any>) => {
  eventLogger.log(EventType.INFO, message, { severity: EventSeverity.SUCCESS, context });
};
