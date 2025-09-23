import React from 'react';
import type { UserStatus } from '@/types';

interface UserStatusBadgeProps {
  status: UserStatus;
  className?: string;
}

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pendiente',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  APPROVED: {
    label: 'Aprobado',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  REJECTED: {
    label: 'Rechazado',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  SUSPENDED: {
    label: 'Suspendido',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

export function UserStatusBadge({ status, className = '' }: UserStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
      {config.label}
    </span>
  );
}
