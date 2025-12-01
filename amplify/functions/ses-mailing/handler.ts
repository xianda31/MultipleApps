import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
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
