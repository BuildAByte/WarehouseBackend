import { default as express } from "express";
import Picking from "./routes/picking.js";
import Worker from "./routes/worker.js";
import { AuthService } from "./middleware/auth.js";
import { createWorker, init } from "./db/dbhandler.js";
// Create a new express application instance
const app: express.Application = express();

const SECRET = process.env.ENCRYPTION_KEY ?? "BingoMachine!12345!";
const authService = new AuthService(SECRET);

app.use(express.json());

const picking = Picking(authService);
const worker = Worker(authService);

async function initDb() {
	await init();
	console.log("Database initialized");
}

async function insertAdminUser() {
	console.log(await createWorker(`SuperSecret!`, `Admin`, true));
}

await initDb();
await insertAdminUser();

app.use("/picking", picking);
app.use("/worker", worker);

export default app;
