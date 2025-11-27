import express from "express";
import {
	legiFranceAddArticles,
	legiFranceAddArticlesAndLaws,
	legiFranceAddArticlesAndLawsStatus,
	legiFranceAddArticlesStatus,
	legiFranceResetArticles,
} from "./modules/lib/legiFranceActions";

import {
	judilibreDecisionsImportation,
	judilibreDecisionsImportationStatus,
} from "./modules/lib/judilibreActions";

const router = express.Router();

router.post("/api/articles", legiFranceAddArticles);
router.post("/api/articles/status", legiFranceAddArticlesStatus);
router.post("/api/articles/reset", legiFranceResetArticles);

router.post("/api/decisions/import", judilibreDecisionsImportation);
router.post("/api/decisions/status", judilibreDecisionsImportationStatus);

router.post("/api/laws", legiFranceAddArticlesAndLaws);
router.post("/api/laws/status", legiFranceAddArticlesAndLawsStatus);

export { router };
