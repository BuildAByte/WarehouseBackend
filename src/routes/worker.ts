import { default as express } from "express";
import { signUser } from "../middleware/auth.js";
import { login, getWorkers, getWorker, createWorker, deleteWorker, updateWorker } from "../db/dbhandler.js";
import { objectValidator } from "../utils.js";

export default function (adminMiddleware: express.Handler) {
	const router = express.Router();

	// GET /worker
	router.get("/", adminMiddleware, async (req, res) => {
		try {
			const workers = await getWorkers();
			res.json(workers);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// login
	router.post("/login", async (req, res) => {
		try {
			const { name, password } = req.body;
			objectValidator({ name, password });
			const user = await login(name, password);
			const token = signUser({
				admin: user.admin,
				id: user.id,
				expiresIn: "24h",
			});
			res.json({ token, user });
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// GET /worker/:id
	router.get("/:id", adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			const worker = await getWorker(id);
			res.json(worker);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// POST /worker
	router.post("/", adminMiddleware, async (req, res) => {
		try {
			const { password, name } = req.body as { password: string; name: string };
			objectValidator({ password, name });
			const worker = await createWorker(password, name);
			res.json(worker);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// PUT /worker/:id
	router.put("/:id", adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			const body = req.body as { password: string; name: string };
			const worker = await getWorker(id);
			const changes = { ...worker, ...body };
			const newWorker = await updateWorker(id, changes);
			res.json(newWorker);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	// DELETE /worker/:id
	router.delete("/:id", adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			await deleteWorker(id);
			res.json({ message: "Successfully deleted worker" });
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).send(error.message);
			}
		}
	});

	return router;
}
