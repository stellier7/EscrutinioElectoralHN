import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditLogger } from '../../../../lib/audit';
import type { ApiResponse, UserListFilters, UserListResponse, UserApprovalRequest } from '@/types';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Schema para validar filtros de búsqueda
const userFiltersSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  role: z.enum(['OBSERVER', 'VOLUNTEER', 'ORGANIZATION_MEMBER', 'ADMIN']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Schema para validar acciones de aprobación
const userApprovalSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT', 'SUSPEND']),
  notes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

// Middleware para verificar permisos de admin
async function verifyAdminPermissions(request: NextRequest) {
  try {
    // Extraer token del header Authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Token de autorización requerido',
      } as ApiResponse, { status: 401 });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '
    
    // Verificar y decodificar el token JWT
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    
    if (!decoded.userId) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido',
      } as ApiResponse, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, status: true },
    });

    if (!adminUser || adminUser.role !== 'ADMIN' || adminUser.status !== 'APPROVED') {
      return NextResponse.json({
        success: false,
        error: 'Permisos de administrador requeridos',
      } as ApiResponse, { status: 403 });
    }

    return { adminId: decoded.userId };
  } catch (error) {
    console.error('Error verifying admin permissions:', error);
    return NextResponse.json({
      success: false,
      error: 'Error de autenticación',
    } as ApiResponse, { status: 500 });
  }
}

// GET: Listar usuarios con filtros
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verificar permisos de admin
    const adminCheck = await verifyAdminPermissions(request);
    if (adminCheck instanceof NextResponse) return adminCheck;
    const { adminId } = adminCheck;

    // Extraer y validar parámetros de búsqueda
    const { searchParams } = new URL(request.url);
    const filters = Object.fromEntries(searchParams.entries());
    
    const validationResult = userFiltersSchema.safeParse(filters);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros de búsqueda inválidos',
        message: validationResult.error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }

    const { status, role, search, page, limit } = validationResult.data;
    const skip = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (role) {
      where.role = role;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Obtener usuarios y total
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          phone: true,
          organization: true,
          notes: true,
          approvedAt: true,
          approvedBy: true,
          rejectedAt: true,
          rejectedBy: true,
          rejectionReason: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              escrutinios: true,
            },
          },
        },
        orderBy: [
          { status: 'asc' }, // PENDING primero
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Obtener información de admins que aprobaron/rechazaron
    const allAdminIds = [
      ...users.map(u => u.approvedBy).filter((id): id is string => Boolean(id)),
      ...users.map(u => u.rejectedBy).filter((id): id is string => Boolean(id)),
    ];
    const adminIds = Array.from(new Set(allAdminIds));

    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, email: true },
    });

    const adminMap = new Map(admins.map(admin => [admin.id, admin]));

    // Formatear respuesta
    const formattedUsers = users.map(user => ({
      ...user,
      approvedByName: user.approvedBy ? adminMap.get(user.approvedBy)?.name : null,
      rejectedByName: user.rejectedBy ? adminMap.get(user.rejectedBy)?.name : null,
    }));

    const response: UserListResponse = {
      users: formattedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Log de auditoría
    try {
      await AuditLogger.log('VIEW_RESULTS', `Listado de usuarios - Filtros: ${JSON.stringify(filters)}`, adminId, undefined, request);
    } catch (auditError) {
      console.error('Audit logging error:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Usuarios obtenidos exitosamente',
    } as ApiResponse<UserListResponse>);

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
}

// PATCH: Aprobar/rechazar/suspender usuarios
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Verificar permisos de admin
    const adminCheck = await verifyAdminPermissions(request);
    if (adminCheck instanceof NextResponse) return adminCheck;
    const { adminId } = adminCheck;

    const body = await request.json();
    
    // Validar datos de entrada
    const validationResult = userApprovalSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        message: validationResult.error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }

    const { userId, action, notes, rejectionReason } = validationResult.data;

    // Verificar que el usuario existe
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        status: true, 
        role: true,
        approvedBy: true,
        rejectedBy: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado',
      } as ApiResponse, { status: 404 });
    }

    // Verificar que no se está modificando a sí mismo
    if (userId === adminId) {
      return NextResponse.json({
        success: false,
        error: 'No puedes modificar tu propio estado',
      } as ApiResponse, { status: 400 });
    }

    // Verificar que no se está modificando a otro admin (excepto si está pendiente)
    if (targetUser.role === 'ADMIN' && targetUser.status !== 'PENDING') {
      return NextResponse.json({
        success: false,
        error: 'No puedes modificar el estado de otro administrador activo',
      } as ApiResponse, { status: 403 });
    }

    // Preparar datos de actualización
    const updateData: any = {
      notes: notes || null,
    };

    // Aplicar cambios según la acción
    switch (action) {
      case 'APPROVE':
        updateData.status = 'APPROVED';
        updateData.approvedAt = new Date();
        updateData.approvedBy = adminId;
        updateData.rejectedAt = null;
        updateData.rejectedBy = null;
        updateData.rejectionReason = null;
        break;
        
      case 'REJECT':
        if (!rejectionReason) {
          return NextResponse.json({
            success: false,
            error: 'Razón de rechazo requerida',
          } as ApiResponse, { status: 400 });
        }
        updateData.status = 'REJECTED';
        updateData.rejectedAt = new Date();
        updateData.rejectedBy = adminId;
        updateData.rejectionReason = rejectionReason;
        updateData.approvedAt = null;
        updateData.approvedBy = null;
        break;
        
      case 'SUSPEND':
        updateData.status = 'SUSPENDED';
        updateData.rejectedAt = new Date();
        updateData.rejectedBy = adminId;
        updateData.rejectionReason = rejectionReason || 'Cuenta suspendida por administrador';
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Acción inválida',
        } as ApiResponse, { status: 400 });
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        notes: true,
        approvedAt: true,
        rejectedAt: true,
        rejectionReason: true,
      },
    });

    // Log de auditoría
    try {
      const actionMap = {
        APPROVE: 'USER_APPROVED',
        REJECT: 'USER_REJECTED',
        SUSPEND: 'USER_SUSPENDED',
      } as const;
      
      await AuditLogger.log(
        actionMap[action], 
        `Usuario ${action.toLowerCase()}do: ${targetUser.email} - ${targetUser.name}`,
        adminId,
        { 
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          action,
          notes,
          rejectionReason,
        },
        request
      );
    } catch (auditError) {
      console.error('Audit logging error:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: `Usuario ${action.toLowerCase()}do exitosamente`,
    } as ApiResponse);

  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
}
