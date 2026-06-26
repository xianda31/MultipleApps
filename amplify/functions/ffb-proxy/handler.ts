import { Handler } from "aws-lambda";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({ region: process.env.AWS_REGION || "eu-west-3" });

function isProxyDebugEnabled(): boolean {
  return (process.env.FFB_PROXY_DEBUG || "false").toLowerCase() === "true";
}

function asBearerToken(token: string): string {
  const trimmed = (token || "").trim();
  if (!trimmed) {
    console.warn("[FFB API] asBearerToken: Empty token provided!");
    return "";
  }
  const result = trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
  const preview = result.substring(0, 30) + "..." + result.substring(result.length - 10);
  console.log(`[FFB API] asBearerToken: Prepared token: ${preview}`);
  return result;
}

interface FFBApiConfig {
  baseUrl: string;
  token: string;
}

// FFB V2 API Configuration
const FFB_API_V2: FFBApiConfig = {
  baseUrl: process.env.FFB_API_V2_BASE_URL || "https://api-lancelot.ffbridge.fr/",
  token: "",
};

async function loadV2Token(): Promise<void> {
  try {
    console.log("[FFB API] Loading V2 token from SSM Parameter Store...");
    const response = await ssmClient.send(
      new GetParameterCommand({
        Name: "FFB_API_V2_TOKEN",
        WithDecryption: true,
      })
    );
    const tokenValue = response.Parameter?.Value || "";
    FFB_API_V2.token = asBearerToken(tokenValue);
    const preview = FFB_API_V2.token.substring(0, 30) + "..." + FFB_API_V2.token.substring(FFB_API_V2.token.length - 20);
    console.log(`[FFB API] ✅ V2 token loaded from SSM: ${preview}`);
  } catch (error) {
    const message = `[FFB API] ❌ CRITICAL: Failed to fetch token from SSM Parameter Store: ${error}. Token is required. Please manually update FFB_API_V2_TOKEN in AWS SSM.`;
    console.error(message);
    throw new Error(message);
  }
}

const CLUB_CODE = process.env.FFB_CLUB_CODE || "5500020";
const CLUB_GROUP_ID = process.env.FFB_GROUP_ID || "21334";

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function fetchFFBApi(
  ffbEndpoint: string,
  options?: RequestInit,
  clientToken?: string,
  requiresAuth: boolean = true
): Promise<any> {
  // Only load token if endpoint requires authentication
  if (requiresAuth) {
    // Always load from SSM first. Only use clientToken if it's explicitly provided via x-ffb-token
    if (clientToken) {
      FFB_API_V2.token = clientToken;
      console.log("[FFB API] Using explicit x-ffb-token from client");
    } else {
      // Load from SSM or use fallback
      await loadV2Token();
    }
  } else {
    console.log(`[FFB API] Public endpoint, skipping authentication for ${ffbEndpoint}`);
  }

  const baseUrl = FFB_API_V2.baseUrl.endsWith("/") ? FFB_API_V2.baseUrl : `${FFB_API_V2.baseUrl}/`;
  const url = baseUrl + ffbEndpoint;
  const method = options?.method || "GET";

  console.log(`[FFB API] V2 ${method} ${ffbEndpoint} (auth=${requiresAuth})`);
  
  if (requiresAuth) {
    const tokenPreview = FFB_API_V2.token.substring(0, 30) + "..." + FFB_API_V2.token.substring(FFB_API_V2.token.length - 10);
    console.log(`[FFB API] Token: ${tokenPreview} (length=${FFB_API_V2.token.length})`);
  }

  try {
    const headers: Record<string, string> = {};
    if (options?.headers && typeof options.headers === 'object') {
      Object.assign(headers, options.headers);
    }
    if (requiresAuth && FFB_API_V2.token) {
      headers.Authorization = FFB_API_V2.token;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const rawBody = await response.text();
    let data: any = null;
    try {
      data = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      data = {
        error: "Non-JSON upstream response",
        upstreamStatus: response.status,
        body: rawBody,
      };
    }

    console.log(`[FFB API] Response status=${response.status} for ${ffbEndpoint}`);

    if (!response.ok) {
      const sample = rawBody.length > 200 ? rawBody.substring(0, 200) + "..." : rawBody;
      console.error(`[FFB API][ERR] Upstream status=${response.status} endpoint=${ffbEndpoint} body=${sample}`);

      if (data && typeof data === "object") {
        data.upstreamStatus = response.status;
        data.upstreamOk = false;
        data.endpoint = ffbEndpoint;
      }
      return data;
    }

    return data;
  } catch (error) {
    console.error(`[FFB API] Error fetching ${ffbEndpoint}:`, error);
    throw error;
  }
}

function httpResponse(statusCode: number, data: any): any {
  return {
    statusCode,
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  };
}

function requiresAuthentication(route: string): boolean {
  // Public endpoints that don't need authentication
  const publicEndpoints = [
    "ffb/seasons/current",
    "ffb/seasons/next",
    "ffb/organizations",
  ];
  return !publicEndpoints.includes(route);
}

export const handler: Handler = async (event) => {
  try {
    const xFfbToken = event.headers?.["x-ffb-token"];
    console.log("[FFB API] Available headers:", Object.keys(event.headers || {}));

    // Only use explicit x-ffb-token header, IGNORE Authorization (it's AWS SigV4, not FFB token)
    const clientToken = xFfbToken ? asBearerToken(xFfbToken) : undefined;

    if (clientToken) {
      const preview = clientToken.substring(0, 30) + "..." + clientToken.substring(clientToken.length - 20);
      console.log(`[FFB API] Client x-ffb-token received: ${preview}`);
    } else {
      console.log("[FFB API] No x-ffb-token header, will load from SSM");
    }

    const route = `ffb/${event.pathParameters?.proxy || ""}`;
    const queryParams = event.queryStringParameters || {};
    const method = event.requestContext?.http.method || "GET";

    console.log(`[FFB API] Route: ${route}`);

    let ffbEndpoint: string;

    switch (route) {
      case "ffb/seasons/current":
        ffbEndpoint = "seasons/current";
        break;
      case "ffb/seasons/next":
        ffbEndpoint = "seasons/next";
        break;

      case "ffb/persons/search":
        {
          const params = new URLSearchParams();
          if (queryParams.name) params.set("name", queryParams.name);
          params.set("sortField", queryParams.sortField || "lastName");
          if (queryParams.alive) params.set("alive", queryParams.alive);
          ffbEndpoint = `persons/search?${params.toString()}`;
        }
        break;

      case "ffb/club-members":
        {
          const params = new URLSearchParams();
          params.set("ffbCode", CLUB_CODE);
          if (queryParams.seasonId) params.set("seasonId", queryParams.seasonId);
          params.set("currentPage", queryParams.currentPage || "1");
          params.set("maxPerPage", "80");
          params.set("sortField", "lastName");
          ffbEndpoint = `persons/search?${params.toString()}`;
        }
        break;

      case "ffb/club-sessions":
        {
          const now = new Date();
          const dateFrom = formatDateYYYYMMDD(now);
          const dateTo = formatDateYYYYMMDD(addDays(now, 28));

          const params = new URLSearchParams();
          params.set("dateFrom", dateFrom);
          params.set("dateTo", dateTo);
          params.set("currentPage", "1");
          params.set("maxPerPage", "80");
          params.set("groupId", CLUB_GROUP_ID);
          params.append("context[]", "groupSession.entryCount");

          ffbEndpoint = `competitions/groupSessions/search?${params.toString()}`;
        }
        break;

      case "ffb/organizations":
        ffbEndpoint = "organizations/all";
        break;

      case "ffb/person":
        if (!queryParams.id) {
          return httpResponse(400, { error: "Missing person id" });
        }
        ffbEndpoint = `persons/${queryParams.id}`;
        break;

      case "ffb/competition-results":
        if (!queryParams.competition_id || !queryParams.organization_id) {
          return httpResponse(400, { error: "Missing competition_id or organization_id" });
        }
        ffbEndpoint = `competitions/${queryParams.competition_id}/organizations/${queryParams.organization_id}/final-ranking`;
        break;

      case "ffb/competition-phases":
        if (!queryParams.competition_id) {
          return httpResponse(400, { error: "Missing competition_id" });
        }
        {
          const org_id = queryParams.organization_id || "1";
          ffbEndpoint = `competitions/${queryParams.competition_id}/organizations/${org_id}/stades`;
        }
        break;

      case "ffb/club-team":
        if (!queryParams.id) {
          return httpResponse(400, { error: "Missing tournament id" });
        }
        ffbEndpoint = `organizations/${CLUB_CODE}/tournament/${queryParams.id}`;
        break;

      default:
        return httpResponse(404, { error: `Unknown route: ${route}` });
    }

    const options: RequestInit = { method };

    if ((method === "POST" || method === "PUT") && event.body) {
      options.headers = { "Content-Type": "application/json" };
      options.body = event.body;
    }

    const requiresAuth = requiresAuthentication(route);
    const data = await fetchFFBApi(ffbEndpoint, options, clientToken, requiresAuth);

    let statusCode = 200;
    if (data && typeof data === "object") {
      if (data.upstreamStatus) {
        statusCode = data.upstreamStatus;
      } else if (data.error) {
        statusCode = 400;
      }
    }

    return httpResponse(statusCode, data);
  } catch (error) {
    console.error("[FFB API] Handler error:", error);
    return httpResponse(500, {
      error: "Proxy error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
