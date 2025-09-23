// Sistema offline simple para manejar cortes de internet
// Enfoque: Simple, confiable, sin complejidades

export interface OfflineItem {
  id: string;
  action: string;
  data: any;
  timestamp: number;
  retries: number;
}

export interface OfflineQueueStatus {
  isOnline: boolean;
  pendingItems: number;
  isProcessing: boolean;
}

class OfflineQueueManager {
  private static instance: OfflineQueueManager;
  private queue: OfflineItem[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  
  // Detectar si estamos online
  private get isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  private constructor() {
    // Cargar cola del localStorage al inicializar
    this.loadFromStorage();
    
    // Escuchar cambios de conexión
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
      
      window.addEventListener('offline', () => {
        console.log('Conexión perdida - modo offline activado');
      });
    }
  }

  public static getInstance(): OfflineQueueManager {
    if (!OfflineQueueManager.instance) {
      OfflineQueueManager.instance = new OfflineQueueManager();
    }
    return OfflineQueueManager.instance;
  }

  // Agregar item a la cola
  public addToQueue(action: string, data: any): string {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const item: OfflineItem = {
      id,
      action,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(item);
    this.saveToStorage();
    
    console.log(`Item agregado a cola offline: ${action}`, item);
    
    // Si estamos online, intentar procesar inmediatamente
    if (this.isOnline) {
      this.processQueue();
    }
    
    return id;
  }

  // Procesar cola cuando regrese conexión
  public async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`Procesando cola offline: ${this.queue.length} items`);

    const itemsToProcess = [...this.queue];
    const processedItems: string[] = [];
    const failedItems: OfflineItem[] = [];

    for (const item of itemsToProcess) {
      try {
        const success = await this.processItem(item);
        if (success) {
          processedItems.push(item.id);
        } else {
          item.retries++;
          if (item.retries < this.maxRetries) {
            failedItems.push(item);
          } else {
            console.warn(`Item falló después de ${this.maxRetries} intentos:`, item);
          }
        }
      } catch (error) {
        console.error('Error procesando item offline:', error);
        item.retries++;
        if (item.retries < this.maxRetries) {
          failedItems.push(item);
        }
      }
    }

    // Actualizar cola (remover procesados, mantener fallidos)
    this.queue = failedItems;
    this.saveToStorage();
    
    this.isProcessing = false;
    
    if (processedItems.length > 0) {
      console.log(`${processedItems.length} items procesados exitosamente`);
    }
  }

  // Procesar un item individual
  private async processItem(item: OfflineItem): Promise<boolean> {
    try {
      switch (item.action) {
        case 'submit_votes':
          return await this.submitVotes(item.data);
        case 'upload_image':
          return await this.uploadImage(item.data);
        case 'submit_escrutinio':
          return await this.submitEscrutinio(item.data);
        default:
          console.warn('Acción offline no reconocida:', item.action);
          return false;
      }
    } catch (error) {
      console.error('Error en processItem:', error);
      return false;
    }
  }

  // Métodos específicos para cada acción
  private async submitVotes(data: any): Promise<boolean> {
    try {
      const response = await fetch('/api/escrutinio/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.ok;
    } catch (error) {
      console.error('Error submitting votes:', error);
      return false;
    }
  }

  private async uploadImage(data: any): Promise<boolean> {
    try {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('escrutinioId', data.escrutinioId);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });
      return response.ok;
    } catch (error) {
      console.error('Error uploading image:', error);
      return false;
    }
  }

  private async submitEscrutinio(data: any): Promise<boolean> {
    try {
      const response = await fetch('/api/escrutinio/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.ok;
    } catch (error) {
      console.error('Error submitting escrutinio:', error);
      return false;
    }
  }

  // Persistencia en localStorage
  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('offline_queue', JSON.stringify(this.queue));
      } catch (error) {
        console.error('Error saving offline queue:', error);
      }
    }
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('offline_queue');
        if (stored) {
          this.queue = JSON.parse(stored);
          console.log(`Cola offline cargada: ${this.queue.length} items`);
        }
      } catch (error) {
        console.error('Error loading offline queue:', error);
        this.queue = [];
      }
    }
  }

  // Métodos públicos para obtener estado
  public getStatus(): OfflineQueueStatus {
    return {
      isOnline: this.isOnline,
      pendingItems: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  public clearQueue(): void {
    this.queue = [];
    this.saveToStorage();
    console.log('Cola offline limpiada');
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

// Exportar instancia singleton
export const offlineQueue = OfflineQueueManager.getInstance();
