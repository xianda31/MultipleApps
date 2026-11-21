import { defineFunction } from "@aws-amplify/backend";

export const ffbProxy = defineFunction({
    name: "ffbProxy",
    resourceGroupName: "storage",
    timeoutSeconds: 30,
});
