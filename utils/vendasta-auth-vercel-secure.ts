import crypto from 'crypto';

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  user_id?: string;
}

// Utility function for base64url encoding
function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

// Utility function to coerce PEM format
function coercePem(pem: string): string {
  if (!pem) throw new Error('Private key missing');
  // If pasted with \n escapes, convert to real newlines
  if (typeof pem === 'string' && pem.includes('\\n')) {
    pem = pem.replace(/\\n/g, '\n');
  }
  return pem;
}

// SECURE: Load credentials from Vercel Secret (not environment variable)
async function loadServiceAccountCredentials(): Promise<ServiceAccountCredentials> {
  try {
    // In Vercel, secrets are available as environment variables with @ prefix
    // But for better security, we'll use a different approach
    const serviceAccountJson = process.env.VEND_SERVICE_ACCOUNT_SECRET;
    
    if (!serviceAccountJson) {
      throw new Error('Missing VEND_SERVICE_ACCOUNT_SECRET - please add as Vercel Secret');
    }
    
    const credentials: ServiceAccountCredentials = JSON.parse(serviceAccountJson);
    
    // Validate required fields
    if (!credentials.private_key || !credentials.client_email || !credentials.token_uri) {
      throw new Error('Service account JSON missing required fields: private_key, client_email, or token_uri');
    }
    
    return credentials;
  } catch (error) {
    throw new Error(`Failed to load service account credentials: ${error}`);
  }
}

export async function generateJWTAssertion(): Promise<string> {
  try {
    const credentials = await loadServiceAccountCredentials();
    
    // Configuration for JWT assertion
    const ISS = credentials.client_email;
    const SUB = credentials.client_email;
    const TOKEN_URI = credentials.token_uri;
    const KID = credentials.private_key_id;
    const PRIVATE_KEY_PEM = credentials.private_key;

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: ISS,
      sub: SUB || ISS,
      aud: TOKEN_URI,
      iat: now,
      nbf: now - 30,
      exp: now + 300, // 5 min assertion
      jti: crypto.randomUUID(),
    };

    const header: any = { alg: 'RS256', typ: 'JWT' };
    if (KID) header.kid = KID;

    const h = b64url(Buffer.from(JSON.stringify(header)));
    const p = b64url(Buffer.from(JSON.stringify(payload)));
    const data = `${h}.${p}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(data);
    signer.end();
    const sig = signer.sign(coercePem(PRIVATE_KEY_PEM));
    const jwt = `${data}.${b64url(sig)}`;

    return jwt;
  } catch (error) {
    throw new Error(`Failed to generate JWT assertion: ${error}`);
  }
}

export async function getAccessToken(assertion: string, tokenUri: string): Promise<string> {
  try {
    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assertion,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
  } catch (error) {
    throw new Error(`Failed to get access token: ${error}`);
  }
}

export async function getVendastaAuthToken(): Promise<string> {
  // Step 1: Generate JWT assertion
  const assertion = await generateJWTAssertion();
  
  // Step 2: Get the token URI from the service account credentials
  const credentials = await loadServiceAccountCredentials();
  const tokenUri = credentials.token_uri;
  
  // Step 3: Exchange assertion for access token
  const accessToken = await getAccessToken(assertion, tokenUri);
  
  return accessToken;
}
