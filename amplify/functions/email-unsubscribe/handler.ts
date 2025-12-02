import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: any) => {
  console.log('🔍 Event received:', JSON.stringify(event, null, 2));
  
  // Extract email from query parameters or path
  let email = event.queryStringParameters?.email || event.pathParameters?.email;
  
  console.log('📧 Raw email from query:', email);
  
  // Decode email if it's URL-encoded (handle double encoding from SES tracking)
  if (email) {
    try {
      // Décoder jusqu'à ce qu'on ait un email valide
      while (email.includes('%')) {
        const decoded = decodeURIComponent(email);
        console.log('🔄 Decoded:', email, '→', decoded);
        if (decoded === email) break; // Plus rien à décoder
        email = decoded;
      }
    } catch (e) {
      console.error('❌ Error decoding email:', email, e);
    }
  }
  
  console.log('✅ Final email:', email);
  
  if (!email || !email.includes('@')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `
        <!DOCTYPE html>
        <html>
          <head><title>Erreur</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Erreur</h1>
            <p>Email manquant ou invalide dans la requête.</p>
            <p style="color: #999; font-size: 12px;">Reçu: ${email || 'aucun'}</p>
          </body>
        </html>
      `
    };
  }

  const tableName = process.env.MEMBER_TABLE_NAME;
  
  if (!tableName) {
    console.error('MEMBER_TABLE_NAME environment variable not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration error' }) };
  }

  try {
    // Find member by email using Scan (consider adding GSI on email for production)
    const { Items } = await docClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }));

    if (!Items || Items.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Email introuvable</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>⚠️ Email introuvable</h1>
              <p>Cet email n'est pas enregistré dans notre système.</p>
            </body>
          </html>
        `
      };
    }

    const member = Items[0];

    console.log('👤 Member found:', { id: member.id, email: member.email, license_number: member.license_number });

    // Update accept_mailing to false using the auto-generated 'id' field
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { id: member.id }, // Utiliser 'id' comme clé (auto-généré par Amplify)
      UpdateExpression: 'SET accept_mailing = :false',
      ExpressionAttributeValues: {
        ':false': false
      },
      ReturnValues: 'ALL_NEW' // Retourner l'objet complet après mise à jour
    }));

    console.log('✅ Member updated successfully:', updateResult.Attributes);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Désinscription confirmée</title>
            <meta charset="utf-8">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>✅ Désinscription confirmée</h1>
            <p>Vous ne recevrez plus d'emails de notre part.</p>
            <p>Vous pouvez réactiver les emails à tout moment depuis votre espace membre.</p>
            <br>
            <a href="https://bridgeclubsaintorens.fr" style="color: #007bff;">Retour au site</a>
          </body>
        </html>
      `
    };

  } catch (error: any) {
    console.error('Error updating member:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `
        <!DOCTYPE html>
        <html>
          <head><title>Erreur</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Erreur</h1>
            <p>Une erreur est survenue lors du traitement de votre demande.</p>
          </body>
        </html>
      `
    };
  }
};
