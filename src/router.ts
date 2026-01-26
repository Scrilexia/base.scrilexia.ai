import express, { type RequestHandler } from "express";
import {
	legiFranceArticlesAndLawsBuildTrainingDataset,
	legiFranceArticlesAndLawsImportAbort,
	legiFranceArticlesAndLawsImportQdrant,
	legiFranceArticlesAndLawsImportSql,
	legiFranceArticlesImportAbort,
	legiFranceArticlesImportQdrant,
	legiFranceArticlesImportSql,
	legiFranceBuildTrainingDataset,
	legiFranceResetArticlesQdrant,
	legiFranceResetArticlesSql,
} from "./modules/lib/legiFrance/legiFranceActions.js";

import {
	databaseDecisionsCa,
	databaseDecisionsCaById,
	databaseDecisionsCc,
	databaseDecisionsCcById,
	judilibreDecisionsBuildTrainingDatasetSummariesAndDecisions,
	judilibreDecisionsBuildTrainingDatasetThemesAndDecisions,
	judilibreDecisionsImportAbort,
	judilibreDecisionsImportSql,
	judilibreDecisionsImportSqlReset,
	judilibreDecisionsImportVector,
	judilibreDecisionsImportVectorReset,
} from "./modules/lib/judilibre/judilibreActions.js";

import {
	databaseCodeArticles,
	databaseLawArticles,
} from "./modules/lib/database/databaseActions.js";

import { Abort } from "./utils/abortController.js";

export const legiFranceAddArticlesAbortController = new Abort();
export const legiFranceAddArticlesAndLawsAbortController = new Abort();
export const judilibreDecisionsImportationAbortController = new Abort();

const router = express.Router();
const routerQuery = express.Router();

const setTimeoutMiddleware: RequestHandler = (req, res, next) => {
	req.setTimeout(15 * 60 * 1000); // 15 minutes
	next();
};

router.post("/api/articles/sql", legiFranceArticlesImportSql);
router.post("/api/articles/sql/reset", legiFranceResetArticlesSql);
router.post("/api/articles/vector", legiFranceArticlesImportQdrant);
router.post("/api/articles/vector/reset", legiFranceResetArticlesQdrant);
router.post("/api/articles/abort", legiFranceArticlesImportAbort);
router.post("/api/articles/train", legiFranceBuildTrainingDataset);

router.post("/api/laws/sql", legiFranceArticlesAndLawsImportSql);
router.post("/api/laws/vector", legiFranceArticlesAndLawsImportQdrant);
router.post("/api/laws/abort", legiFranceArticlesAndLawsImportAbort);
router.post("/api/laws/train", legiFranceArticlesAndLawsBuildTrainingDataset);

router.post("/api/decisions/vector", judilibreDecisionsImportVector);
router.post("/api/decisions/vector/reset", judilibreDecisionsImportVectorReset);
router.post("/api/decisions/sql", judilibreDecisionsImportSql);
router.post("/api/decisions/sql/reset", judilibreDecisionsImportSqlReset);
router.post("/api/decisions/abort", judilibreDecisionsImportAbort);
router.post(
	"/api/decisions/train/themes",
	setTimeoutMiddleware,
	judilibreDecisionsBuildTrainingDatasetThemesAndDecisions,
);
router.post(
	"/api/decisions/train/summaries",
	setTimeoutMiddleware,
	judilibreDecisionsBuildTrainingDatasetSummariesAndDecisions,
);

routerQuery.post("/api/code", databaseCodeArticles);
routerQuery.post("/api/law", databaseLawArticles);
routerQuery.post("/api/decision/cc", databaseDecisionsCc);
routerQuery.post("/api/decision/ca", databaseDecisionsCa);
routerQuery.post("/api/decision/cc/id", databaseDecisionsCcById);
routerQuery.post("/api/decision/ca/id", databaseDecisionsCaById);

router.post("/api/code", databaseCodeArticles);
router.post("/api/law", databaseLawArticles);
router.post("/api/decision/cc", databaseDecisionsCc);
router.post("/api/decision/ca", databaseDecisionsCa);
router.post("/api/decision/cc/id", databaseDecisionsCcById);
router.post("/api/decision/ca/id", databaseDecisionsCaById);

export { router, routerQuery };
