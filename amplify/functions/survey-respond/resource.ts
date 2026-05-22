import { defineFunction } from "@aws-amplify/backend";

export const surveyRespond = defineFunction({
  name: "surveyRespond",
  resourceGroupName: "data",
});
