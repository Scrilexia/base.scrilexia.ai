import express from "express";
import {
	legiFranceAddArticles,
	legiFranceAddArticlesAbort,
	legiFranceAddArticlesAndLaws,
	legiFranceAddArticlesAndLawsAbort,
	legiFranceAddArticlesAndLawsStatus,
	legiFranceAddArticlesStatus,
	legiFranceResetArticles,
} from "./modules/lib/legiFrance/legiFranceActions";

import {
	judilibreDecisionsCache,
	judilibreDecisionsCacheReset,
	judilibreDecisionsImportation,
	judilibreDecisionsImportationAbort,
	judilibreDecisionsImportationReset,
	judilibreDecisionsImportationStatus,
} from "./modules/lib/judilibre/judilibreActions";
import { Abort } from "./utils/abortController";

export const legiFranceAddArticlesAbortController = new Abort();
export const legiFranceAddArticlesAndLawsAbortController = new Abort();
export const judilibreDecisionsImportationAbortController = new Abort();

const router = express.Router();

router.post("/api/articles", legiFranceAddArticles);
router.post("/api/articles/status", legiFranceAddArticlesStatus);
router.post("/api/articles/abort", legiFranceAddArticlesAbort);
router.post("/api/articles/reset", legiFranceResetArticles);

router.post("/api/decisions", judilibreDecisionsImportation);
router.post("/api/decisions/cache", judilibreDecisionsCache);
router.post("/api/decisions/cache/reset", judilibreDecisionsCacheReset);
router.post("/api/decisions/status", judilibreDecisionsImportationStatus);
router.post("/api/decisions/abort", judilibreDecisionsImportationAbort);
router.post("/api/decisions/reset", judilibreDecisionsImportationReset);

router.post("/api/laws", legiFranceAddArticlesAndLaws);
router.post("/api/laws/status", legiFranceAddArticlesAndLawsStatus);
router.post("/api/laws/abort", legiFranceAddArticlesAndLawsAbort);

export { router };
