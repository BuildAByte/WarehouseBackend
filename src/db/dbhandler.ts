import { readFileSync } from "fs";
import connection from "./dbconnection.js";
import bcrypt from "bcrypt";
import path from "path";

export enum Milliseconds {
	SECOND = 1000,
	MINUTE = 60 * SECOND,
	HOUR = 60 * MINUTE,
	DAY = 24 * HOUR,
	MONTH = 30 * DAY,
}
export interface DataReport {
	id: number;
	date: Date;
	orders: number;
	orderlines: number;
	units: number;
	timeSpent: number;
	orderLinesPerHour: number;
	unitsPerOrderLine: number;
}
interface Worker {
	id: number;
	soft_one_id: string;
	password?: string;
	name: string;
	admin: boolean;
}

export enum WorkType {
	PICKING = "picking",
	PACKING = "packing",
	LABELLING = "labelling",
	"LIQUID PRODUCTION" = "liquid production",
	PREPARATION = "preparation",
	CHECKING = "checking",
	RESTOCKING = "restocking",
	"SUB DIVISION" = "sub division",
}

interface Picking {
	id: number;
	worker_id: number;
	work_type: WorkType;
	subtask: string;
	subtask_quantity: number;
	start_timestamp: string;
	end_timestamp: string;
}

export interface PickingParsed {
	id: number;
	worker_id: number;
	work_type: WorkType;
	subtask: string;
	subtask_quantity: number;
	start_timestamp: Date;
	end_timestamp: Date;
}

export async function initTables() {
	const client = await connection.connect();
	const sql = readFileSync(path.resolve("tables.sql")).toString("utf-8");
	await client.query(sql);
	client.release();
}

// create a function that gets the latest entry from the picking table using user id
export async function getLatestPicking(id: number): Promise<Picking | undefined> {
	const client = await connection.connect();
	const result = await client.query("SELECT * FROM picking WHERE worker_id = $1 ORDER BY id DESC LIMIT 1", [id]);
	client.release();
	return result.rows[0];
}

export async function getWorkers(): Promise<Worker[]> {
	const client = await connection.connect();
	const result = await client.query("SELECT * FROM workers where name != 'Admin'");
	client.release();
	const workers = result.rows as Worker[];
	return workers.map((worker) => {
		delete worker.password;
		return worker;
	});
}

export async function getWorkerBySoftOneId(softOneId: number): Promise<Worker | undefined> {
	const client = await connection.connect();
	const result = await client.query("SELECT * FROM workers WHERE soft_one_id = $1", [softOneId]);
	client.release();
	const worker = result.rows[0] as Worker;
	delete worker.password;
	return worker;
}

// create a function that gets all the pickings where end_timestamp is null called getActivePickings
export async function getActivePickings(): Promise<Picking[]> {
	const client = await connection.connect();
	const result = await client.query("SELECT * FROM picking WHERE end_timestamp IS NULL");
	client.release();
	return result.rows;
}

export async function getActivePickingForUser(userId: number): Promise<Picking[] | undefined> {
	const client = await connection.connect();
	const result = await client.query("SELECT * FROM picking WHERE worker_id = $1 AND end_timestamp IS NULL", [userId]);
	client.release();
	return result.rows;
}

export async function getWorker(id: number): Promise<Worker> {
	const client = await connection.connect();
	const result = await client.query("SELECT * FROM workers WHERE id = $1", [id]);
	client.release();
	const worker = result.rows[0] as Worker;
	if (!worker) {
		throw new Error("Worker not found");
	}
	delete worker.password;
	return worker;
}

// create a login function that takes an email and password and returns a worker if the password matches
export async function login(name: string, password: string): Promise<Worker> {
	const client = await connection.connect();
	const result = await client.query("SELECT * FROM workers WHERE name = $1", [name]);
	client.release();
	const worker = result.rows[0] as Worker;
	if (!worker) {
		throw new Error("No worker found with given name");
	}
	const match = await bcrypt.compare(password, worker.password!);
	if (!match) {
		throw new Error("Invalid credentials");
	}
	delete worker.password;
	return worker;
}

// create a new worker with a hashed password with a secret and return the worker with the generated id
export async function createWorker(
	softOneId: number,
	password: string,
	name: string,
	isAdmin = false,
): Promise<Worker> {
	const client = await connection.connect();
	const hash = await generatePassword(password);
	const result = await client.query(
		"INSERT INTO workers (soft_one_id, name, password, admin) VALUES ($1, $2, $3, $4) RETURNING *",
		[softOneId, name, hash, isAdmin],
	);
	client.release();
	const worker = result.rows[0] as Worker;
	delete worker.password;
	return worker;
}

export async function generatePassword(password: string) {
	const salt = await bcrypt.genSalt(8);
	return await bcrypt.hash(password, salt);
}

export async function updateWorker(id: number, worker: Nullable<Worker>): Promise<Worker> {
	const client = await connection.connect();
	const { password } = worker;
	if (password) {
		worker.password = await generatePassword(password);
	}
	const result = await client.query(`UPDATE workers SET name = $1 WHERE id = $2 RETURNING *`, [worker.name, id]);
	client.release();
	const returnedWorker = result.rows[0] as Worker;
	delete returnedWorker.password;
	return returnedWorker;
}

export async function deleteWorker(id: number): Promise<void> {
	const client = await connection.connect();
	await client.query("DELETE FROM workers WHERE id = $1", [id]);
	client.release();
}

export async function createPicking(worker_id: number, work_type: WorkType): Promise<Picking> {
	const client = await connection.connect();
	const result = await client.query("INSERT INTO picking (worker_id, work_type) VALUES ($1, $2) RETURNING *", [
		worker_id,
		work_type,
	]);
	client.release();
	return result.rows[0] as Picking;
}

export async function updatePicking(
	id: number,
	endTimestamp: Date,
	subtask?: string,
	subtaskQuantity?: number,
): Promise<Picking> {
	const client = await connection.connect();
	const result = await client.query(
		`UPDATE picking SET end_timestamp = $1, subtask = $2, subtask_quantity = $3 WHERE id = $4 RETURNING *`,
		[endTimestamp, subtask, subtaskQuantity, id],
	);
	client.release();
	return result.rows[0] as Picking;
}

export async function deletePicking(id: number): Promise<void> {
	const client = await connection.connect();
	await client.query("DELETE FROM picking WHERE id = $1", [id]);
	client.release();
}

// get pickings for user
export async function getPickings(id: number): Promise<Picking[]> {
	const client = await connection.connect();
	const result = await client.query("SELECT * FROM picking WHERE worker_id = $1 ORDER BY id DESC", [id]);
	client.release();
	return result.rows as Picking[];
}

export async function getAllPickings(
	fromDate = new Date(Date.now() - Milliseconds.MONTH),
	endDate = new Date(),
): Promise<Array<Picking & { worker_name: string }>> {
	const client = await connection.connect();
	// inner join with workers table to get the name of the worker
	const result = await client.query(
		`SELECT 
			picking.*, workers.name as worker_name 
		FROM 
			picking 
		INNER JOIN 
			workers ON picking.worker_id = workers.id 
		WHERE start_timestamp > $1 AND start_timestamp < $2 
		ORDER BY id DESC`,
		[fromDate.toISOString(), endDate.toISOString()],
	);

	client.release();
	return result.rows;
}

export async function getPickingsWithSubtask(
	fromDate = new Date(Date.now() - Milliseconds.MONTH),
	endDate = new Date(),
): Promise<Array<Picking & { worker_name: string }>> {
	const client = await connection.connect();
	// inner join with workers table to get the name of the worker
	const result = await client.query(
		`SELECT 
			picking.*, workers.name as worker_name 
		FROM 
			picking 
		INNER JOIN 
			workers ON picking.worker_id = workers.id 
		WHERE start_timestamp > $1 AND start_timestamp < $2 AND subtask IS NOT NULL 
		ORDER BY id DESC`,
		[fromDate.toISOString(), endDate.toISOString()],
	);

	client.release();
	return result.rows;
}

export async function insertDataReports(reports: DataReport[]): Promise<void> {
	const client = await connection.connect();
	const data = reports.map(
		({ id, date, orders, orderlines, units, timeSpent, orderLinesPerHour, unitsPerOrderLine }) =>
			`(${id}, ${date.toISOString()}, ${orders}, ${orderlines}, ${units}, ${timeSpent}, ${orderLinesPerHour}, ${unitsPerOrderLine})`,
	);

	const query = `INSERT INTO data_reports (worker_id, created, orders, order_lines, units, time_spent, order_lines_per_hour, units_per_order_line) VALUES${data.join(
		",",
	)}`;
	console.log(query);
	await client.query(query);
	client.release();
}

type Nullable<T> = {
	[P in keyof T]?: T[P];
};
