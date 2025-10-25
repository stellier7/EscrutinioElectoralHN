import React from 'react';
import type { UserRole } from '@/types';

interface UserRoleBadgeProps {
  role: UserRole;
  className?: string;
}

const ROLE_CONFIG = {
  OBSERVER: {
    label: 'Observador',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '👁️',
  },
  VOLUNTEER: {
    label: 'Voluntario',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: '🙋‍♂️',
  },
  ORGANIZATION_MEMBER: {
    label: 'Miembro de Org.',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: '🏢',
  },
  ADMIN: {
    label: 'Administrador',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: '⚙️',
  },
};

export function UserRoleBadge({ role, className = '' }: UserRoleBadgeProps) {
  const config = ROLE_CONFIG[role];
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}
    >
      <span className="mr-1.5">{config.icon}</span>
      {config.label}
    </span>
  );
}
