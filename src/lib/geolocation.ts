import type { LocationData } from '@/types';

export class GeolocationUtils {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly DEFAULT_MAX_AGE = 60000; // 1 minute
  private static readonly DEFAULT_ENABLE_HIGH_ACCURACY = true;

  static async getCurrentLocation(options?: PositionOptions): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const defaultOptions: PositionOptions = {
        enableHighAccuracy: GeolocationUtils.DEFAULT_ENABLE_HIGH_ACCURACY,
        timeout: GeolocationUtils.DEFAULT_TIMEOUT,
        maximumAge: GeolocationUtils.DEFAULT_MAX_AGE,
        ...options,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          resolve(locationData);
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        defaultOptions
      );
    });
  }

  static async watchLocation(
    callback: (location: LocationData) => void,
    errorCallback?: (error: Error) => void,
    options?: PositionOptions
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const defaultOptions: PositionOptions = {
        enableHighAccuracy: GeolocationUtils.DEFAULT_ENABLE_HIGH_ACCURACY,
        timeout: GeolocationUtils.DEFAULT_TIMEOUT,
        maximumAge: GeolocationUtils.DEFAULT_MAX_AGE,
        ...options,
      };

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          callback(locationData);
        },
        (error) => {
          const errorObj = new Error(`Geolocation error: ${error.message}`);
          if (errorCallback) {
            errorCallback(errorObj);
          } else {
            reject(errorObj);
          }
        },
        defaultOptions
      );

      resolve(watchId);
    });
  }

  static clearWatch(watchId: number): void {
    navigator.geolocation?.clearWatch(watchId);
  }

  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = GeolocationUtils.toRadians(lat2 - lat1);
    const dLon = GeolocationUtils.toRadians(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(GeolocationUtils.toRadians(lat1)) *
        Math.cos(GeolocationUtils.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    
    return distance * 1000; // Convert to meters
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  static isLocationAccurate(location: LocationData, requiredAccuracy: number = 100): boolean {
    return location.accuracy !== undefined && location.accuracy <= requiredAccuracy;
  }

  static formatLocation(location: LocationData): string {
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  static isLocationValid(location: LocationData): boolean {
    return (
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  static getLocationPermissionStatus(): Promise<PermissionState> {
    if (!navigator.permissions) {
      return Promise.resolve('prompt' as PermissionState);
    }

    return navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => result.state);
  }

  static async requestLocationPermission(): Promise<boolean> {
    try {
      const status = await GeolocationUtils.getLocationPermissionStatus();
      
      if (status === 'granted') {
        return true;
      }
      
      if (status === 'denied') {
        return false;
      }

      // For 'prompt' status, we attempt to get location which will trigger permission request
      try {
        await GeolocationUtils.getCurrentLocation();
        return true;
      } catch (error) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  static generateLocationHash(location: LocationData): string {
    const locationString = `${location.latitude},${location.longitude},${location.timestamp}`;
    return btoa(locationString);
  }
} 