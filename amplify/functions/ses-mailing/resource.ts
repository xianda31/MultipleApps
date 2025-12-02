
import { defineFunction } from "@aws-amplify/backend";

export const sesMailing = defineFunction({
	name: "sesMailing",
	resourceGroupName: "data" // Placer dans le même stack que Member table pour éviter la dépendance circulaire
});
