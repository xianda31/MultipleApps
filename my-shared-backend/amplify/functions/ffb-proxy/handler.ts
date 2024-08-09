import { Parameter } from "aws-cdk-lib/aws-appconfig";
import { APIGatewayProxyEvent } from "aws-lambda";
// const url = "https://jsonplaceholder.typicode.com/users";
const ffbUrl = "https://api.ffbridge.fr/api/v1/";
const token = "Bearer eyJhbGciOiJSUzI1NiJ9.eyJyb2xlcyI6WyJST0xFX1dPUktBUkVBX1VTRVIiLCJST0xFX1VTRVIiXSwidXNlcm5hbWUiOiIyNDM5NzUyIiwicGluIjoiMDAwMCIsIm1lZGlhIjoxLCJkZWZhdWx0X2xhbmRpbmdwYWdlIjoibGljZW5zZWUiLCJlbWFpbCI6ImNocnJlbm91eEB5YWhvby5mciIsInBob25lIjoiMDc0OTE5NDAxOCIsInRva2VuX3NlY3VyaXplciI6bnVsbCwic2lnbl9pbl9zZWNvbmRfZmFjdG9yIjpmYWxzZSwiaXNfYWRtaW5fdXNlciI6ZmFsc2UsImlzX3ZhbGlkX2xpY2Vuc2UiOnRydWUsImlhdCI6MTY3NjgxOTQxNiwiZXhwIjozMTU1Mjc2ODE5NDE2LCJpc19mcm9tX2V4dGVybmFsX2FwaSI6ZmFsc2UsImd0bWNsaWVudGlkIjoiMCJ9.APMJKiStZDgkLTESRvJpS6cz67ZLLZXaHLMZoyqbEDTG7hs2NnI8HZZ6Kl8eZxjMt-TOZgYfiHnaX93zXUXFQ0b3BikSlbTJOl9bSZ56cnlGrKVeW39faW-JoUiXYHsg2UIwaiZfCCbDzKJhM4Bs2L3r0tlOV3ONxgNmbeRXEkafY7-VSTiq7NDU4HEPUNMjCNLU16a8H4N92WGykTntfgS81IJGswmtH3FkfKjvoncV_4Ph32Ik8JezqhO_SDKXFu4jnFHOr98W61KKrvgZsUb7ZjSnCS8WPHv60yor8xMJmV-Bl9YbydG0BRnn-NNvZvNPQkP047CGaLCqLQHNl0qmh3Hf6n4E5BGZ3yivtXtVqhGM3uITOiajoy8hBcku0s4fFnYf1pIExrA8NF9T5NVcaJMutNBPMop82IUThgiVFS1wAGhnubQCT3Qz9kvpB1hCRRtJHRBVxDU9wBodKX6QdjfbKA8InW-AiM2hlhNG-fuMU5nQGj-CGzPrriTST4UVKEST6sSFEBIdOiygYPgVwIXS1BCZz3NzBm36H7spu4TUf1nQj9F4QS7P8AoglakIuTcpxx2RzrJgEY5CVlwdTwuHfPw1x5Xqdd11-cABpV7X3aMKYaf4WM84WNUVuvyl4LtiNMO3zUaSk-mSqSTn2HsGbr9IR3S4WKF89EE";

export const handler = async (event: APIGatewayProxyEvent) => {
    try {
        // fetch is available in Node.js 18 and later runtimes

        // const res = await fetch(url);
        // return res.json();

        // return JSON.stringify({
        //     queryParameters: event.queryStringParameters || {},
        //     pathParameters: event.pathParameters || {},
        // });

        let path = event.pathParameters?.proxy || "";
        switch (path) {
            case "members":
                path = "members/207656";
                break;
            case "search-members":
                // traitement search-members&search=...
                if (event.queryStringParameters?.search) {
                    try {
                        const res = await fetch(
                            ffbUrl + path + "?search=" + event.queryStringParameters.search,
                            { headers: { Authorization: token }, },
                        );
                        return res.json();
                    } catch (e) {
                        return 500;
                    }
                } else {
                    return 500;
                }
            case "organizations/1438/club_tournament":
            case "organizations/1438/members":
                try {
                    const res = await fetch(
                        ffbUrl + path,
                        { headers: { Authorization: token }, },
                    );
                    return res.json();
                } catch (e) {
                    return 500;
                }
            case "organizations/1438/tournament":
                if (event.queryStringParameters?.id) {
                    try {
                        const res = await fetch(
                            ffbUrl + path + "/" + event.queryStringParameters.id,
                            { headers: { Authorization: token }, },
                        );
                        return res.json();
                    } catch (e) {
                        return 500;
                    }
                } else {
                    return 500;
                }
            default:
                return 404;
        }

    }
    catch (e) {
        console.error(e);
        return 500;
    }
};
