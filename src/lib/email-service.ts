import { env } from '@/config/env';

// Initialize Resend (optional - only if package is installed)
let resendClient: any = null;

// Try to initialize Resend if available
try {
  // @ts-ignore - resend may not be installed, this is intentional
  const resendModule = require('resend');
  if (resendModule && resendModule.Resend && env.RESEND_API_KEY) {
    const Resend = resendModule.Resend;
    resendClient = new Resend(env.RESEND_API_KEY);
  }
} catch (error) {
  // Resend package not installed, email service will be disabled
  // This is fine - email service will just return errors when called
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!resendClient) {
    console.warn('Resend API key not configured. Email not sent.');
    return {
      success: false,
      error: 'Resend not configured',
    };
  }

  if (!env.RESEND_FROM_EMAIL) {
    console.warn('Resend from email not configured. Email not sent.');
    return {
      success: false,
      error: 'Resend from email not configured',
    };
  }

  try {
    const fromEmail = env.RESEND_FROM_NAME 
      ? `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`
      : env.RESEND_FROM_EMAIL;

    const { data, error } = await resendClient.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    if (error) {
      console.error('Resend API error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Send bulk emails
 */
export async function sendBulkEmails(emails: EmailOptions[]): Promise<EmailResult[]> {
  if (!resendClient) {
    console.warn('Resend not available. Emails not sent.');
    return emails.map(() => ({
      success: false,
      error: 'Email service not available',
    }));
  }

  if (!env.RESEND_FROM_EMAIL) {
    console.warn('Resend from email not configured. Emails not sent.');
    return emails.map(() => ({
      success: false,
      error: 'Resend from email not configured',
    }));
  }

  const results: EmailResult[] = [];
  
  // Resend allows batch sending, but we'll do batches of 50 for safety
  const batchSize = 50;
  
  const fromEmail = env.RESEND_FROM_NAME 
    ? `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`
    : env.RESEND_FROM_EMAIL;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    try {
      // Resend supports batch sending with an array
      const batchPromises = batch.map((email) =>
        resendClient!.emails.send({
          from: fromEmail,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text || email.html.replace(/<[^>]*>/g, ''),
        })
      );

      const responses = await Promise.all(batchPromises);
      
      responses.forEach((response) => {
        if (response.error) {
          results.push({
            success: false,
            error: response.error.message || 'Failed to send email',
          });
        } else {
          results.push({
            success: true,
            messageId: response.data?.id,
          });
        }
      });
    } catch (error: any) {
      console.error(`Error sending email batch ${i}-${i + batch.length}:`, error);
      batch.forEach(() => {
        results.push({
          success: false,
          error: error.message || 'Failed to send email',
        });
      });
    }
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Generate welcome email HTML for volunteer application
 */
export function generateWelcomeEmail(data: {
  firstName: string;
  lastName: string;
  role: 'OBSERVER' | 'VOLUNTEER';
}): string {
  const roleText = data.role === 'OBSERVER' ? 'Observador' : 'Voluntario';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido a Escrutinio Transparente</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Escrutinio Transparente</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #667eea;">¡Gracias por tu interés, ${data.firstName}!</h2>
        
        <p>Hemos recibido tu solicitud para unirte como <strong>${roleText}</strong> en Escrutinio Transparente.</p>
        
        <p>Tu solicitud está siendo revisada por nuestro equipo. Nos pondremos en contacto contigo pronto con más información sobre los próximos pasos.</p>
        
        <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #667eea;">¿Qué sigue?</h3>
          <ul style="padding-left: 20px;">
            <li>Asistir a 2 reuniones informativas</li>
            <li>Participar en un entrenamiento en persona</li>
            <li>Recibirás más detalles próximamente</li>
          </ul>
        </div>
        
        <p style="margin-top: 30px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
          Saludos,<br>
          <strong>Equipo de Escrutinio Transparente</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
        <p>Este es un mensaje automático. Por favor no respondas a este correo.</p>
      </div>
    </body>
    </html>
  `;
}
