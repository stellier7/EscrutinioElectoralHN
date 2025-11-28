'use client';

import React, { useState, useEffect } from 'react';
import { User, Vote, RefreshCw } from 'lucide-react';
import Button from './ui/Button';

interface ActivityEvent {
  id: string;
  type: 'volunteer_registration' | 'legislative_scrutiny';
  userName: string;
  timestamp: string;
  message: string;
}

interface GlimpseResponse {
  success: boolean;
  events: ActivityEvent[];
  error?: string;
}

export default function ActivityGlimpse() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchEvents = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      }
      const response = await fetch('/api/activity/glimpse');
      const data: GlimpseResponse = await response.json();
      
      if (data.success && data.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching activity glimpse:', error);
      // Manejo silencioso de errores - no mostrar al usuario
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Fetch inicial
    fetchEvents();

    // Polling cada 60 segundos
    const interval = setInterval(() => {
      fetchEvents();
    }, 60000);

    // Cleanup
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchEvents(true);
  };

  // Formatear tiempo relativo
  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const eventTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - eventTime.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'hace unos segundos';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `hace ${days} día${days > 1 ? 's' : ''}`;
    }
  };

  // No mostrar nada si está cargando y no hay eventos
  if (isLoading && events.length === 0) {
    return (
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Actividad Reciente</h3>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No mostrar nada si no hay eventos
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Actividad Reciente</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="min-w-[auto] px-2 py-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="space-y-2">
          {events.map((event) => {
            const isVolunteer = event.type === 'volunteer_registration';
            return (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg cursor-default select-none animate-fade-in"
                style={{ pointerEvents: 'none' }}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className={`p-1.5 rounded-md flex-shrink-0 ${
                    isVolunteer ? 'bg-blue-100' : 'bg-green-100'
                  }`}>
                    {isVolunteer ? (
                      <User className="h-3.5 w-3.5 text-blue-600" />
                    ) : (
                      <Vote className="h-3.5 w-3.5 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {event.userName}
                    </p>
                    <p className="text-xs text-gray-600 leading-tight">
                      {isVolunteer 
                        ? 'Se registró como voluntario'
                        : 'Hizo un escrutinio legislativo'
                      }
                    </p>
                    <p className="text-xs text-gray-500 leading-tight">
                      {formatTimeAgo(event.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

