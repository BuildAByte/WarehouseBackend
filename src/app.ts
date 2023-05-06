import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

import { default as express } from "express";
import Picking from "./routes/picking.js";
import Worker from "./routes/worker.js";
import { adminMiddleware, middleware } from "./middleware/auth.js";
import { createWorker } from "./db/dbhandler.js";
// Create a new express application instance
const app: express.Application = express();

app.use(express.json());
const picking = Picking(middleware, adminMiddleware);
const worker = Worker(adminMiddleware);

async function insertAdminUser() {
	console.log(await createWorker(`SuperSecret!`, `Admin`, true));
}

insertAdminUser();

app.use("/picking", picking);
app.use("/worker", worker);

export default app;
