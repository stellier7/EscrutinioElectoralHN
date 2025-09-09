import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export default function BackButton({ onClick, className = '', children }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors touch-target ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {children || 'Regresar'}
    </button>
  );
}
