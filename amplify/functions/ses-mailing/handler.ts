import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const ses = new SESClient({ region: process.env.AWS_REGION });
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Fonction pour créer un email MIME avec pièces jointes
function createRawEmail(
  from: string, 
  to: string[], 
  subject: string, 
  htmlBody: string, 
  attachments: Array<{filename: string, content: string, contentType: string}>,
  bcc?: string[],
  replyTo?: string
): string {
  const boundary = `----=_Part_${Date.now()}`;
  const attachmentBoundary = `----=_Attachment_${Date.now()}`;
  
  let rawEmail = `From: ${from}\r\n`;
  rawEmail += `To: ${to.join(', ')}\r\n`;
  if (bcc && bcc.length > 0) {
    rawEmail += `Bcc: ${bcc.join(', ')}\r\n`;
  }
  if (replyTo) {
    rawEmail += `Reply-To: ${replyTo}\r\n`;
  }
  rawEmail += `Subject: ${subject}\r\n`;
  rawEmail += `MIME-Version: 1.0\r\n`;
  rawEmail += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  
  // Corps HTML
  rawEmail += `--${boundary}\r\n`;
  rawEmail += `Content-Type: text/html; charset=UTF-8\r\n`;
  rawEmail += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
  rawEmail += `${htmlBody}\r\n\r\n`;
  
  // Pièces jointes
  for (const attachment of attachments) {
    rawEmail += `--${boundary}\r\n`;
    rawEmail += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
    rawEmail += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
    rawEmail += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawEmail += `${attachment.content}\r\n\r\n`;
  }
  
  rawEmail += `--${boundary}--`;
  
  return rawEmail;
}

// ── Survey send handler ────────────────────────────────────────────────────

async function handleSurveySend(body: any, event: any) {
  const {
    surveyId,
    subject,
    emailTemplate,   // HTML complet avec [SURVEY_LINK] comme marqueur
    closingDate,
    recipients,      // Array<{ email, name, memberId?, isExternal? }>
    from,
  } = body;

  if (!surveyId || !subject || !emailTemplate || !recipients?.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields for survey send' }) };
  }

  const surveyTokenTable = process.env.SURVEY_TOKEN_TABLE_NAME;
  if (!surveyTokenTable) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SURVEY_TOKEN_TABLE_NAME not configured' }) };
  }

  const fromAddress = from || '"Bridge Club Saint-Orens" <noreply@bridgeclubsaintorens.fr>';
    const publicBaseUrl = (body.baseUrl as string | undefined)?.replace(/\/$/, '')
      || process.env.PUBLIC_BASE_URL?.replace(/\/$/, '')
      || 'https://admin.bridgeclubsaintorens.fr';
  const apiEndpoint = process.env.API_ENDPOINT
    || (event.requestContext?.domainName ? `https://${event.requestContext.domainName}` : publicBaseUrl);

  const expiresAt = closingDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const results: { email: string; status: 'sent' | 'error'; error?: string }[] = [];

  for (const recipient of recipients) {
    const token = randomUUID();
    const surveyLink = `${publicBaseUrl}/front/sondage?token=${token}`;

    try {
      // 1. Persister le token
      await docClient.send(new PutCommand({
        TableName: surveyTokenTable,
        Item: {
          token,
          surveyId,
          memberId: recipient.memberId || recipient.email,
          memberEmail: recipient.email,
          memberName: recipient.name || '',
          expiresAt,
          lastActivityAt: now,
        },
      }));

      // 2. Email personnalisé : remplacer [SURVEY_LINK] + ajouter désinscription
      const isExternalRecipient = recipient.isExternal === true || !recipient.memberId;
      const unsubscribeLink = isExternalRecipient
        ? ''
        : `<hr style="margin-top:30px;border:none;border-top:1px solid #e0e0e0"><p style="text-align:center;font-size:12px;color:#999">Vous ne souhaitez plus recevoir nos emails ? <a href="${apiEndpoint}/api/unsubscribe?email=${encodeURIComponent(recipient.email)}" style="color:#667eea">Cliquez ici pour vous désinscrire</a>.</p>`;
      const personalizedHtml = emailTemplate
        .replace(/\[SURVEY_LINK\]/g, surveyLink)
        .replace('</body>', unsubscribeLink + '</body>');

      await ses.send(new SendEmailCommand({
        Source: fromAddress,
        Destination: { ToAddresses: [recipient.email] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: personalizedHtml, Charset: 'UTF-8' } },
        },
      }));

      results.push({ email: recipient.email, status: 'sent' });
      console.log(`✅ Survey ${surveyId} sent to ${recipient.email} token=${token}`);

    } catch (err: any) {
      console.error(`❌ Survey send failed for ${recipient.email}:`, err);
      results.push({ email: recipient.email, status: 'error', error: err.message });
    }
  }

  const sentCount = results.filter(r => r.status === 'sent').length;
  const errors = results.filter(r => r.status === 'error');

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, sentCount, errorCount: errors.length, errors }),
  };
}

export const handler = async (event: any) => {
  // Vérifier l'authentification et les groupes
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  
  if (!claims) {
    return { 
      statusCode: 401, 
      body: JSON.stringify({ error: 'Unauthorized: Authentication required' }) 
    };
  }

  // Extraire les groupes Cognito (peut être un string JSON ou un array)
  let groups = claims['cognito:groups'];
  
  // Si c'est une string, essayer de la parser
  if (typeof groups === 'string') {
    try {
      // Remplacer les espaces par des virgules pour créer un JSON valide
      // "[Membre Systeme Administrateur]" -> ["Membre","Systeme","Administrateur"]
      groups = groups.replace(/\[|\]/g, '').split(' ');
    } catch (e) {
      console.error('Failed to parse groups:', groups);
      groups = [];
    }
  }
  
  const userGroups = Array.isArray(groups) ? groups : (groups ? [groups] : []);
  
  // Vérifier si l'utilisateur appartient à Administrateur ou Systeme
  const allowedGroups = ['Administrateur', 'Systeme'];
  const hasAccess = userGroups.some((group: string) => allowedGroups.includes(group));
  
  if (!hasAccess) {
    return { 
      statusCode: 403, 
      body: JSON.stringify({ 
        error: 'Forbidden: Access restricted to Administrateur and Systeme groups',
        userGroups,
        receivedGroups: claims['cognito:groups']
      }) 
    };
  }

  // event.body est stringifié si appelé via API Gateway HTTP
  const parsedBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

  // ── Mode sondage : surveyId fourni dans le body ────────────────────────────
  if (parsedBody.surveyId) {
    return handleSurveySend(parsedBody, event);
  }

  const { from, to, cc, subject, bodyText, bodyHtml, attachments, replyTo } = parsedBody;
  
  console.log('📧 Email request:', { 
    from, 
    to, 
    replyTo,
    subject, 
    bodyHtmlLength: bodyHtml?.length || 0,
    bodyHtmlPreview: bodyHtml?.substring(0, 200) || 'N/A'
  });
  
  if (!from || !to || !subject) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }
  
  const apiEndpoint = process.env.API_ENDPOINT || event.requestContext?.domainName 
    ? `https://${event.requestContext.domainName}` 
    : 'https://your-api.amazonaws.com';
  
  try {
    // Préparer la liste des destinataires
    const recipients = Array.isArray(to) ? to : [to];
    
    // Récupérer les membres depuis DynamoDB pour vérifier accept_mailing
    const tableName = process.env.MEMBER_TABLE_NAME;
    if (!tableName) {
      console.error('MEMBER_TABLE_NAME environment variable not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuration error' }) };
    }
    
    const { Items: members } = await docClient.send(new ScanCommand({
      TableName: tableName,
      ProjectionExpression: 'email, accept_mailing'
    }));
    
    // Créer un Map pour un accès rapide
    const memberMap = new Map(
      (members || []).map((m: any) => [m.email, m.accept_mailing !== false]) // Par défaut true si non défini
    );
    
    // Filtrer les destinataires qui acceptent les mailings
    const skippedRecipients: string[] = [];
    const validRecipients = recipients.filter((email: string) => {
      const acceptsMailing = memberMap.get(email);
      if (acceptsMailing === false) {
        console.log(`❌ Skipping ${email} - accept_mailing is false`);
        skippedRecipients.push(email);
        return false;
      }
      return true;
    });
    
    if (validRecipients.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          sentCount: 0,
          skippedCount: recipients.length,
          skippedRecipients,
          message: 'No valid recipients (all have accept_mailing = false)'
        })
      };
    }
    
    // AWS SES limite: 50 destinataires par appel sendEmail
    const MAX_RECIPIENTS_PER_BATCH = 50;
    const batches: string[][] = [];
    
    // Diviser les destinataires en lots de 50
    for (let i = 0; i < validRecipients.length; i += MAX_RECIPIENTS_PER_BATCH) {
      batches.push(validRecipients.slice(i, i + MAX_RECIPIENTS_PER_BATCH));
    }
    
    console.log(`📦 Sending to ${validRecipients.length} recipients in ${batches.length} batch(es)`);
    
    // Envoyer chaque email individuellement pour personnaliser le lien de désinscription
    const sendPromises = validRecipients.map(async (recipientEmail) => {
      const unsubscribeLink = `<hr style="margin-top: 30px; border: none; border-top: 1px solid #e0e0e0;"><p style="text-align: center; font-size: 12px; color: #999;">Vous ne souhaitez plus recevoir nos emails ? <a href="${apiEndpoint}/unsubscribe?email=${encodeURIComponent(recipientEmail)}" style="color: #667eea;">Cliquez ici pour vous désinscrire</a>.</p>`;
      const personalizedHtml = (bodyHtml || `<p>${bodyText || ''}</p>`) + unsubscribeLink;
      
      // Si des pièces jointes, utiliser SendRawEmailCommand
      if (attachments && attachments.length > 0) {
        const rawEmail = createRawEmail(from, [recipientEmail], subject, personalizedHtml, attachments, undefined, replyTo);
        return ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawEmail) } }));
      }
      
      // Sans pièce jointe, utiliser SendEmailCommand
      const params: any = {
        Source: from,
        Destination: { 
          ToAddresses: [recipientEmail]
        },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: personalizedHtml } }
        },
      };
      
      if (replyTo) {
        params.ReplyToAddresses = [replyTo];
      }
      
      return ses.send(new SendEmailCommand(params));
    });
    
    // Si un CC est défini, envoyer un email séparé au CC (sans lien de désinscription personnalisé)
    if (cc && cc.length > 0) {
      console.log(`📧 Sending CC copy to ${cc.join(', ')}`);
      
      const ccUnsubscribeLink = `<hr style="margin-top: 30px; border: none; border-top: 1px solid #e0e0e0;"><p style="text-align: center; font-size: 12px; color: #999;">Email envoyé en copie pour suivi.</p>`;
      const ccHtml = (bodyHtml || `<p>${bodyText || ''}</p>`) + ccUnsubscribeLink;
      
      const ccPromise = async () => {
        // Si des pièces jointes, utiliser SendRawEmailCommand
        if (attachments && attachments.length > 0) {
          const rawEmail = createRawEmail(from, cc, subject, ccHtml, attachments, undefined, replyTo);
          return ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawEmail) } }));
        }
        
        const ccParams: any = {
          Source: from,
          Destination: { 
            ToAddresses: cc
          },
          Message: {
            Subject: { Data: subject },
            Body: { Html: { Data: ccHtml } }
          },
        };
        
        if (replyTo) {
          ccParams.ReplyToAddresses = [replyTo];
        }
        
        return ses.send(new SendEmailCommand(ccParams));
      };
      
      sendPromises.push(ccPromise());
    }
    
    const results = await Promise.all(sendPromises);
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        success: true, 
        sentCount: validRecipients.length,
        skippedCount: recipients.length - validRecipients.length,
        skippedRecipients,
        totalRecipients: recipients.length,
        results 
      }) 
    };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
