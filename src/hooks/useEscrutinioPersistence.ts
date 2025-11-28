"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

interface EscrutinioState {
  currentStep: number;
  selectedMesa: string;
  selectedMesaInfo: {
    value: string;
    label: string;
    location: string;
    department: string;
  } | null;
  selectedLevel: string;
  escrutinioId: string | null;
  isEscrutinioFinished: boolean;
  actaImage: File | null;
  actaImageSource: 'CAMERA' | 'LIBRARY' | null;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
  // Estado de UI específico para legislativo
  legislativeCurrentPapeleta?: number;
  legislativeExpandedParty?: string | null;
  legislativePapeletaVotes?: {[key: string]: number}; // casillaNumber -> conteo (para partido actual)
  legislativeCompletedPapeletas?: number; // NUEVO: Rastrear papeletas completadas
}

const STORAGE_KEY = 'escrutinio-state';

export function useEscrutinioPersistence() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [escrutinioState, setEscrutinioState] = useState<EscrutinioState>({
    currentStep: 1,
    selectedMesa: '',
    selectedMesaInfo: null,
    selectedLevel: '',
    escrutinioId: null,
    isEscrutinioFinished: false,
    actaImage: null,
    actaImageSource: null,
    location: null,
    legislativeCurrentPapeleta: undefined,
    legislativeExpandedParty: undefined,
    legislativePapeletaVotes: undefined,
    legislativeCompletedPapeletas: undefined,
  });

  // Función para guardar estado en localStorage y URL
  const saveState = useCallback((newState: Partial<EscrutinioState>) => {
    // Usar actualización funcional para evitar dependencia de escrutinioState
    setEscrutinioState(prevState => {
      const updatedState = { ...prevState, ...newState };
      
      // Guardar en localStorage solo lo esencial
      // Solo guardar datos legislativos si el nivel actual es LEGISLATIVE
      // Solo guardar datos presidenciales si el nivel actual es PRESIDENTIAL
      try {
        const essentialData: any = {
          escrutinioId: updatedState.escrutinioId,
          actaImage: updatedState.actaImage,
          actaImageSource: updatedState.actaImageSource,
          isEscrutinioFinished: updatedState.isEscrutinioFinished,
          location: updatedState.location,
        };
        
        // Solo incluir datos legislativos si el nivel es LEGISLATIVE
        if (updatedState.selectedLevel === 'LEGISLATIVE') {
          essentialData.legislativeCurrentPapeleta = updatedState.legislativeCurrentPapeleta;
          essentialData.legislativeExpandedParty = updatedState.legislativeExpandedParty;
          essentialData.legislativePapeletaVotes = updatedState.legislativePapeletaVotes;
          essentialData.legislativeCompletedPapeletas = updatedState.legislativeCompletedPapeletas;
        } else if (updatedState.selectedLevel === 'PRESIDENTIAL') {
          // Si es PRESIDENTIAL, asegurar que los datos legislativos no se guarden
          // (ya están undefined, pero por seguridad los excluimos explícitamente)
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialData));
      } catch (error) {
        console.warn('Error saving escrutinio state to localStorage:', error);
      }

      // Actualizar URL si hay JRV y nivel
      if (updatedState.selectedMesa && updatedState.selectedLevel) {
        const params = new URLSearchParams();
        params.set('jrv', updatedState.selectedMesa);
        params.set('level', updatedState.selectedLevel);
        
        if (updatedState.escrutinioId) {
          params.set('escrutinioId', updatedState.escrutinioId);
        }
        
        router.replace(`/escrutinio?${params.toString()}`, { scroll: false });
      }

      return updatedState;
    });
  }, [router]); // ✅ Only depends on router, not escrutinioState

  // Función para cargar estado desde localStorage y URL
  const loadState = useCallback((): EscrutinioState => {
    let state: EscrutinioState = {
      currentStep: 1,
      selectedMesa: '',
      selectedMesaInfo: null,
      selectedLevel: '',
      escrutinioId: null,
      isEscrutinioFinished: false,
      actaImage: null,
      actaImageSource: null,
      location: null,
      legislativeCurrentPapeleta: undefined,
      legislativeExpandedParty: undefined,
      legislativeCompletedPapeletas: undefined,
    };

    console.log('🔍 Cargando estado inicial:', state);

    // Cargar desde localStorage solo lo esencial
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        console.log('📦 Datos encontrados en localStorage:', JSON.stringify(parsed, null, 2));
        
        // Solo cargar lo esencial: escrutinioId, actaImage y location
        // No cargar JRV, nivel, paso - estos deben ser temporales
        if (parsed.escrutinioId) {
          state.escrutinioId = parsed.escrutinioId;
        }
        if (parsed.actaImage) {
          state.actaImage = parsed.actaImage;
        }
        if (parsed.actaImageSource) {
          state.actaImageSource = parsed.actaImageSource;
        }
        if (parsed.isEscrutinioFinished) {
          state.isEscrutinioFinished = parsed.isEscrutinioFinished;
        }
        if (parsed.location) {
          state.location = parsed.location;
        }
        
        // Solo cargar datos legislativos si el nivel es LEGISLATIVE
        // Esto previene que datos legislativos se carguen cuando se está en un escrutinio presidencial
        // Primero verificar la URL, luego el parsed state
        const levelFromUrl = searchParams.get('level');
        const currentLevel = levelFromUrl || parsed.selectedLevel;
        const shouldLoadLegislative = currentLevel === 'LEGISLATIVE';
        
        if (shouldLoadLegislative) {
          if (parsed.legislativeCurrentPapeleta !== undefined) {
            state.legislativeCurrentPapeleta = parsed.legislativeCurrentPapeleta;
          }
          if (parsed.legislativeExpandedParty !== undefined) {
            state.legislativeExpandedParty = parsed.legislativeExpandedParty;
          }
          if (parsed.legislativePapeletaVotes !== undefined) {
            state.legislativePapeletaVotes = parsed.legislativePapeletaVotes;
          }
          if (parsed.legislativeCompletedPapeletas !== undefined) {
            state.legislativeCompletedPapeletas = parsed.legislativeCompletedPapeletas;
          }
        } else {
          // Si no es LEGISLATIVE, asegurar que los datos legislativos estén undefined
          state.legislativeCurrentPapeleta = undefined;
          state.legislativeExpandedParty = undefined;
          state.legislativePapeletaVotes = undefined;
          state.legislativeCompletedPapeletas = undefined;
        }
        
        console.log('🔄 Estado después de cargar localStorage:', JSON.stringify(state, null, 2));
      }
    } catch (error) {
      console.warn('Error loading escrutinio state from localStorage:', error);
    }

    // Sobrescribir con parámetros de URL si existen
    const jrvFromUrl = searchParams.get('jrv');
    const levelFromUrl = searchParams.get('level');
    const escrutinioIdFromUrl = searchParams.get('escrutinioId');

    console.log('🌐 Parámetros de URL:', JSON.stringify({ jrvFromUrl, levelFromUrl, escrutinioIdFromUrl }, null, 2));

    // Solo cargar datos de URL si hay parámetros específicos
    if (jrvFromUrl && levelFromUrl) {
      state.selectedMesa = jrvFromUrl;
      state.selectedLevel = levelFromUrl;
      
      // Buscar información de la mesa desde la URL
      if (jrvFromUrl) {
        // Crear un objeto selectedMesaInfo básico para la URL
        state.selectedMesaInfo = {
          value: jrvFromUrl,
          label: `${jrvFromUrl} - Cargado desde URL`,
          location: 'Cargando...',
          department: 'Cargando...'
        };
      }
      
      // Saltar al paso 2 si:
      // 1. Tenemos un escrutinioId válido (de URL o localStorage) - escrutinio ya iniciado
      // 2. O tenemos nivel y JRV seleccionados - usuario seleccionó nivel, debe ir al paso 2 para obtener GPS
      // Esto permite mostrar la pantalla de "GPS Requerido" en el paso 2 mientras se obtiene GPS
      const escrutinioId = escrutinioIdFromUrl || state.escrutinioId;
      if (escrutinioId) {
        console.log('⏭️ Saltando al paso 2 porque hay escrutinioId:', escrutinioId);
        state.currentStep = 2; // Saltar al paso de conteo
        // Asegurar que el escrutinioId esté en el estado
        if (!state.escrutinioId) {
          state.escrutinioId = escrutinioId;
        }
      } else if (levelFromUrl && jrvFromUrl) {
        // Si hay nivel y JRV en URL pero no escrutinioId, significa que el usuario
        // seleccionó el nivel y debe ir al paso 2 para obtener GPS
        console.log('⏭️ Saltando al paso 2 porque hay nivel y JRV seleccionados (esperando GPS)');
        state.currentStep = 2;
      }
    } else {
      // Si no hay parámetros de URL, siempre empezar en paso 1
      console.log('🏁 No hay parámetros de URL, empezando en paso 1');
      state.currentStep = 1;
    }

    if (escrutinioIdFromUrl) {
      state.escrutinioId = escrutinioIdFromUrl;
    }

    console.log('✅ Estado final cargado:', JSON.stringify(state, null, 2));
    return state;
  }, [searchParams]);

  // Función para limpiar estado
  const clearState = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Error clearing escrutinio state from localStorage:', error);
    }
    
    setEscrutinioState({
      currentStep: 1,
      selectedMesa: '',
      selectedMesaInfo: null,
      selectedLevel: '',
      escrutinioId: null,
      isEscrutinioFinished: false,
      actaImage: null,
      actaImageSource: null,
      location: null,
      legislativeCurrentPapeleta: undefined,
      legislativeExpandedParty: undefined,
      legislativePapeletaVotes: undefined,
      legislativeCompletedPapeletas: undefined,
    });

    // Limpiar URL
    router.replace('/escrutinio', { scroll: false });
  }, [router]);

  // Función para reiniciar solo el escrutinio actual (limpiar TODO y volver al paso 1)
  const resetCurrentEscrutinio = useCallback(async () => {
    console.log('🔄 Reiniciando escrutinio actual...');
    
    // 1. CANCELAR EN EL SERVIDOR PRIMERO
    if (escrutinioState.escrutinioId) {
      try {
        const token = localStorage.getItem('auth-token');
        await axios.post(
          `/api/escrutinio/${escrutinioState.escrutinioId}/cancel`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        console.log('✅ Escrutinio cancelado en el servidor');
      } catch (error) {
        console.error('❌ Error cancelando escrutinio en servidor:', error);
        // Continuar con limpieza local aunque falle
      }
    }
    
    // 2. Limpiar stores locales
    if (typeof window !== 'undefined') {
      // Limpiar store presidencial
      import('@/store/voteStore').then(({ useVoteStore }) => {
        console.log('🧹 Limpiando voteStore (presidencial)');
        useVoteStore.getState().clear();
      });
      
      // Limpiar store legislativo
      import('@/store/legislativeVoteStore').then(({ useLegislativeVoteStore }) => {
        console.log('🧹 Limpiando legislativeVoteStore');
        useLegislativeVoteStore.getState().clear();
      });
      
      // Limpiar las claves del último escrutinio
      localStorage.removeItem('last-escrutinio-key');
      localStorage.removeItem('last-presidential-escrutinio-id');
      localStorage.removeItem('last-legislative-escrutinio-id');
    }
    
    // 3. Limpiar estado local
        const updatedState = {
          currentStep: 1,
          selectedMesa: '',
          selectedMesaInfo: null,
          selectedLevel: '',
          escrutinioId: null,
          isEscrutinioFinished: false,
          actaImage: null,
          actaImageSource: null,
          location: null,
          legislativeCurrentPapeleta: undefined,
          legislativeExpandedParty: undefined,
          legislativePapeletaVotes: undefined,
          legislativeCompletedPapeletas: undefined,
        };
    
    // Limpiar localStorage completamente
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Error removing escrutinio state from localStorage:', error);
    }
    
    setEscrutinioState(updatedState);
    router.replace('/escrutinio', { scroll: false });
    
    console.log('✅ Escrutinio reiniciado, volviendo al paso 1');
  }, [escrutinioState.escrutinioId, router]);

  // Función para iniciar nuevo escrutinio (limpiar todo)
  const startNewEscrutinio = useCallback(() => {
    clearState();
    // También limpiar ambos stores de votos y la clave del último escrutinio
    if (typeof window !== 'undefined') {
      // Limpiar store presidencial
      import('@/store/voteStore').then(({ useVoteStore }) => {
        useVoteStore.getState().clear();
      });
      
      // Limpiar store legislativo
      import('@/store/legislativeVoteStore').then(({ useLegislativeVoteStore }) => {
        useLegislativeVoteStore.getState().clear();
      });
      
      // Limpiar la clave del último escrutinio
      localStorage.removeItem('last-escrutinio-key');
    }
  }, [clearState]);

  // Cargar estado al inicializar
  useEffect(() => {
    const loadedState = loadState();
    setEscrutinioState(loadedState);
  }, [loadState]);

  // Función para verificar si hay un escrutinio activo
  const hasActiveEscrutinio = useCallback(() => {
    return !!(escrutinioState.selectedMesa && escrutinioState.selectedLevel && escrutinioState.escrutinioId);
  }, [escrutinioState]);

  // Función para verificar si se puede recuperar el escrutinio
  const canRecoverEscrutinio = useCallback(() => {
    return !!(escrutinioState.selectedMesa && escrutinioState.selectedLevel);
  }, [escrutinioState]);

  return {
    escrutinioState,
    saveState,
    clearState,
    resetCurrentEscrutinio,
    startNewEscrutinio,
    hasActiveEscrutinio: hasActiveEscrutinio(),
    canRecoverEscrutinio: canRecoverEscrutinio(),
  };
}
