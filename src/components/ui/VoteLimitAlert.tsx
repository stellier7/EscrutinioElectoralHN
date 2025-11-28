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
    <>
      <div className="modal-overlay">
        <div className="modal-container">
          <div className="modal-header">
            <div className="modal-icon bg-amber-100">
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-amber-600" />
            </div>
            <h3 className="modal-title">
              Límite de Marcas Alcanzado
            </h3>
          </div>

          <div className="mb-6">
            <p className="modal-description">
              Has alcanzado el límite máximo de marcas para esta papeleta:
            </p>
            
            <div className="alert-card alert-card-warning">
              <div className="alert-card-icon bg-amber-100">
                <CheckCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="alert-card-content">
                <div className="flex items-center justify-between">
                  <span className="alert-card-title text-amber-800">
                    Marcas en la papeleta:
                  </span>
                  <span className="text-lg font-bold text-amber-900">
                    {currentVotes} / {voteLimit}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              Para continuar marcando diputados, debes cerrar esta papeleta primero.
            </p>
          </div>

          <div className="modal-actions">
            <Button
              variant="primary"
              size="md"
              onClick={onClosePapeleta}
              disabled={isClosingPapeleta}
              loading={isClosingPapeleta}
              className="modal-button"
            >
              {isClosingPapeleta ? 'Cerrando...' : 'Cerrar Papeleta'}
            </Button>
            
            <Button
              variant="danger"
              size="md"
              onClick={() => setShowAnularConfirmation(true)}
              disabled={isClosingPapeleta}
              className="modal-button"
            >
              Anular Papeleta
            </Button>
            
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isClosingPapeleta}
              className="modal-button"
            >
              Corregir
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación de Anulación */}
      {showAnularConfirmation && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-icon bg-red-100">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="modal-title">
                Confirmar Anulación
              </h3>
              <p className="modal-description">
                ¿Seguro que deseas anular esta papeleta?
              </p>
            </div>
            <div className="modal-actions">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowAnularConfirmation(false)}
                className="modal-button"
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
                className="modal-button"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
