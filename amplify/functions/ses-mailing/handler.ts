import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const ses = new SESClient({ region: process.env.AWS_REGION });
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const BATCH_CONCURRENCY = 10;

interface MessageRecipient {
  email: string;
  name?: string;
}

function normalizeRecipients(values: unknown): MessageRecipient[] {
  if (!Array.isArray(values)) return [];

  const recipients = values
    .map((value): MessageRecipient | null => {
      if (typeof value === 'string') {
        const email = value.trim().toLowerCase();
        return email ? { email } : null;
      }
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
        const name = typeof record.name === 'string' ? record.name.trim() : '';
        return email ? { email, name } : null;
      }
      return null;
    })
    .filter((recipient): recipient is MessageRecipient => recipient !== null);

  return [...new Map(recipients.map((recipient) => [recipient.email, recipient])).values()];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function appendHtml(bodyHtml: string, addition: string): string {
  return bodyHtml.includes('</body>')
    ? bodyHtml.replace('</body>', `${addition}</body>`)
    : `${bodyHtml}${addition}`;
}

function buildRecipientManifest(
  recipients: MessageRecipient[],
  sentEmails: Set<string>,
  skippedEmails: Set<string>,
  failedEmails: Set<string>,
): string {
  const rows = recipients.map((recipient) => {
    const status = sentEmails.has(recipient.email)
      ? 'Envoyé'
      : skippedEmails.has(recipient.email)
        ? 'Exclu — refus des mailings'
        : failedEmails.has(recipient.email)
          ? 'Échec'
          : 'Non envoyé';
    const identity = recipient.name
      ? `${escapeHtml(recipient.name)} &lt;${escapeHtml(recipient.email)}&gt;`
      : escapeHtml(recipient.email);
    return `<tr><td style="padding:4px 8px;border-bottom:1px solid #ddd">${identity}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd">${status}</td></tr>`;
  }).join('');

  return `<hr style="margin-top:30px;border:none;border-top:1px solid #cfd4da">
    <h3 style="font-size:16px">Compte rendu des destinataires</h3>
    <p>${sentEmails.size} envoyé(s) · ${skippedEmails.size} exclu(s) · ${failedEmails.size} échec(s)</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr><th style="padding:4px 8px;text-align:left;border-bottom:2px solid #aaa">Destinataire</th><th style="padding:4px 8px;text-align:left;border-bottom:2px solid #aaa">Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorName = error?.name || '';
      const isRetryable =
        errorName === 'Throttling' ||
        errorName === 'ThrottlingException' ||
        errorName === 'TooManyRequestsException' ||
        errorName === 'ServiceUnavailable' ||
        error?.$retryable;

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      await sleep(250 * attempt);
    }
  }

  throw lastError;
}

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
    copyRecipients,
    from,
    cc,
    replyTo,
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
  const primaryRecipients = normalizeRecipients(recipients);
  const sentEmails = new Set(results.filter(result => result.status === 'sent').map(result => result.email.toLowerCase()));
  const failedEmails = new Set(results.filter(result => result.status === 'error').map(result => result.email.toLowerCase()));
  const manifest = buildRecipientManifest(primaryRecipients, sentEmails, new Set(), failedEmails);
  const trackingRecipients = normalizeRecipients(cc);
  const requestedCopyRecipients = normalizeRecipients(copyRecipients);
  const primaryEmails = new Set(primaryRecipients.map(recipient => recipient.email));
  const allCopyRecipients = normalizeRecipients([...trackingRecipients, ...requestedCopyRecipients])
    .filter(recipient => !primaryEmails.has(recipient.email));
  const ccRequested = trackingRecipients.length > 0;
  const copyRequested = allCopyRecipients.length > 0;
  const copyFailures: Array<{ email: string; error: string }> = [];
  const copyMessageIds: string[] = [];
  const ccHtml = appendHtml(
    emailTemplate.replace(/\[SURVEY_LINK\]/g, '#'),
    `<p style="font-size:12px;color:#777">Les liens de sondage envoyés aux destinataires sont individualisés et ne figurent pas dans cette copie.</p>${manifest}`,
  );

  for (const copyRecipient of allCopyRecipients) {
    try {
      let messageId: string | undefined;
      if (body.attachments?.length) {
        const rawEmail = createRawEmail(fromAddress, [copyRecipient.email], `[COPIE] ${subject}`, ccHtml, body.attachments, undefined, replyTo);
        const result = await sendWithRetry(() => ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawEmail) } })));
        messageId = (result as any)?.MessageId;
      } else {
        const params: any = {
          Source: fromAddress,
          Destination: { ToAddresses: [copyRecipient.email] },
          Message: {
            Subject: { Data: `[COPIE] ${subject}`, Charset: 'UTF-8' },
            Body: { Html: { Data: ccHtml, Charset: 'UTF-8' } },
          },
        };
        if (replyTo) params.ReplyToAddresses = [replyTo];
        const result = await sendWithRetry(() => ses.send(new SendEmailCommand(params)));
        messageId = (result as any)?.MessageId;
      }
      if (messageId) copyMessageIds.push(messageId);
    } catch (error: any) {
      copyFailures.push({ email: copyRecipient.email, error: error?.message || 'Copy send failed' });
    }
  }

  const ccRecipient = trackingRecipients[0]?.email;
  const ccSent = !ccRequested || !ccRecipient || !copyFailures.some(failure => failure.email === ccRecipient);
  const ccError = ccRecipient ? copyFailures.find(failure => failure.email === ccRecipient)?.error : undefined;
  const ccMessageId = copyMessageIds[0];

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      sentCount,
      errorCount: errors.length,
      errors,
      ccRequested,
      ccSent,
      ccError,
      ccMessageId,
      ccRecipient,
      copyRequested,
      copySentCount: allCopyRecipients.length - copyFailures.length,
      copyFailures,
    }),
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

  const { from, to, recipientDetails, copyRecipients, cc, subject, bodyText, bodyHtml, attachments, replyTo } = parsedBody;
  
  console.log('📧 Email request:', { 
    from, 
    recipientCount: Array.isArray(to) ? to.length : (to ? 1 : 0),
    ccCount: Array.isArray(cc) ? cc.length : (cc ? 1 : 0),
    replyTo,
    subject, 
    bodyHtmlLength: bodyHtml?.length || 0,
    bodyHtmlPreview: bodyHtml?.substring(0, 200) || 'N/A'
  });
  
  if (!from || !to || !subject) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }
  
  const apiEndpoint = process.env.API_ENDPOINT
    || (event.requestContext?.domainName ? `https://${event.requestContext.domainName}` : 'https://your-api.amazonaws.com');
  
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
    
    // Limiter la concurrence pour eviter le throttling SES sur les envois massifs.
    const MAX_RECIPIENTS_PER_BATCH = BATCH_CONCURRENCY;
    const batches: string[][] = [];
    
    // Diviser les destinataires en lots de taille limitee
    for (let i = 0; i < validRecipients.length; i += MAX_RECIPIENTS_PER_BATCH) {
      batches.push(validRecipients.slice(i, i + MAX_RECIPIENTS_PER_BATCH));
    }
    
    console.log(`📦 Sending to ${validRecipients.length} recipients in ${batches.length} batch(es) of ${MAX_RECIPIENTS_PER_BATCH}`);

    // Envoyer chaque email individuellement pour personnaliser le lien de desinscription
    const sendOneEmail = async (recipientEmail: string) => {
      const unsubscribeLink = `<hr style="margin-top: 30px; border: none; border-top: 1px solid #e0e0e0;"><p style="text-align: center; font-size: 12px; color: #999;">Vous ne souhaitez plus recevoir nos emails ? <a href="${apiEndpoint}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}" style="color: #667eea;">Cliquez ici pour vous désinscrire</a>.</p>`;
      const personalizedHtml = (bodyHtml || `<p>${bodyText || ''}</p>`) + unsubscribeLink;
      
      // Si des pièces jointes, utiliser SendRawEmailCommand
      if (attachments && attachments.length > 0) {
        const rawEmail = createRawEmail(from, [recipientEmail], subject, personalizedHtml, attachments, undefined, replyTo);
        return sendWithRetry(() => ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawEmail) } })));
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
      
      return sendWithRetry(() => ses.send(new SendEmailCommand(params)));
    };

    const failures: Array<{ email: string; error: string }> = [];
    let sentCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const settled = await Promise.allSettled(batch.map((recipientEmail) => sendOneEmail(recipientEmail)));
      settled.forEach((result, index) => {
        const email = batch[index];
        if (result.status === 'fulfilled') {
          sentCount += 1;
          return;
        }

        const reason: any = result.reason;
        failures.push({
          email,
          error: reason?.message || String(reason) || 'Unknown SES error',
        });
      });
      console.log('[SES_MAILING] batch:complete', {
        batch: batchIndex + 1,
        batchCount: batches.length,
        sentCount,
        failureCount: failures.length,
      });
    }

    const detailsByEmail = new Map(normalizeRecipients(recipientDetails).map(recipient => [recipient.email, recipient]));
    const primaryRecipients = normalizeRecipients(recipients).map(recipient => detailsByEmail.get(recipient.email) ?? recipient);
    const failedEmails = new Set(failures.map(failure => failure.email.toLowerCase()));
    const skippedEmails = new Set(skippedRecipients.map((email: string) => email.toLowerCase()));
    const sentEmails = new Set(validRecipients
      .map((email: string) => email.toLowerCase())
      .filter((email: string) => !failedEmails.has(email)));
    const manifest = buildRecipientManifest(primaryRecipients, sentEmails, skippedEmails, failedEmails);
    const trackingRecipients = normalizeRecipients(cc);
    const requestedCopyRecipients = normalizeRecipients(copyRecipients);
    const primaryEmails = new Set(primaryRecipients.map(recipient => recipient.email));
    const allCopyRecipients = normalizeRecipients([...trackingRecipients, ...requestedCopyRecipients])
      .filter(recipient => !primaryEmails.has(recipient.email));
    const ccRequested = trackingRecipients.length > 0;
    const copyRequested = allCopyRecipients.length > 0;
    const copyFailures: Array<{ email: string; error: string }> = [];
    const copyResults: Array<{ email: string; messageId?: string }> = [];
    const copyHtml = appendHtml(
      bodyHtml || `<p>${bodyText || ''}</p>`,
      `<p style="font-size:12px;color:#777">Copie de suivi : aucun lien de désinscription destinataire n’est inclus.</p>${manifest}`,
    );

    for (const copyRecipient of allCopyRecipients) {
      try {
        let messageId: string | undefined;
        if (attachments && attachments.length > 0) {
          const rawEmail = createRawEmail(from, [copyRecipient.email], `[COPIE] ${subject}`, copyHtml, attachments, undefined, replyTo);
          const result = await sendWithRetry(() => ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawEmail) } })));
          messageId = (result as any)?.MessageId;
        } else {
          const params: any = {
            Source: from,
            Destination: { ToAddresses: [copyRecipient.email] },
            Message: {
              Subject: { Data: `[COPIE] ${subject}` },
              Body: { Html: { Data: copyHtml } },
            },
          };
          if (replyTo) params.ReplyToAddresses = [replyTo];
          const result = await sendWithRetry(() => ses.send(new SendEmailCommand(params)));
          messageId = (result as any)?.MessageId;
        }
        copyResults.push({ email: copyRecipient.email, messageId });
      } catch (error: any) {
        copyFailures.push({ email: copyRecipient.email, error: error?.message || 'Copy send failed' });
      }
    }

    const ccRecipient = trackingRecipients[0]?.email;
    const ccResult = ccRecipient ? copyResults.find(result => result.email === ccRecipient) : undefined;
    const ccFailure = ccRecipient ? copyFailures.find(failure => failure.email === ccRecipient) : undefined;
    const ccSent = !!ccResult;
    const ccError = ccFailure?.error;
    const ccMessageId = ccResult?.messageId;

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        success: true, 
        sentCount,
        failureCount: failures.length,
        failures,
        skippedCount: recipients.length - validRecipients.length,
        skippedRecipients,
        totalRecipients: recipients.length,
        ccRequested,
        ccSent,
        ccError,
        ccMessageId,
        ccRecipient,
        copyRequested,
        copySentCount: copyResults.length,
        copyFailures,
      }) 
    };
  } catch (err: any) {
    console.error('[SES_MAILING] request:error', {
      errorName: err?.name || 'UnknownError',
      errorMessage: err?.message || String(err),
      httpStatusCode: err?.$metadata?.httpStatusCode,
      requestId: err?.$metadata?.requestId,
    });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
