'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { JRVUpdateResponse, ApiResponse } from '@/types';

interface JRVUploaderProps {
  onUpdate?: () => void;
}

export default function JRVUploader({ onUpdate }: JRVUploaderProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<JRVUpdateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // Validar tipo de archivo
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('El archivo debe ser un Excel (.xlsx o .xls)');
      return;
    }

    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo es demasiado grande. Máximo 10MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploadResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/jrvs/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result: ApiResponse<JRVUpdateResponse> = await response.json();

      if (result.success && result.data) {
        setUploadResult(result.data);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (onUpdate) {
          onUpdate();
        }
      } else {
        setError(result.error || 'Error al actualizar JRVs');
      }
    } catch (error) {
      console.error('Error uploading JRVs:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <FileSpreadsheet className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Actualizar JRVs</h3>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Sube un archivo Excel con las JRVs actualizadas. El archivo debe tener las columnas: 
        JRV, CENTRO DE VOTACION, CODIGO SECTOR ELECTORAL, NOMBRE SECTOR ELECTORAL, 
        CD, NOMBRE DEPARTAMENTO, CM, NOMBRE MUNICIPIO, CODIGO AREA, DESCRIPCION AREA, CARGA ELECTORAL JRV.
      </p>

      {/* Área de drop */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : selectedFile
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRemoveFile}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Remover
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="h-12 w-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-lg font-medium text-gray-900">
                Arrastra tu archivo Excel aquí
              </p>
              <p className="text-sm text-gray-500">
                o haz clic para seleccionar
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Seleccionar Archivo
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Resultado exitoso */}
      {uploadResult && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center mb-2">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-sm font-medium text-green-700">JRVs actualizadas exitosamente</p>
          </div>
          <div className="text-sm text-green-600 space-y-1">
            <p>Archivo: {uploadResult.fileName}</p>
            <p>Procesadas: {uploadResult.processedCount} JRVs</p>
            <p>Insertadas: {uploadResult.insertedCount} JRVs</p>
            <p>JRVs activas anteriores: {uploadResult.oldActiveCount}</p>
            <p>JRVs activas nuevas: {uploadResult.newActiveCount}</p>
          </div>
        </div>
      )}

      {/* Botón de subida */}
      {selectedFile && (
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Actualizando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Actualizar JRVs
              </>
            )}
          </Button>
        </div>
      )}

      {/* Advertencia */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
          <div className="text-sm text-yellow-700">
            <p className="font-medium mb-1">Advertencia:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Esta acción desactivará todas las JRVs actuales y activará las nuevas</li>
              <li>Los escrutinios existentes mantendrán sus datos históricos</li>
              <li>No se puede realizar si hay una sesión activa</li>
              <li>Esta acción no se puede deshacer</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
