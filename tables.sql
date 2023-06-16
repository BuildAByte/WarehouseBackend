CREATE TABLE IF NOT EXISTS workers(
    id SERIAL NOT NULL,
    password VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    admin BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id)
);

DO $$ BEGIN
    CREATE TYPE work_type AS ENUM (
        'picking',
        'packing',
        'labelling',
        'liquid production',
        'preparation',
        'checking',
        'restocking',
        'sub division'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS picking(
    id SERIAL NOT NULL,
    worker_id INT NOT NULL,
    work_type work_type NOT NULL,
    subtask VARCHAR(100),
    subtask_quantity INT,
    start_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_timestamp TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (worker_id) REFERENCES workers(id)
);
