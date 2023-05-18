import { default as express } from "express";
import { AuthHandlers } from "../middleware/auth.js";
import { login, getWorkers, getWorker, createWorker, deleteWorker, updateWorker } from "../db/dbhandler.js";
import { objectValidator } from "../utils.js";

export default function (authService: AuthHandlers) {
	const router = express.Router();

	// GET /worker
	router.get("/", authService.adminMiddleware, async (req, res) => {
		try {
			const workers = await getWorkers();
			res.json(workers);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).json({ message: error.message });
			}
		}
	});

	// login
	router.post("/login", async (req, res) => {
		try {
			const { name, password } = req.body;
			objectValidator({ name, password });
			const user = await login(name, password);
			const token = authService.signUser({
				admin: user.admin,
				id: user.id,
				expiresIn: "24h",
			});
			res.json({ token, user });
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).json({ message: error.message });
			}
		}
	});

	router.get("/token_validation", (req, res) => {
		const authHeader = req.headers["authorization"];
		const token = authHeader && authHeader.split(" ")[1];

		if (!token) return res.sendStatus(401);

		const isValid = authService.isTokenValid(token);
		res.json({ isValid });
	});

	// GET /worker/:id
	router.get("/:id", authService.adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			const worker = await getWorker(id);
			res.json(worker);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).json({ message: error.message });
			}
		}
	});

	// POST /worker
	router.post("/", authService.adminMiddleware, async (req, res) => {
		try {
			const { password, name } = req.body as { password: string; name: string };
			objectValidator({ password, name });
			const worker = await createWorker(password, name);
			res.json(worker);
		} catch (error) {
			if (error instanceof Error) {
				return res.status(400).json({ message: error.message });
			}
		}
	});

	// PUT /worker/:id
	router.put("/:id", authService.adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			const body = req.body as { password: string; name: string };
			const newWorker = await updateWorker(id, body);
			res.json(newWorker);
		} catch (error) {
			if (error instanceof Error) {
				res.status(500).json({ message: error.message });
			}
		}
	});

	// DELETE /worker/:id
	router.delete("/:id", authService.adminMiddleware, async (req, res) => {
		try {
			const id = parseInt(req.params.id);
			await deleteWorker(id);
			res.json({ message: "Successfully deleted worker" });
		} catch (error) {
			if (error instanceof Error) {
				res.status(500).json({ message: error.message });
			}
		}
	});

	return router;
}
