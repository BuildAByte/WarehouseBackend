import { default as express } from "express";
import {
	WorkType,
	createPicking,
	deletePicking,
	getActivePickings,
	getPickings,
	getActivePickingForUser,
	updatePicking,
	getAllPickings,
	PickingParsed,
	getWorkers,
	Milliseconds,
	getPickingsWithSubtask,
	DataReport,
	insertDataReports,
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

const labellingSubTasks = [
	"Konjac",
	"molassa",
	"1 sticker",
	"print labels",
	"2 labels",
	"agave",
	"Green Mama",
	"Bombus",
	"Trucs",
	"Olives",
	"Printing Date",
];

const liquidProductionSubTasks = ["agave", "molassa", "tahini", "mealtime"];

const subDivisionSubTasks = ["flour", "spores", "Soda", "G/L products"];

type WorkTypesToTimeSpent = Record<WorkType, number>;
type WorkerToWorkTypeMapped = Record<string, WorkTypesToTimeSpent>;

export default function (authService: AuthHandlers) {
	const router = express.Router();

	router.post("/upload", authService.adminMiddleware, async (req, res) => {
		const { json } = req.body as { json: Array<Array<string>> };
		console.log(json);
		json.splice(0, 1);
		const workerIds = json.map((row) => parseInt(row[1]));
		const workers = await getWorkers();
		const uniqueWorkerIds = [...new Set(workerIds)];
		const uniqueWorkers = workers.filter((w) => uniqueWorkerIds.includes(parseInt(w.soft_one_id)));
		const pickingCache: Record<number, PickingParsed[]> = {};
		for (const { id } of uniqueWorkers) {
			const work = await getPickings(id);
			const parsed = work.map((w) => {
				return {
					...w,
					end_timestamp: new Date(w.end_timestamp ?? w.start_timestamp),
					start_timestamp: new Date(w.start_timestamp),
				};
			});
			pickingCache[id] = parsed;
		}
		const dataArray: DataReport[] = [];
		for (const [_, id, date, orders, orderlines, units] of json) {
			const parsedId = parseInt(id);
			const parsedDate = new Date(date);
			const parsedOrders = parseInt(orders);
			const parsedOrderlines = parseInt(orderlines);
			const parsedUnits = parseInt(units);
			const worker = uniqueWorkers.find((w) => parseInt(w.soft_one_id) === parsedId);

			if (worker) {
				const pickingsAtDate = pickingCache[worker.id].filter((p) => {
					const { start_timestamp } = p;
					return (
						start_timestamp.getFullYear() === parsedDate.getFullYear() &&
						start_timestamp.getMonth() === parsedDate.getMonth() &&
						start_timestamp.getDate() === parsedDate.getDate()
					);
				});
				const workTimeSpentForPicking = pickingsAtDate.reduce((acc, curr) => {
					const { work_type, end_timestamp, start_timestamp } = curr;
					const timeSpent =
						((end_timestamp?.getTime() ?? start_timestamp.getTime) - start_timestamp.getTime()) /
						Milliseconds.HOUR;
					acc[work_type] += timeSpent;
					return acc;
				}, BASE_WORK_TYPE_OBJECT);
				const orderLinesPerHour = parsedOrderlines / workTimeSpentForPicking[WorkType.PICKING];
				const unitsPerOrderLine = parsedOrderlines / parsedUnits;
				dataArray.push({
					id: worker.id,
					date: parsedDate,
					orders: parsedOrders,
					orderlines: parsedOrderlines,
					units: parsedUnits,
					timeSpent: workTimeSpentForPicking[WorkType.PICKING],
					orderLinesPerHour,
					unitsPerOrderLine,
				});
			}
		}

		await insertDataReports(dataArray);
		res.json({ success: true });
	});

	// create a route that returns a csv file of all the pickings
	router.get("/csv/:startTimestamp/:endTimestamp", authService.adminMiddleware, async (req, res) => {
		try {
			const { startTimestamp, endTimestamp } = req.params;
			if (!startTimestamp || !endTimestamp) {
				throw new Error("start_timestamp and end_timestamp are required");
			}
			const pickings = await getAllPickings(new Date(startTimestamp), new Date(endTimestamp));
			const workers = await getWorkers();
			const csv: string[] = [];
			const titles = ["worker_name", "work_type", "hours_spent", "subtask", "subtask_quantity"];
			csv.push(titles.join(","));
			const pickingsParsed = pickings.map((picking) => {
				return {
					...picking,
					end_timestamp: new Date(picking.end_timestamp ?? picking.start_timestamp),
					start_timestamp: new Date(picking.start_timestamp),
				};
			});

			for (const picking of pickingsParsed) {
				const { worker_id, work_type, end_timestamp, start_timestamp, subtask, subtask_quantity } = picking;
				const worker = workers.find((worker) => worker.id === worker_id);
				if (worker) {
					const { name } = worker;
					const timeSpent = (end_timestamp.getTime() - start_timestamp.getTime()) / Milliseconds.HOUR;
					const row = [name, work_type, parseFloat(timeSpent.toFixed(2)), subtask, subtask_quantity];
					csv.push(row.join(","));
				}
			}

			// insert the titles at the start of csv
			res.setHeader("Content-Type", "text/csv");
			res.attachment("work.csv");
			res.send(csv.join("\n"));
		} catch (error) {
			console.error(error);
		}
	});

	router.get("/subtask_report", authService.adminMiddleware, async (req, res) => {
		try {
			const { startTimestamp, endTimestamp } = req.query as { startTimestamp: string; endTimestamp: string };
			if (!startTimestamp || !endTimestamp) {
				throw new Error("start_timestamp and end_timestamp are required");
			}
			const pickings = await getPickingsWithSubtask(new Date(startTimestamp), new Date(endTimestamp));
			res.json(pickings);
		} catch (error) {
			console.error(error);
		}
	});

	// create a route that returns the right sub tasks for a work type
	router.get("/subtasks/:workType", authService.middleware, async (req, res) => {
		try {
			const { workType } = req.params as { workType: WorkType };
			if (!workType) {
				throw new Error("workType is required");
			}
			switch (workType) {
				case WorkType.LABELLING:
					res.json(labellingSubTasks);
					break;
				case WorkType["LIQUID PRODUCTION"]:
					res.json(liquidProductionSubTasks);
					break;
				case WorkType["SUB DIVISION"]:
					res.json(subDivisionSubTasks);
					break;
				default:
					res.json([]);
			}
		} catch (error) {
			console.error(error);
			const { message } = error as { message: string };
			res.status(500).json({ error: message });
		}
	});

	// subtasks/time
	// get all the subtasks and the time spent on them
	router.get("/subtasks_csv/:startTimestamp/:endTimestamp", authService.adminMiddleware, async (req, res) => {
		try {
			const { startTimestamp, endTimestamp } = req.params;
			if (!startTimestamp || !endTimestamp) {
				throw new Error("start_timestamp and end_timestamp are required");
			}
			const pickings = await getAllPickings(new Date(startTimestamp), new Date(endTimestamp));
			// parse end_timestamp and start_timestamp into dates

			const parsedPickings: Array<PickingParsed> = pickings.map((picking) => {
				return {
					...picking,
					end_timestamp: new Date(picking.end_timestamp ?? picking.start_timestamp),
					start_timestamp: new Date(picking.start_timestamp),
				};
			});

			const csv: string[] = [];

			const titles = ["subtask", "subtask_quantity", "hours_spent"];

			csv.push(titles.join(","));

			const subtasks: Record<string, Array<number>> = {};

			for (const picking of parsedPickings) {
				const { subtask, subtask_quantity, end_timestamp, start_timestamp } = picking;
				const timeSpent = (end_timestamp.getTime() - start_timestamp.getTime()) / Milliseconds.HOUR;
				if (!subtask) continue;

				if (subtasks[subtask]) {
					subtasks[subtask][0] += subtask_quantity;
					subtasks[subtask][1] += timeSpent;
				}
				if (!subtasks[subtask]) {
					subtasks[subtask] = [subtask_quantity, timeSpent];
				}
			}
			for (const subtask in subtasks) {
				const [subtask_quantity, timeSpent] = subtasks[subtask];
				const row = [subtask, subtask_quantity, parseFloat(timeSpent.toFixed(2))];
				csv.push(row.join(","));
			}

			res.setHeader("Content-Type", "text/csv");
			res.attachment("subtasks.csv");
			res.send(csv.join("\n"));
		} catch (error) {
			console.error(error);
			const { message } = error as { message: string };
			res.status(500).json({ error: message });
		}
	});

	// calculate how much time each worker has worked based on the pickings
	router.get("/time/:startTimestamp/:endTimestamp", authService.adminMiddleware, async (req, res) => {
		try {
			const { startTimestamp, endTimestamp } = req.params as { startTimestamp: string; endTimestamp: string };

			if (!startTimestamp || !endTimestamp) {
				throw new Error("startTime and endTime are required");
			}
			const pickings = await getAllPickings(new Date(startTimestamp), new Date(endTimestamp));

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
				if (worker) {
					const timeSpent = (end_timestamp.getTime() - start_timestamp.getTime()) / Milliseconds.HOUR;
					usersMappedToWorkType[worker.name][work_type] += parseFloat(timeSpent.toFixed(1));
				}
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
			const { workType, itemName, quanity } = req.body as {
				workType: WorkType;
				itemName: string;
				quanity: number;
			};
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
			const { subtask, subtaskQuantity } = req.body as {
				decoded: JwtDecoded;
				subtask: string;
				subtaskQuantity: number;
			};
			const id = parseInt(req.params.id);
			const picking = await updatePicking(id, new Date(), subtask, subtaskQuantity);
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
