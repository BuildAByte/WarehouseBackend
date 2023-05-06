import app from "./app.js";
import { init } from "./db/dbhandler.js";

const port = process.env.PORT || `3000`;

app.listen(port, async () => {
	console.log(`App listening on the port ${port}`);
	await init();
	console.log("Database initialized");
});
