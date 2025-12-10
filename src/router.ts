import express from "express";
import {
	legiFranceAddArticles,
	legiFranceAddArticlesAbort,
	legiFranceAddArticlesAndLaws,
	legiFranceAddArticlesAndLawsAbort,
	legiFranceResetArticles,
} from "./modules/lib/legiFrance/legiFranceActions";

import {
	judilibreDecisionsImportSql,
	judilibreDecisionsImportSqlReset,
	judilibreDecisionsImportVector,
	judilibreDecisionsImportAbort,
	judilibreDecisionsImportVectorReset,
} from "./modules/lib/judilibre/judilibreActions";
import { Abort } from "./utils/abortController";

export const legiFranceAddArticlesAbortController = new Abort();
export const legiFranceAddArticlesAndLawsAbortController = new Abort();
export const judilibreDecisionsImportationAbortController = new Abort();

const router = express.Router();

router.post("/api/articles", legiFranceAddArticles);
router.post("/api/articles/abort", legiFranceAddArticlesAbort);
router.post("/api/articles/reset", legiFranceResetArticles);

router.post("/api/decisions/vector", judilibreDecisionsImportVector);
router.post("/api/decisions/vector/reset", judilibreDecisionsImportVectorReset);
router.post("/api/decisions/sql", judilibreDecisionsImportSql);
router.post("/api/decisions/sql/reset", judilibreDecisionsImportSqlReset);
router.post("/api/decisions/abort", judilibreDecisionsImportAbort);

router.post("/api/laws", legiFranceAddArticlesAndLaws);
router.post("/api/laws/abort", legiFranceAddArticlesAndLawsAbort);

export { router };
