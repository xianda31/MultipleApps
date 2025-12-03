import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

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
  bcc?: string[]
): string {
  const boundary = `----=_Part_${Date.now()}`;
  const attachmentBoundary = `----=_Attachment_${Date.now()}`;
  
  let rawEmail = `From: ${from}\r\n`;
  rawEmail += `To: ${to.join(', ')}\r\n`;
  if (bcc && bcc.length > 0) {
    rawEmail += `Bcc: ${bcc.join(', ')}\r\n`;
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
  const { from, to, cc, subject, bodyText, bodyHtml, attachments } = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  
  console.log('📧 Email request:', { 
    from, 
    to, 
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
    
    // Préparer le HTML avec lien de désinscription générique
    const unsubscribeLink = `<hr style="margin-top: 30px; border: none; border-top: 1px solid #e0e0e0;"><p style="text-align: center; font-size: 12px; color: #999;">Vous ne souhaitez plus recevoir nos emails ? Connectez-vous sur <a href="${apiEndpoint.replace('/api', '')}" style="color: #667eea;">votre espace membre</a> pour gérer vos préférences.</p>`;
    const finalHtml = (bodyHtml || `<p>${bodyText || ''}</p>`) + unsubscribeLink;
    
    // Envoyer chaque lot (sans CC pour éviter les doublons)
    const sendPromises = batches.map(async (batch, index) => {
      console.log(`📤 Sending batch ${index + 1}/${batches.length} with ${batch.length} recipient(s)`);
      
      // Si des pièces jointes, utiliser SendRawEmailCommand
      if (attachments && attachments.length > 0) {
        const rawEmail = createRawEmail(from, batch, subject, finalHtml, attachments);
        return ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawEmail) } }));
      }
      
      const params = {
        Source: from,
        Destination: { 
          ToAddresses: batch
        },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: finalHtml } }
        },
      };
      
      return ses.send(new SendEmailCommand(params));
    });
    
    // Si un CC est défini, envoyer un email séparé en CC avec tous les destinataires en BCC
    if (cc && cc.length > 0) {
      console.log(`📧 Sending CC copy to ${cc.join(', ')} with all recipients in BCC`);
      
      // SES limite aussi les BCC à 50, donc on envoie plusieurs emails CC si nécessaire
      const ccBatches: string[][] = [];
      for (let i = 0; i < validRecipients.length; i += MAX_RECIPIENTS_PER_BATCH) {
        ccBatches.push(validRecipients.slice(i, i + MAX_RECIPIENTS_PER_BATCH));
      }
      
      const ccPromises = ccBatches.map(async (bccBatch, index) => {
        // Si des pièces jointes, utiliser SendRawEmailCommand
        if (attachments && attachments.length > 0) {
          const rawEmail = createRawEmail(from, cc, subject, finalHtml, attachments, bccBatch);
          return ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawEmail) } }));
        }
        
        const ccParams = {
          Source: from,
          Destination: { 
            ToAddresses: cc,
            BccAddresses: bccBatch
          },
          Message: {
            Subject: { Data: subject },
            Body: { Html: { Data: finalHtml } }
          },
        };
        
        return ses.send(new SendEmailCommand(ccParams));
      });
      
      sendPromises.push(...ccPromises);
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
