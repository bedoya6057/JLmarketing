import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { eventLogger, EventType, EventSeverity } from "@/lib/eventLogger";

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string>("unknown");

  useEffect(() => {
    // Check initial status
    const checkStatus = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        setNetworkType(status.connectionType);
        
        eventLogger.log(
          status.connected ? EventType.NETWORK_ONLINE : EventType.NETWORK_OFFLINE,
          `Estado de red inicial: ${status.connected ? 'conectado' : 'desconectado'}`,
          { context: { connectionType: status.connectionType } }
        );
      } catch (error) {
        // Fallback to browser API
        const online = navigator.onLine;
        setIsOnline(online);
        setNetworkType("unknown");
        
        eventLogger.log(
          online ? EventType.NETWORK_ONLINE : EventType.NETWORK_OFFLINE,
          `Estado de red inicial (fallback): ${online ? 'conectado' : 'desconectado'}`,
          { context: { connectionType: "unknown" } }
        );
      }
    };

    checkStatus();

    // Listen for network changes
    let networkListener: any;
    const setupListener = async () => {
      try {
        networkListener = await Network.addListener("networkStatusChange", (status) => {
          setIsOnline(status.connected);
          setNetworkType(status.connectionType);
          
          eventLogger.log(
            status.connected ? EventType.NETWORK_ONLINE : EventType.NETWORK_OFFLINE,
            `Cambio de estado de red: ${status.connected ? 'conectado' : 'desconectado'}`,
            { context: { connectionType: status.connectionType } }
          );
        });
      } catch (error) {
        // Fallback to browser events
        const handleOnline = () => {
          setIsOnline(true);
          eventLogger.log(EventType.NETWORK_ONLINE, 'Red conectada (evento browser)', {
            context: { connectionType: "unknown" }
          });
        };
        const handleOffline = () => {
          setIsOnline(false);
          eventLogger.log(EventType.NETWORK_OFFLINE, 'Red desconectada (evento browser)', {
            context: { connectionType: "unknown" }
          });
        };
        
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
          window.removeEventListener("online", handleOnline);
          window.removeEventListener("offline", handleOffline);
        };
      }
    };

    setupListener();

    return () => {
      if (networkListener) {
        networkListener.remove();
      }
    };
  }, []);

  return { isOnline, networkType };
};
