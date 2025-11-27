import express from "express";
import {
	legiFranceAddAndLawsArticlesAbort as legiFranceAddArticlesAndLawsAbort,
	legiFranceAddArticles,
	legiFranceAddArticlesAbort,
	legiFranceAddArticlesAndLaws,
	legiFranceAddArticlesAndLawsStatus,
	legiFranceAddArticlesStatus,
	legiFranceResetArticles,
} from "./modules/lib/legiFranceActions";

import {
	judilibreDecisionsImportation,
	judilibreDecisionsImportationStatus,
} from "./modules/lib/judilibreActions";
import { Abort } from "./utils/abortController";

export const legiFranceAddArticlesAbortController = new Abort();
export const legiFranceAddArticlesAndLawsAbortController = new Abort();

const router = express.Router();

router.post("/api/articles", legiFranceAddArticles);
router.post("/api/articles/status", legiFranceAddArticlesStatus);
router.post("/api/articles/abort", legiFranceAddArticlesAbort);
router.post("/api/articles/reset", legiFranceResetArticles);

router.post("/api/decisions/import", judilibreDecisionsImportation);
router.post("/api/decisions/status", judilibreDecisionsImportationStatus);

router.post("/api/laws", legiFranceAddArticlesAndLaws);
router.post("/api/laws/status", legiFranceAddArticlesAndLawsStatus);
router.post("/api/laws/abort", legiFranceAddArticlesAndLawsAbort);

export { router };
