'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { ArrowLeft, Mail, MessageSquare, Plus, Send, Calendar, Users, CheckCircle, XCircle } from 'lucide-react';
import type { ApiResponse, PaginatedResponse } from '@/types';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  eventType: string | null;
  eventDate: string | null;
  emailSubject: string | null;
  emailContent: string | null;
  whatsappContent: string | null;
  targetRole: 'OBSERVER' | 'VOLUNTEER' | null;
  targetJrv: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  emailsSent: number;
  emailsDelivered: number;
  whatsappSent: number;
  whatsappDelivered: number;
  recipientsCount: number;
}

export default function AdminCampaignsPage() {
  const { user, isLoading, token } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    eventType: '',
    eventDate: '',
    emailSubject: '',
    emailContent: '',
    whatsappContent: '',
    targetRole: '',
    targetJrv: '',
  });

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN' || user.status !== 'APPROVED')) {
      window.location.href = '/';
    }
  }, [user, isLoading]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && token) {
      fetchCampaigns();
    }
  }, [user, token]);

  const fetchCampaigns = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/campaigns?page=1&limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result: ApiResponse<PaginatedResponse<Campaign>> = await response.json();

      if (result.success && result.data) {
        setCampaigns(result.data.data);
        setPagination({
          total: result.data.total,
          page: result.data.page,
          limit: result.data.limit,
          totalPages: result.data.totalPages,
        });
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const response = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          targetRole: formData.targetRole || null,
          targetJrv: formData.targetJrv || null,
          eventDate: formData.eventDate || undefined,
          scheduledAt: formData.eventDate || undefined,
        }),
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        setShowCreateForm(false);
        setFormData({
          name: '',
          description: '',
          eventType: '',
          eventDate: '',
          emailSubject: '',
          emailContent: '',
          whatsappContent: '',
          targetRole: '',
          targetJrv: '',
        });
        fetchCampaigns();
      } else {
        alert(result.error || 'Error al crear campaña');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Error al crear campaña');
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    if (!token) return;
    if (!confirm('¿Estás seguro de que deseas enviar esta campaña? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setSending(campaignId);
      const response = await fetch(`/api/admin/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        alert(`Campaña enviada exitosamente. Emails: ${result.data?.emailsSent || 0}, WhatsApp: ${result.data?.whatsappSent || 0}`);
        fetchCampaigns();
      } else {
        alert(result.error || 'Error al enviar campaña');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Error al enviar campaña');
    } finally {
      setSending(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Regresar
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Gestión de Campañas</h1>
                  <p className="mt-2 text-gray-600">Envía emails y WhatsApp masivos a voluntarios</p>
                </div>
              </div>
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Nueva Campaña
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Crear Nueva Campaña</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre de la Campaña"
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Select
                  label="Tipo de Evento"
                  name="eventType"
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                  options={[
                    { value: '', label: 'Ninguno' },
                    { value: 'live_youtube', label: 'Live YouTube' },
                    { value: 'training', label: 'Entrenamiento' },
                    { value: 'meeting', label: 'Reunión' },
                    { value: 'other', label: 'Otro' },
                  ]}
                />
              </div>

              <Input
                label="Descripción"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Fecha del Evento (Opcional)"
                  name="eventDate"
                  type="datetime-local"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                />
                <Select
                  label="Filtrar por Rol"
                  name="targetRole"
                  value={formData.targetRole}
                  onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                  options={[
                    { value: '', label: 'Todos' },
                    { value: 'OBSERVER', label: 'Solo Observadores' },
                    { value: 'VOLUNTEER', label: 'Solo Voluntarios' },
                  ]}
                />
              </div>

              <Input
                label="Filtrar por JRV (Opcional)"
                name="targetJrv"
                value={formData.targetJrv}
                onChange={(e) => setFormData({ ...formData, targetJrv: e.target.value })}
                placeholder="Ej: 010101"
              />

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contenido del Email</h3>
                <Input
                  label="Asunto del Email"
                  name="emailSubject"
                  value={formData.emailSubject}
                  onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                />
                <Textarea
                  label="Contenido del Email (HTML)"
                  name="emailContent"
                  value={formData.emailContent}
                  onChange={(e) => setFormData({ ...formData, emailContent: e.target.value })}
                  rows={6}
                  placeholder="<p>Hola {firstName}, ...</p>"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contenido de WhatsApp</h3>
                <Textarea
                  label="Mensaje de WhatsApp"
                  name="whatsappContent"
                  value={formData.whatsappContent}
                  onChange={(e) => setFormData({ ...formData, whatsappContent: e.target.value })}
                  rows={6}
                  placeholder="Hola {firstName}, ..."
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="primary">
                  Crear Campaña
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Campaigns List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Campañas ({pagination.total})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        campaign.status === 'completed' ? 'bg-green-100 text-green-800' :
                        campaign.status === 'sending' ? 'bg-yellow-100 text-yellow-800' :
                        campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {campaign.status === 'completed' ? 'Completada' :
                         campaign.status === 'sending' ? 'Enviando' :
                         campaign.status === 'scheduled' ? 'Programada' :
                         'Borrador'}
                      </span>
                    </div>

                    {campaign.description && (
                      <p className="text-sm text-gray-600 mb-3">{campaign.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {campaign.recipientsCount} destinatarios
                        </span>
                      </div>

                      {campaign.emailSubject && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-gray-600">
                            {campaign.emailsSent} emails enviados
                          </span>
                        </div>
                      )}

                      {campaign.whatsappContent && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-gray-600">
                            {campaign.whatsappSent} WhatsApp enviados
                          </span>
                        </div>
                      )}

                      {campaign.eventDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-400" />
                          <span className="text-sm text-gray-600">
                            {new Date(campaign.eventDate).toLocaleDateString('es-HN')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {campaign.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => handleSendCampaign(campaign.id)}
                        disabled={sending === campaign.id}
                        className="flex items-center gap-2"
                      >
                        <Send className="h-4 w-4" />
                        {sending === campaign.id ? 'Enviando...' : 'Enviar'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {campaigns.length === 0 && (
              <div className="p-12 text-center">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay campañas creadas aún</p>
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Campaña
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


