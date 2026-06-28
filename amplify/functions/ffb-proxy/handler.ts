import { Handler } from "aws-lambda";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({ region: process.env.AWS_REGION || "eu-west-3" });

function isProxyDebugEnabled(): boolean {
  return (process.env.FFB_PROXY_DEBUG || "false").toLowerCase() === "true";
}

function asLancelotToken(token: string): string {
  const trimmed = (token || "").trim();
  if (!trimmed) {
    console.warn("[FFB API] asLancelotToken: Empty token provided!");
    return "";
  }
  // Remove 'Bearer ' prefix if present (FFB V2 uses raw JWT with X-Lancelot-Authorization header)
  const result = trimmed.toLowerCase().startsWith("bearer ") ? trimmed.substring(7) : trimmed;
  const preview = result.substring(0, 30) + "..." + result.substring(result.length - 10);
  console.log(`[FFB API] asLancelotToken: Prepared JWT (length=${result.length}): ${preview}`);
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
  if (FFB_API_V2.token) {
    return;
  }

  try {
    console.log("[FFB API] Loading V2 token from SSM Parameter Store...");
    const response = await ssmClient.send(
      new GetParameterCommand({
        Name: "FFB_API_V2_TOKEN",
        WithDecryption: true,
      })
    );
    const tokenValue = response.Parameter?.Value || "";
    FFB_API_V2.token = asLancelotToken(tokenValue);
    const preview = FFB_API_V2.token.substring(0, 30) + "..." + FFB_API_V2.token.substring(FFB_API_V2.token.length - 20);
    console.log(`[FFB API] ✅ V2 token loaded from SSM (Lancelot format): ${preview}`);
  } catch (error) {
    const fallback = asLancelotToken(process.env.FFB_API_V2_TOKEN || "");
    if (fallback) {
      FFB_API_V2.token = fallback;
      console.warn("[FFB API] ⚠️ SSM read failed; using FFB_API_V2_TOKEN env fallback.");
      return;
    }

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
      headers["X-Lancelot-Authorization"] = FFB_API_V2.token;
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
    "seasons/current",
    "seasons/next",
    "organizations",
  ];
  return !publicEndpoints.includes(route);
}

function getHeaderCaseInsensitive(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) {
      return value;
    }
  }
  return undefined;
}

function normalizeProxyRoute(event: any): string {
  const proxy = (event.pathParameters?.proxy || "").replace(/^\/+/, "");
  if (!proxy) return "";

  if (proxy.startsWith("ffb_v2/")) {
    return proxy.substring("ffb_v2/".length);
  }

  if (proxy.startsWith("ffb/")) {
    return proxy.substring("ffb/".length);
  }

  return proxy;
}

export const handler: Handler = async (event) => {
  try {
    console.log(`[Handler] ⚡ INVOKED: ${event.requestContext?.http.method || "?"} ${event.rawPath || event.path || "?"}`);
    console.log(`[Handler] Proxy param: ${event.pathParameters?.proxy || "(none)"}`);
    
    const xFfbToken = getHeaderCaseInsensitive(event.headers, "x-ffb-token");
    console.log("[FFB API] Available headers:", Object.keys(event.headers || {}));

    // Only use explicit x-ffb-token header, IGNORE Authorization (it's AWS SigV4, not FFB token)
    const clientToken = xFfbToken ? asLancelotToken(xFfbToken) : undefined;

    if (clientToken) {
      const preview = clientToken.substring(0, 30) + "..." + clientToken.substring(clientToken.length - 20);
      console.log(`[FFB API] Client x-ffb-token received: ${preview}`);
    } else {
      console.log("[FFB API] No x-ffb-token header, will load from SSM");
    }

    const proxy = event.pathParameters?.proxy || "";
    const route = normalizeProxyRoute(event);
    const queryParams = event.queryStringParameters || {};
    const method = event.requestContext?.http.method || "GET";

    console.log(`[FFB API] Route canonical: raw='${proxy}' canonical='${route}' path='${event.rawPath || ""}'`);

    let ffbEndpoint: string;

    switch (route) {
      case "seasons/current":
        ffbEndpoint = "seasons/current";
        break;
      case "seasons/next":
        ffbEndpoint = "seasons/next";
        break;

      case "persons/search":
        {
          const params = new URLSearchParams();
          if (queryParams.name) params.set("name", queryParams.name);
          params.set("ffbCode", CLUB_CODE);  // FFB V2 requires club code for person search
          params.set("sortField", queryParams.sortField || "lastName");
          params.set("currentPage", queryParams.currentPage || "1");
          params.set("maxPerPage", queryParams.maxPerPage || "80");
          if (queryParams.alive) params.set("alive", queryParams.alive);
          ffbEndpoint = `persons/search?${params.toString()}`;
          console.log(`[FFB API] persons/search: name=${queryParams.name} ffbCode=${CLUB_CODE} currentPage=${queryParams.currentPage || "1"} maxPerPage=${queryParams.maxPerPage || "80"}`);
        }
        break;

      case "club-members":
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

      case "club-sessions":
        {
          // Get date parameters from client, with fallback defaults
          let dateFromStr = queryParams.dateFrom as string;
          let dateToStr = queryParams.dateTo as string;
          
          // If not provided, use defaults: 3 days from now to 365 days from now
          if (!dateFromStr || !dateToStr) {
            const now = new Date();
            dateFromStr = formatDateYYYYMMDD(addDays(now, 3)); // Start from 3 days from now
            dateToStr = formatDateYYYYMMDD(addDays(now, 365)); // End 1 year from now
          }

          const params = new URLSearchParams();
          params.set("dateFrom", dateFromStr);
          params.set("dateTo", dateToStr);
          params.set("currentPage", queryParams.currentPage || "1");
          params.set("maxPerPage", queryParams.maxPerPage || "80");
          params.set("groupId", CLUB_GROUP_ID);
          params.append("context[]", "groupSession.entryCount");

          ffbEndpoint = `competitions/groupSessions/search?${params.toString()}`;
          console.log(`[FFB API] club-sessions: dateFrom=${dateFromStr} dateTo=${dateToStr} currentPage=${queryParams.currentPage || "1"} maxPerPage=${queryParams.maxPerPage || "80"} groupId=${CLUB_GROUP_ID}`);
        }
        break;

      case "organizations":
        ffbEndpoint = "organizations/all";
        break;

      case "person":
        {
          // Support both legacy 'id' and V2 'personId' query params
          const personId = queryParams.personId || queryParams.id;
          if (!personId) {
            console.log(`[Handler] ERROR: person requires personId or id parameter`);
            return httpResponse(400, { error: "Missing personId or id parameter" });
          }
          ffbEndpoint = `persons/${personId}`;
          console.log(`[Handler] person: personId=${personId}`);
        }
        break;

      case "competition-results":
        if (!queryParams.competition_id || !queryParams.organization_id) {
          return httpResponse(400, { error: "Missing competition_id or organization_id" });
        }
        ffbEndpoint = `competitions/${queryParams.competition_id}/organizations/${queryParams.organization_id}/final-ranking`;
        break;

      case "competition-phases":
        if (!queryParams.competition_id) {
          return httpResponse(400, { error: "Missing competition_id" });
        }
        {
          const org_id = queryParams.organization_id || "1";
          ffbEndpoint = `competitions/${queryParams.competition_id}/organizations/${org_id}/stades`;
        }
        break;

      case "club-team":
        {
          console.log(`[Handler] ffb/club-team received with params:`, JSON.stringify(queryParams, null, 2));
          if (!queryParams.groupSessionId) {
            console.log(`[Handler] ERROR: Missing groupSessionId. Params were: ${JSON.stringify(queryParams)}`);
            return httpResponse(400, { error: "Missing groupSessionId parameter" });
          }
          const params = new URLSearchParams();
          params.set("groupSessionId", queryParams.groupSessionId);
          params.set("currentPage", queryParams.currentPage || "1");
          params.set("maxPerPage", queryParams.maxPerPage || "80");
          params.append("context[]", "team.currentTeamEntry");
          
          ffbEndpoint = `entries/teams/search?${params.toString()}`;
          console.log(`[Handler] club-team (V2): groupSessionId=${queryParams.groupSessionId} currentPage=${queryParams.currentPage || "1"} maxPerPage=${queryParams.maxPerPage || "80"}`);
        }
        break;

      // FFB V2 Team Creation endpoint - POST team with players
      case route.match(/^entries\/groupSessions\/\d+\/createTeam$/)?.[0]:
        {
          const groupSessionId = proxy.match(/entries\/groupSessions\/(\d+)\/createTeam/)?.[1];
          if (!groupSessionId) {
            console.error(`[Handler][postTeam] ERROR: Could not extract groupSessionId from path: ${proxy}`);
            return httpResponse(400, { error: "Invalid groupSessionId in path" });
          }
          
          let bodyData: any = {};
          try {
            bodyData = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};
          } catch (parseError) {
            console.error(`[Handler][postTeam] ERROR: Invalid JSON body:`, event.body);
            return httpResponse(400, { error: "Invalid JSON in request body" });
          }

          const players = bodyData.players || [];
          const captainId = bodyData.captainId;
          
          console.log(`[Handler][postTeam] POST /entries/groupSessions/${groupSessionId}/createTeam`);
          console.log(`[Handler][postTeam] Request body: { players: [${players.join(', ')}], captainId: ${captainId} }`);
          console.log(`[Handler][postTeam] Player count: ${players.length}, Captain: ${captainId}`);
          
          ffbEndpoint = `entries/groupSessions/${groupSessionId}/createTeam`;
        }
        break;

      // FFB V2 Team Entry deletion endpoint
      case route.match(/^entries\/team-entries\/\d+$/)?.[0]:
        {
          const teamId = proxy.match(/entries\/team-entries\/(\d+)/)?.[1];
          if (!teamId) {
            console.error(`[Handler][deleteTeam] ERROR: Could not extract teamId from path: ${proxy}`);
            return httpResponse(400, { error: "Invalid teamId in path" });
          }
          
          console.log(`[Handler][deleteTeam] DELETE /entries/team-entries/${teamId}`);
          console.log(`[Handler][deleteTeam] Deleting team entry with ID: ${teamId}`);
          
          ffbEndpoint = `entries/team-entries/${teamId}`;
        }
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

    // Instrumentation for postTeam endpoint
    if (route.match(/^entries\/groupSessions\/\d+\/createTeam$/)) {
      const groupSessionId = proxy.match(/entries\/groupSessions\/(\d+)\/createTeam/)?.[1];
      if (data?.error) {
        console.error(`[Handler][postTeam] ❌ FAILURE: groupSessionId=${groupSessionId} FFB API returned error:`, JSON.stringify(data));
      } else {
        console.log(`[Handler][postTeam] ✅ SUCCESS: groupSessionId=${groupSessionId} Response:`, JSON.stringify(data).substring(0, 200));
      }
    }

    // Instrumentation for deleteTeam endpoint
    if (route.match(/^entries\/team-entries\/\d+$/)) {
      const teamId = proxy.match(/entries\/team-entries\/(\d+)/)?.[1];
      if (data?.error) {
        console.error(`[Handler][deleteTeam] ❌ FAILURE: teamId=${teamId} FFB API returned error:`, JSON.stringify(data));
      } else {
        console.log(`[Handler][deleteTeam] ✅ SUCCESS: teamId=${teamId}`);
      }
    }

    // Debug logging for clubSessions endpoint
    if (route === "club-sessions" && data && typeof data === "object") {
      const pagination = (data as any).pagination;
      const itemCount = Array.isArray((data as any).items) ? (data as any).items.length : 0;
      console.log(`[FFB API] club-sessions response: ${itemCount} items returned, pagination:`, pagination);
    }

    let statusCode = 200;
    if (data && typeof data === "object") {
      if (data.upstreamStatus) {
        statusCode = data.upstreamStatus;
      } else if (data.error) {
        statusCode = 400;
      }
    }

    // Additional instrumentation for postTeam and deleteTeam responses
    if (route.match(/^entries\/groupSessions\/\d+\/createTeam$/)) {
      const groupSessionId = event.pathParameters?.proxy?.match(/entries\/groupSessions\/(\d+)\/createTeam/)?.[1];
      console.log(`[Handler][postTeam] Returning HTTP ${statusCode} for groupSessionId=${groupSessionId}`);
    }

    if (route.match(/^entries\/team-entries\/\d+$/)) {
      const teamId = event.pathParameters?.proxy?.match(/entries\/team-entries\/(\d+)/)?.[1];
      console.log(`[Handler][deleteTeam] Returning HTTP ${statusCode} for teamId=${teamId}`);
    }

    return httpResponse(statusCode, data);
  } catch (error) {
    console.error("[FFB API] Handler error:", error);
    console.error("[FFB API] Handler error details:", error instanceof Error ? error.stack : String(error));
    return httpResponse(500, {
      error: "Proxy error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
