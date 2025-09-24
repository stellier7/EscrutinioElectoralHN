"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
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
    location: null,
  });

  // Función para guardar estado en localStorage y URL
  const saveState = useCallback((newState: Partial<EscrutinioState>) => {
    const updatedState = { ...escrutinioState, ...newState };
    
    // Guardar en localStorage solo lo esencial
    try {
      const essentialData = {
        escrutinioId: updatedState.escrutinioId,
        actaImage: updatedState.actaImage,
        isEscrutinioFinished: updatedState.isEscrutinioFinished,
        // No guardar: selectedMesa, selectedLevel, currentStep, location
      };
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

    setEscrutinioState(updatedState);
  }, [escrutinioState, router]);

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
      location: null,
    };

    console.log('🔍 Cargando estado inicial:', state);

    // Cargar desde localStorage solo lo esencial
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        console.log('📦 Datos encontrados en localStorage:', JSON.stringify(parsed, null, 2));
        
        // Solo cargar lo esencial: escrutinioId y actaImage
        // No cargar JRV, nivel, paso - estos deben ser temporales
        if (parsed.escrutinioId) {
          state.escrutinioId = parsed.escrutinioId;
        }
        if (parsed.actaImage) {
          state.actaImage = parsed.actaImage;
        }
        if (parsed.isEscrutinioFinished) {
          state.isEscrutinioFinished = parsed.isEscrutinioFinished;
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
      
      // Solo saltar al paso 2 si también tenemos un escrutinioId (escritinio activo)
      if (escrutinioIdFromUrl && state.currentStep === 1) {
        console.log('⏭️ Saltando al paso 2 porque hay escrutinioId en URL');
        state.currentStep = 2; // Saltar al paso de conteo
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
      location: null,
    });

    // Limpiar URL
    router.replace('/escrutinio', { scroll: false });
  }, [router]);

  // Función para iniciar nuevo escrutinio (limpiar todo)
  const startNewEscrutinio = useCallback(() => {
    clearState();
    // También limpiar el store de votos y la clave del último escrutinio
    if (typeof window !== 'undefined') {
      // Importar dinámicamente el store para evitar problemas de SSR
      import('@/store/voteStore').then(({ useVoteStore }) => {
        useVoteStore.getState().clear();
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
    startNewEscrutinio,
    hasActiveEscrutinio: hasActiveEscrutinio(),
    canRecoverEscrutinio: canRecoverEscrutinio(),
  };
}
