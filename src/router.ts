import express from "express";
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
} from "./modules/lib/legiFrance/legiFranceActions";

import {
	judilibreDecisionsImportAbort,
	judilibreDecisionsImportSql,
	judilibreDecisionsImportSqlReset,
	judilibreDecisionsImportVector,
	judilibreDecisionsImportVectorReset,
} from "./modules/lib/judilibre/judilibreActions";
import { Abort } from "./utils/abortController";

export const legiFranceAddArticlesAbortController = new Abort();
export const legiFranceAddArticlesAndLawsAbortController = new Abort();
export const judilibreDecisionsImportationAbortController = new Abort();

const router = express.Router();

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

export { router };
