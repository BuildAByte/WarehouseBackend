import pg from "pg";

// create a connection pool to the database using environment variable PG_URL
const pool = new pg.Pool({
	connectionString: process.env.PG_URL ?? "postgres://postgres:password@localhost:5432/postgres",
});

export default pool;
