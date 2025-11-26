import axios from 'axios';
import { env } from '@/config/env';

export interface WhatsAppOptions {
  to: string; // Phone number in E.164 format (e.g., +50412345678)
  message: string;
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Format phone number to E.164 format
 * Honduras format: +504XXXXXXXX
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 504, add +
  if (digits.startsWith('504')) {
    return `+${digits}`;
  }
  
  // If it starts with 0, replace with +504
  if (digits.startsWith('0')) {
    return `+504${digits.substring(1)}`;
  }
  
  // If it's 8 digits (typical Honduras number), add +504
  if (digits.length === 8) {
    return `+504${digits}`;
  }
  
  // If it's 9 digits (with leading country code), add +
  if (digits.length === 9 && digits.startsWith('5')) {
    return `+${digits}`;
  }
  
  // Default: assume it needs +504
  return `+504${digits}`;
}

/**
 * Send WhatsApp message using ChatAPI
 */
export async function sendWhatsApp(options: WhatsAppOptions): Promise<WhatsAppResult> {
  if (!env.CHATAPI_API_KEY) {
    console.warn('ChatAPI API key not configured. WhatsApp message not sent.');
    return {
      success: false,
      error: 'ChatAPI not configured',
    };
  }

  if (!env.CHATAPI_INSTANCE_ID) {
    console.warn('ChatAPI instance ID not configured. WhatsApp message not sent.');
    return {
      success: false,
      error: 'ChatAPI instance ID not configured',
    };
  }

  try {
    const formattedTo = formatPhoneNumber(options.to);
    
    // ChatAPI endpoint
    const url = `https://api.chat-api.com/instance${env.CHATAPI_INSTANCE_ID}/sendMessage?token=${env.CHATAPI_API_KEY}`;
    
    const response = await axios.post(url, {
      phone: formattedTo,
      body: options.message,
    });

    if (response.data && response.data.sent === true) {
      return {
        success: true,
        messageId: response.data.id || response.data.messageId,
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Failed to send WhatsApp message',
      };
    }
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    
    // Extract error message from ChatAPI response
    let errorMessage = 'Failed to send WhatsApp message';
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send bulk WhatsApp messages
 */
export async function sendBulkWhatsApp(messages: WhatsAppOptions[]): Promise<WhatsAppResult[]> {
  if (!env.CHATAPI_API_KEY || !env.CHATAPI_INSTANCE_ID) {
    console.warn('ChatAPI not configured. WhatsApp messages not sent.');
    return messages.map(() => ({
      success: false,
      error: 'ChatAPI not configured',
    }));
  }

  const results: WhatsAppResult[] = [];
  
  // Send messages sequentially to avoid rate limits
  // ChatAPI has rate limits, so we add a small delay between messages
  for (const message of messages) {
    const result = await sendWhatsApp(message);
    results.push(result);
    
    // Small delay to avoid rate limits (ChatAPI typically allows ~1-2 messages per second)
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  return results;
}

/**
 * Generate welcome WhatsApp message for volunteer application
 */
export function generateWelcomeWhatsApp(data: {
  firstName: string;
  lastName: string;
  role: 'OBSERVER' | 'VOLUNTEER';
}): string {
  const roleText = data.role === 'OBSERVER' ? 'Observador' : 'Voluntario';
  
  return `¡Hola ${data.firstName}! 👋

Gracias por tu interés en unirte como *${roleText}* en Escrutinio Transparente. 📊

Hemos recibido tu solicitud y está siendo revisada. Te contactaremos pronto con más información sobre los próximos pasos.

*¿Qué sigue?*
• Asistir a 2 reuniones informativas
• Participar en un entrenamiento en persona
• Recibirás más detalles próximamente

Si tienes preguntas, contáctanos.

¡Gracias por ayudar a garantizar elecciones transparentes en Honduras! 🇭🇳`;
}
