import { useState, useEffect } from 'react';

interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface GeolocationError {
  code: number;
  message: string;
  userFriendlyMessage: string;
}

export function useGeolocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  // Verificar el estado de permisos
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionStatus(result.state as any);
        
        result.onchange = () => {
          setPermissionStatus(result.state as any);
        };
      });
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    try {
      // Intentar obtener ubicación para forzar la solicitud de permisos
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          resolve(false);
        }, 5000);

        navigator.geolocation.getCurrentPosition(
          () => {
            clearTimeout(timeoutId);
            resolve(true);
          },
          (error) => {
            clearTimeout(timeoutId);
            resolve(false);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0
          }
        );
      });
    } catch (err) {
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<Location | null> => {
    setIsLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError({
        code: -1,
        message: 'Geolocalización no disponible',
        userFriendlyMessage: 'Tu dispositivo no soporta geolocalización'
      });
      setIsLoading(false);
      return null;
    }

    // Configuración optimizada para móviles
    const options = {
      enableHighAccuracy: true,
      timeout: 30000, // 30 segundos
      maximumAge: 300000 // 5 minutos
    };

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          setLocation(newLocation);
          setIsLoading(false);
          resolve(newLocation);
        },
        (geolocationError) => {
          let userFriendlyMessage = '';
          
          switch (geolocationError.code) {
            case geolocationError.PERMISSION_DENIED:
              userFriendlyMessage = 'Permiso de ubicación denegado. Por favor, habilita la ubicación en tu dispositivo y recarga la página.';
              break;
            case geolocationError.POSITION_UNAVAILABLE:
              userFriendlyMessage = 'No se pudo obtener tu ubicación. Verifica que tengas GPS habilitado y conexión a internet.';
              break;
            case geolocationError.TIMEOUT:
              userFriendlyMessage = 'Tiempo de espera agotado. Intenta salir al exterior o verifica tu conexión GPS.';
              break;
            default:
              userFriendlyMessage = 'Error inesperado al obtener ubicación. Intenta nuevamente.';
          }
          
          const errorObj: GeolocationError = {
            code: geolocationError.code,
            message: geolocationError.message,
            userFriendlyMessage
          };
          
          setError(errorObj);
          setIsLoading(false);
          resolve(null);
        },
        options
      );
    });
  };

  const showLocationInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isIOS) {
      instructions = `
Para habilitar la ubicación en tu iPhone:

1. Ve a Configuración > Privacidad y Seguridad > Ubicación
2. Busca "Safari" o tu navegador
3. Selecciona "Permitir mientras uso la app"
4. Regresa a esta página y intenta nuevamente

O simplemente toca "Permitir" cuando aparezca la notificación.
      `;
    } else if (isAndroid) {
      instructions = `
Para habilitar la ubicación en tu Android:

1. Ve a Configuración > Ubicación
2. Asegúrate de que esté activada
3. En Configuración > Aplicaciones > [Tu navegador]
4. Permisos > Ubicación > Permitir
5. Regresa a esta página y intenta nuevamente

O simplemente toca "Permitir" cuando aparezca la notificación.
      `;
    } else {
      instructions = `
Para habilitar la ubicación:

1. Busca el ícono de ubicación en la barra de direcciones
2. Haz clic en "Permitir" o "Allow"
3. Recarga la página
4. Intenta obtener ubicación nuevamente
      `;
    }
    
    return instructions;
  };

  return {
    location,
    isLoading,
    error,
    permissionStatus,
    getCurrentLocation,
    requestPermission,
    showLocationInstructions
  };
} 