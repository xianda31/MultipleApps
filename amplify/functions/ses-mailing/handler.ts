import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  // Vérifier l'authentification et les groupes
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims) {
    return { 
      statusCode: 401, 
      body: JSON.stringify({ error: 'Unauthorized: Authentication required' }) 
    };
  }

  // Extraire les groupes Cognito
  const groups = claims['cognito:groups'];
  const userGroups = Array.isArray(groups) ? groups : (groups ? [groups] : []);
  
  // Vérifier si l'utilisateur appartient à Administrateur ou Systeme
  const allowedGroups = ['Administrateur', 'Systeme'];
  const hasAccess = userGroups.some((group: string) => allowedGroups.includes(group));
  
  if (!hasAccess) {
    return { 
      statusCode: 403, 
      body: JSON.stringify({ 
        error: 'Forbidden: Access restricted to Administrateur and Systeme groups',
        userGroups 
      }) 
    };
  }

  // event.body est stringifié si appelé via API Gateway HTTP
  const { from, to, subject, bodyText, bodyHtml } = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  if (!from || !to || !subject) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }
  try {
    const params = {
      Source: from,
      Destination: { ToAddresses: Array.isArray(to) ? to : [to] },
      Message: {
        Subject: { Data: subject },
        Body: bodyHtml
          ? { Html: { Data: bodyHtml } }
          : { Text: { Data: bodyText || '' } },
      },
    };
    const result = await ses.send(new SendEmailCommand(params));
    return { statusCode: 200, body: JSON.stringify({ success: true, result }) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
