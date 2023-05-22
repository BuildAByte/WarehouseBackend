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
	getAllPickings,
} from "../db/dbhandler.js";
import { AuthHandlers, JwtDecoded } from "../middleware/auth.js";
import { objectValidator } from "../utils.js";

export default function (authService: AuthHandlers) {
	const router = express.Router();

	router.get("/all", authService.adminMiddleware, async (req, res) => {
		try {
			const pickings = await getAllPickings();
			res.json(pickings);
		} catch (error) {
			if (error instanceof Error) {
				res.status(500).json({ message: error.message });
			}
		}
	});

	router.post("/assign", authService.adminMiddleware, async (req, res) => {
		try {
			const { workerId, workType } = req.body;
			objectValidator({ workerId, workType });
			const picking = await createPicking(workerId, workType);
			res.json(picking);
		} catch (error) {
			if (error instanceof Error) {
				res.status(500).json({ message: error.message });
			}
		}
	});

	// GET /picking
	router.get("/", authService.middleware, async (req, res) => {
		const userId = (req.body as { decoded: JwtDecoded }).decoded.id;
		try {
			const pickings = await getPickings(userId);
			res.json(pickings);
		} catch (error) {
			if (error instanceof Error) {
				res.status(500).send(error.message);
			}
		}
	});

	router.get("/work", authService.middleware, async (req, res) => {
		try {
			const pickings = await getActivePickings();
			const work = pickings.reduce(
				(acc, curr) => {
					if (curr.work_type === WorkType.PICKING) {
						acc.picking += 1;
					} else if (curr.work_type === WorkType.PACKING) {
						acc.packing += 1;
					}
					return acc;
				},
				{ picking: 0, packing: 0 },
			);
			const workTypes: WorkType[] = [];
			if (work.picking < 3) {
				workTypes.push(WorkType.PICKING);
			}
			if (work.packing < 6) {
				workTypes.push(WorkType.PACKING);
			}
			res.json(workTypes);
		} catch (error) {
			if (error instanceof Error) {
				res.json({ message: error.message });
			}
		}
	});

	// GET latest picking
	router.get("/active", authService.middleware, async (req, res) => {
		try {
			const body = req.body as { decoded: JwtDecoded };
			const userId = body.decoded.id;
			const picking = await getActivePickingForUser(userId);
			res.json(picking);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// picking/1234
	router.get("/:workerId", authService.adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.workerId);
			const pickings = await getPickings(id);
			res.json(pickings);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// POST /picking
	router.post("/", authService.middleware, async (req, res) => {
		try {
			const userId = (req.body as { decoded: JwtDecoded }).decoded.id;
			const { workType } = req.body as { workerId: number; workType: WorkType };
			objectValidator({ workType });
			const picking = await createPicking(userId, workType);
			res.json(picking);
		} catch (error) {
			if (error instanceof Error) {
				res.status(400).json({ message: error.message });
			}
		}
	});

	// PUT /picking/:id
	router.put("/:id", authService.middleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			const picking = await updatePicking(id, new Date());
			res.json(picking);
		} catch (error) {
			if (error instanceof Error) {
				res.status(400).json({ message: error.message });
			}
		}
	});

	// DELETE /picking/:id
	router.delete("/:id", authService.adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			await deletePicking(id);
			res.json({
				message: `Picking with id ${id} was deleted`,
			});
		} catch (error) {
			if (error instanceof Error) {
				res.status(400).json({ message: error.message });
			}
		}
	});

	return router;
}
