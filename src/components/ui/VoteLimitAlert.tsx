"use client";
import React, { useState } from 'react';
import { AlertCircle, X, CheckCircle } from 'lucide-react';
import Button from './Button';

interface VoteLimitAlertProps {
  isVisible: boolean;
  currentVotes: number;
  voteLimit: number;
  onClose: () => void;
  onClosePapeleta: () => void;
  onAnularPapeleta: () => void;
  isClosingPapeleta?: boolean;
}

export function VoteLimitAlert({
  isVisible,
  currentVotes,
  voteLimit,
  onClose,
  onClosePapeleta,
  onAnularPapeleta,
  isClosingPapeleta = false
}: VoteLimitAlertProps) {
  const [showAnularConfirmation, setShowAnularConfirmation] = useState(false);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Límite de Marcas Alcanzado
            </h3>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            Has alcanzado el límite máximo de marcas para esta papeleta:
          </p>
          
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-amber-600 mr-2" />
                <span className="text-sm font-medium text-amber-800">
                  Marcas en la papeleta:
                </span>
              </div>
              <span className="text-lg font-bold text-amber-900">
                {currentVotes} / {voteLimit}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-4">
            Para continuar marcando diputados, debes cerrar esta papeleta primero.
          </p>
        </div>

        <div className="flex flex-col space-y-3">
          <div className="flex space-x-3">
            <Button
              variant="primary"
              size="md"
              onClick={onClosePapeleta}
              disabled={isClosingPapeleta}
              loading={isClosingPapeleta}
              className="flex-1"
            >
              {isClosingPapeleta ? 'Cerrando...' : 'Cerrar Papeleta'}
            </Button>
            
            <Button
              variant="danger"
              size="md"
              onClick={() => setShowAnularConfirmation(true)}
              disabled={isClosingPapeleta}
              className="flex-1"
            >
              Anular Papeleta
            </Button>
          </div>
          
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isClosingPapeleta}
            className="w-full"
          >
            Corregir
          </Button>
        </div>
      </div>
    </div>

    {/* Modal de Confirmación de Anulación */}
    {showAnularConfirmation && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <X className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Confirmar Anulación
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Seguro que deseas anular esta papeleta?
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowAnularConfirmation(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  onAnularPapeleta();
                  setShowAnularConfirmation(false);
                }}
                className="flex-1"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
  );
}
