import { default as express } from "express";
import {
	WorkType,
	createPicking,
	deletePicking,
	getActivePickings,
	getLatestPicking,
	getPickings,
	getActivePickingForUser,
	updatePicking,
} from "../db/dbhandler.js";
import { JwtDecoded } from "../middleware/auth.js";
import { objectValidator } from "../utils.js";

export default function (middleware: express.Handler, adminMiddleware: express.Handler) {
	const router = express.Router();

	router.get("/work", middleware, async (req, res) => {
		try {
			const pickings = await getActivePickings();
			const work = pickings.reduce(
				(acc, curr) => {
					if (curr.work_type === WorkType.picking) {
						acc.picking += 1;
					} else if (curr.work_type === WorkType.packing) {
						acc.packing += 1;
					}
					return acc;
				},
				{ picking: 0, packing: 0 },
			);
			const workTypes: WorkType[] = [];
			if (work.picking < 3) {
				workTypes.push(WorkType.picking);
			}
			if (work.packing < 6) {
				workTypes.push(WorkType.packing);
			}
			res.json(workTypes);
		} catch (error) {
			if (error instanceof Error) {
				res.json({ message: error.message });
			}
		}
	});

	// GET latest picking
	router.get("/latest", middleware, async (req, res) => {
		try {
			const body = req.body as { decoded: JwtDecoded };
			const userId = body.decoded.id;
			const picking = (await getActivePickingForUser(userId)) ?? [await getLatestPicking(userId)];
			res.json(picking);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// picking/1234
	router.get("/:workerId", adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.workerId);
			const pickings = (await getActivePickingForUser(id)) ?? (await getPickings(id));
			res.json(pickings);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// POST /picking
	router.post("/", middleware, async (req, res) => {
		try {
			const { workerId, workType } = req.body as { workerId: number; workType: WorkType };
			objectValidator({ workerId, workType });
			const picking = await createPicking(workerId, workType);
			res.json(picking);
		} catch (error) {}
	});

	// PUT /picking/:id
	router.put("/:id", middleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			const { workType } = req.body as { workType: WorkType };
			objectValidator({ workType });
			const picking = await updatePicking(id, new Date());
			res.json(picking);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// DELETE /picking/:id
	router.delete("/:id", adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			await deletePicking(id);
			res.json({
				message: `Picking with id ${id} was deleted`,
			});
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	return router;
}
