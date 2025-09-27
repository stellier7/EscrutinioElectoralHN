import React from 'react';
import { Clock, Lock, Unlock, User, MapPin } from 'lucide-react';

interface Checkpoint {
  id: string;
  action: 'FREEZE' | 'UNFREEZE';
  votesSnapshot: any;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracy?: number;
}

interface CheckpointTimelineProps {
  checkpoints: Checkpoint[];
  escrutinioStartedAt?: string;
  escrutinioCompletedAt?: string;
}

export function CheckpointTimeline({ checkpoints, escrutinioStartedAt, escrutinioCompletedAt }: CheckpointTimelineProps) {
  // Crear timeline con todos los eventos
  const timeline = [];
  
  // Agregar inicio de escrutinio
  if (escrutinioStartedAt) {
    timeline.push({
      id: 'start',
      type: 'start',
      timestamp: new Date(escrutinioStartedAt),
      title: 'Escrutinio Iniciado',
      description: 'Conteo de votos comenzado',
      icon: <Clock className="h-4 w-4" />,
      color: 'bg-blue-500'
    });
  }
  
  // Agregar checkpoints
  checkpoints.forEach((checkpoint) => {
    const isFreeze = checkpoint.action === 'FREEZE';
    const totalVotes = Object.values(checkpoint.votesSnapshot).reduce((sum: number, count: any) => sum + count, 0);
    
    timeline.push({
      id: checkpoint.id,
      type: 'checkpoint',
      timestamp: new Date(checkpoint.timestamp),
      title: isFreeze ? 'Escrutinio Congelado' : 'Escrutinio Descongelado',
      description: `${totalVotes} votos registrados en este momento`,
      icon: isFreeze ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />,
      color: isFreeze ? 'bg-orange-500' : 'bg-green-500',
      user: checkpoint.user,
      votesSnapshot: checkpoint.votesSnapshot,
      gps: {
        latitude: checkpoint.gpsLatitude,
        longitude: checkpoint.gpsLongitude,
        accuracy: checkpoint.gpsAccuracy
      }
    });
  });
  
  // Agregar finalización de escrutinio
  if (escrutinioCompletedAt) {
    timeline.push({
      id: 'complete',
      type: 'complete',
      timestamp: new Date(escrutinioCompletedAt),
      title: 'Escrutinio Completado',
      description: 'Resultados enviados exitosamente',
      icon: <Clock className="h-4 w-4" />,
      color: 'bg-purple-500'
    });
  }
  
  // Ordenar por timestamp
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-HN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-HN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5" />
        Timeline de Auditoría
      </h3>
      
      <div className="space-y-4">
        {timeline.map((event, index) => (
          <div key={event.id} className="flex items-start gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${event.color}`}>
                {event.icon}
              </div>
              {index < timeline.length - 1 && (
                <div className="w-0.5 h-8 bg-gray-200 mt-2"></div>
              )}
            </div>
            
            {/* Event content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium text-gray-900">{event.title}</h4>
                <div className="text-xs text-gray-500">
                  {formatTime(event.timestamp)}
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{event.description}</p>
              
              {/* User info for checkpoints */}
              {event.type === 'checkpoint' && event.user && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <User className="h-3 w-3" />
                  <span>{event.user.name} ({event.user.email})</span>
                </div>
              )}
              
              {/* GPS info for checkpoints */}
              {event.type === 'checkpoint' && event.gps && event.gps.latitude && event.gps.longitude && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {event.gps.latitude.toFixed(6)}, {event.gps.longitude.toFixed(6)}
                    {event.gps.accuracy && ` (±${event.gps.accuracy.toFixed(0)}m)`}
                  </span>
                </div>
              )}
              
              {/* Vote breakdown for checkpoints */}
              {event.type === 'checkpoint' && event.votesSnapshot && (
                <div className="bg-gray-50 rounded p-2 text-xs">
                  <div className="font-medium text-gray-700 mb-1">Votos en este momento:</div>
                  <div className="space-y-1">
                    {Object.entries(event.votesSnapshot).map(([key, count]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-600">{key}:</span>
                        <span className="font-medium">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-400 mt-2">
                {formatDate(event.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {timeline.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay eventos de auditoría registrados</p>
        </div>
      )}
    </div>
  );
}
