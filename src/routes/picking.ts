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
	PickingParsed,
	getWorkers,
	Milliseconds,
} from "../db/dbhandler.js";
import { AuthHandlers, JwtDecoded } from "../middleware/auth.js";
import { objectValidator } from "../utils.js";
// map all the values in WorkType to a number
const LIMITS = {
	[WorkType.PICKING]: 10,
	[WorkType.PACKING]: 5,
	[WorkType.LABELLING]: 2,
	[WorkType.RESTOCKING]: 1,
	[WorkType.CHECKING]: 1,
	[WorkType["LIQUID PRODUCTION"]]: 1,
	[WorkType.PREPARATION]: 1,
	[WorkType["SUB DIVISION"]]: 1,
};

const BASE_WORK_TYPE_OBJECT = {
	[WorkType.PICKING]: 0,
	[WorkType.PACKING]: 0,
	[WorkType.LABELLING]: 0,
	[WorkType.RESTOCKING]: 0,
	[WorkType.CHECKING]: 0,
	[WorkType["LIQUID PRODUCTION"]]: 0,
	[WorkType.PREPARATION]: 0,
	[WorkType["SUB DIVISION"]]: 0,
};

type WorkTypesToTimeSpent = Record<WorkType, number>;
type WorkerToWorkTypeMapped = Record<string, WorkTypesToTimeSpent>;

export default function (authService: AuthHandlers) {
	const router = express.Router();

	// create a route that returns a csv file of all the pickings
	router.get("/csv", authService.adminMiddleware, async (req, res) => {
		try {
			const pickings = await getAllPickings();
			const csv = pickings.map((picking) => {
				const { id, worker_id, work_type, start_timestamp, end_timestamp } = picking;
				return `${id},${worker_id},${work_type},${start_timestamp},${end_timestamp}`;
			});
			// insert the titles at the start of csv
			csv.unshift(Object.keys(pickings[0]).join(","));
			res.setHeader("Content-Type", "text/csv");
			res.attachment("pickings.csv");
			res.send(csv.join("\n"));
		} catch (error) {
			console.error(error);
		}
	});

	// calculate how much time each worker has worked based on the pickings
	router.get("/time", authService.adminMiddleware, async (req, res) => {
		try {
			const pickings = await getAllPickings();
			// parse end_timestamp and start_timestamp into dates

			const parsedPickings: Array<PickingParsed> = pickings.map((picking) => {
				return {
					...picking,
					end_timestamp: new Date(picking.end_timestamp ?? picking.start_timestamp),
					start_timestamp: new Date(picking.start_timestamp),
				};
			});

			const workers = await getWorkers();

			const usersMappedToWorkType: WorkerToWorkTypeMapped = workers.reduce((acc, curr) => {
				acc[curr.name] = { ...BASE_WORK_TYPE_OBJECT };
				return acc;
			}, {} as WorkerToWorkTypeMapped);

			for (const picking of parsedPickings) {
				const { end_timestamp, start_timestamp, work_type, worker_id } = picking;
				const worker = workers.find((worker) => worker.id === worker_id);
				if (!worker) {
					throw new Error(`Worker with id ${worker_id} not found`);
				}
				const timeSpent = (end_timestamp.getTime() - start_timestamp.getTime()) / Milliseconds.HOUR;
				usersMappedToWorkType[worker.name][work_type] += parseFloat(timeSpent.toFixed(1));
			}

			res.json(usersMappedToWorkType);
		} catch (error) {
			if (error instanceof Error) {
				res.status(500).json({ message: error.message });
			}
		}
	});

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
					acc[curr.work_type] += 1;
					return acc;
				},
				{ ...BASE_WORK_TYPE_OBJECT },
			);
			const workTypes: WorkType[] = [];
			for (const workType in work) {
				const index = workType as WorkType;
				if (work[index] < LIMITS[index]) {
					workTypes.push(workType as WorkType);
				}
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
