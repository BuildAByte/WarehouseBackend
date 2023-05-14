import { readFileSync } from "fs";
import connection from "./dbconnection.js";
import bcrypt from "bcrypt";
import path from "path";

interface Worker {
	id: number;
	password?: string;
	name: string;
	admin: boolean;
}

export enum WorkType {
	PICKING = "picking",
	PACKING = "packing",
	LABELLING = "labelling",
}

interface Picking {
	id: number;
	worker_id: number;
	work_type: WorkType;
	start_timestamp: string;
	end_timestamp: string;
}

export async function init() {
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
	const result = await client.query("SELECT * FROM workers");
	client.release();
	const workers = result.rows as Worker[];
	return workers.map((worker) => {
		delete worker.password;
		return worker;
	});
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
export async function createWorker(password: string, name: string, isAdmin = false): Promise<Worker> {
	const client = await connection.connect();
	const hash = await generatePassword(password);
	const result = await client.query("INSERT INTO workers (name, password, admin) VALUES ($1, $2, $3) RETURNING *", [
		name,
		hash,
		isAdmin,
	]);
	client.release();
	const worker = result.rows[0] as Worker;
	delete worker.password;
	return worker;
}

export async function generatePassword(password: string) {
	const salt = await bcrypt.genSalt(16);
	return await bcrypt.hash(password, salt);
}

export async function updateWorker(id: number, worker: Nullable<Worker>): Promise<Worker> {
	const client = await connection.connect();
	const result = await client.query("UPDATE workers SET name = $1 WHERE id = $2 RETURNING *", [worker.name, id]);
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

export async function updatePicking(id: number, endTimestamp: Date): Promise<Picking> {
	const client = await connection.connect();
	const result = await client.query("UPDATE picking SET end_timestamp = $2 WHERE id = $1 RETURNING *", [
		id,
		endTimestamp.toISOString(),
	]);
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
	const result = await client.query("SELECT * FROM picking WHERE worker_id = $1", [id]);
	client.release();
	return result.rows as Picking[];
}

type Nullable<T> = {
	[P in keyof T]?: T[P];
};
