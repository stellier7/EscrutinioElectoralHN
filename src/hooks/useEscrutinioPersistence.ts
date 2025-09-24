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
    accuracy: number;
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
    
    // Guardar en localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedState));
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

    // Cargar desde localStorage
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // No cargar actaImage desde localStorage (File objects no se serializan bien)
        const { actaImage, ...rest } = parsed;
        state = { ...state, ...rest };
      }
    } catch (error) {
      console.warn('Error loading escrutinio state from localStorage:', error);
    }

    // Sobrescribir con parámetros de URL si existen
    const jrvFromUrl = searchParams.get('jrv');
    const levelFromUrl = searchParams.get('level');
    const escrutinioIdFromUrl = searchParams.get('escrutinioId');

    if (jrvFromUrl && levelFromUrl) {
      state.selectedMesa = jrvFromUrl;
      state.selectedLevel = levelFromUrl;
      
      // Si tenemos JRV y nivel en URL, probablemente estamos en un escrutinio activo
      if (state.currentStep === 1) {
        state.currentStep = 2; // Saltar al paso de conteo
      }
    }

    if (escrutinioIdFromUrl) {
      state.escrutinioId = escrutinioIdFromUrl;
    }

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
    hasActiveEscrutinio: hasActiveEscrutinio(),
    canRecoverEscrutinio: canRecoverEscrutinio(),
  };
}
