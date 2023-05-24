DROP TABLE IF EXISTS picking;
DROP TABLE IF EXISTS workers;

CREATE TABLE workers(
    id SERIAL NOT NULL,
    password VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    admin BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id)
);

DROP TYPE IF EXISTS work_type;

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

CREATE TABLE picking(
    id SERIAL NOT NULL,
    worker_id INT NOT NULL,
    work_type work_type NOT NULL,
    start_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_timestamp TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (worker_id) REFERENCES workers(id)
);
